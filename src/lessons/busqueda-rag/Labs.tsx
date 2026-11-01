import { useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, Brain, CheckCircle2, Wrench, XCircle } from 'lucide-react'
import { BarRow, Lab, Panel, Pill, Segmented } from '../../components/ui'
import { MessageList, type Msg } from '../../components/Messages'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { KB_INDEX } from '../../sim/corpus'
import { searchTopK } from '../../sim/embed'
import { runTool } from '../../sim/scenario'
import { Cited } from './Pipeline'

/* -------------------------------------------------------------------------- */
/* 1. Sin RAG vs con RAG                                                       */
/* -------------------------------------------------------------------------- */

const VERSUS = [
  {
    q: '¿Cuánto demora el reembolso si pagué con tarjeta?',
    plain: 'Normalmente los reembolsos con tarjeta tardan entre 3 y 5 días hábiles, aunque puede depender de tu banco.',
    wrong: 'La política de Andes Market dice 5 a 10 días hábiles desde que el producto llega a bodega.',
    rag: 'El reembolso se hace al mismo medio de pago: con tarjeta demora entre 5 y 10 días hábiles desde que el producto llega a nuestra bodega [1].',
    source: 'politicas/devoluciones.md',
  },
  {
    q: '¿El envío es gratis?',
    plain: '¡Sí! La mayoría de las tiendas ofrecen envío gratis sobre cierto monto, generalmente desde $30.000.',
    wrong: 'El umbral real es $39.990. El modelo completó con un número "típico".',
    rag: 'Sí, el envío es gratis en compras sobre $39.990; bajo ese monto el costo depende de la comuna y del peso del paquete [1].',
    source: 'ayuda/envios.md',
  },
  {
    q: 'Olvidé mi contraseña',
    plain: 'Puedes restablecerla desde "¿Olvidaste tu contraseña?". El enlace suele ser válido por 24 horas.',
    wrong: 'En Andes Market el enlace vence en 30 minutos. El modelo inventó un plazo plausible.',
    rag: 'Usa la opción Recuperar clave en la página de inicio de sesión: te llegará un enlace al correo que vence en 30 minutos [1].',
    source: 'ayuda/cuenta.md',
  },
]

export function VersusLab() {
  const [i, setI] = useState(0)
  const v = VERSUS[i]
  return (
    <Lab title="La misma pregunta, sin y con RAG" hint="Cambia la pregunta">
      <div className="stack">
        <Segmented value={String(i)} onChange={(x) => setI(Number(x))} options={VERSUS.map((x, j) => ({ value: String(j), label: x.q }))} />
        <div className="grid-2">
          <div className="brag-versus" data-tone="error">
            <div className="brag-versus-head">
              <Brain size={16} /> Solo el LLM
            </div>
            <div className="brag-bubble brag-bubble-model">{v.plain}</div>
            <div className="brag-verdict" data-tone="error">
              <XCircle size={15} /> Suena seguro, pero es incorrecto. {v.wrong}
            </div>
          </div>
          <div className="brag-versus" data-tone="data">
            <div className="brag-versus-head">
              <BookOpen size={16} /> LLM + recuperación
            </div>
            <div className="brag-bubble brag-bubble-model">
              <Cited text={v.rag} />
            </div>
            <div className="brag-verdict" data-tone="ok">
              <CheckCircle2 size={15} /> Correcto y verificable: <span className="mono">[1] {v.source}</span>
            </div>
          </div>
        </div>
        <div className="small muted">
          Las respuestas "solo LLM" son ilustrativas: un modelo general no conoce las políticas de una empresa, así que completa con lo que es
          estadísticamente probable. Eso es una alucinación con buena ortografía.
        </div>
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* 2. Diagnóstico de fallas                                                    */
/* -------------------------------------------------------------------------- */

type Row = { id: string; score: number; text: string; tag?: string; bad?: boolean }
type Variant = { rows: Row[]; answer: string; ok: boolean; verdict: string }
type Scenario = { id: string; label: string; query: string; problem: string; fix: string; fixLabel: string; broken: Variant; fixed: Variant }

const SCENARIOS: Scenario[] = [
  {
    id: 'k',
    label: 'k = 1',
    query: '¿Cuánto demora el reembolso si pagué con tarjeta?',
    problem: 'Con k = 1 confías todo a un solo fragmento. Si el ranking se equivoca por poco, el modelo responde otra cosa.',
    fixLabel: 'k = 3 + reranker',
    fix: 'Recupera más candidatos (k = 3–8) y reordénalos con un reranker que lee pregunta y fragmento juntos (lección siguiente).',
    broken: {
      rows: [{ id: 'pagos#2', score: 0.831, text: 'Si tu pago fue rechazado… si ves un cargo pendiente se libera en 72 horas.', bad: true }],
      answer: 'Los cargos pendientes se liberan en 72 horas [1].',
      ok: false,
      verdict: 'Responde sobre cargos rechazados, no sobre reembolsos.',
    },
    fixed: {
      rows: [
        { id: 'devoluciones#3', score: 0.94, text: 'El reembolso se realiza al mismo medio de pago. Con tarjeta… entre 5 y 10 días hábiles…', tag: 'reranker ↑' },
        { id: 'pagos#2', score: 0.41, text: 'Si tu pago fue rechazado… se libera en 72 horas.', tag: 'reranker ↓' },
        { id: 'pagos#1', score: 0.22, text: 'Aceptamos tarjetas de crédito y débito vía Webpay…' },
      ],
      answer: 'Con tarjeta, el reembolso demora entre 5 y 10 días hábiles desde que el producto llega a bodega [1].',
      ok: true,
      verdict: 'El fragmento correcto queda primero.',
    },
  },
  {
    id: 'umbral',
    label: 'Sin umbral',
    query: '¿Va a llover mañana en Santiago?',
    problem: 'Un vector store SIEMPRE devuelve k resultados, aunque sean irrelevantes. Si además el prompt exige responder, el modelo fuerza una respuesta.',
    fixLabel: 'umbral + "si no está, dilo"',
    fix: 'Filtra por similitud mínima y dale permiso explícito al modelo para decir que no sabe.',
    broken: {
      rows: [
        { id: 'envios#4', score: 0.002, text: 'La dirección de entrega solo se puede cambiar mientras…', bad: true },
        { id: 'productos#1', score: -0.013, text: 'Nuestras zapatillas usan talla chilena…', bad: true },
      ],
      answer: 'Según nuestra información de despachos en Santiago [1], no se esperan inconvenientes para mañana.',
      ok: false,
      verdict: 'Alucinación "con fuente": cita un documento que no dice nada del clima.',
    },
    fixed: {
      rows: [],
      answer: 'No encontré información sobre eso en la base de conocimiento de Andes Market. ¿Te ayudo con algo de tu compra?',
      ok: true,
      verdict: 'Nada supera 0,45: el sistema admite que no sabe.',
    },
  },
  {
    id: 'version',
    label: 'Documento viejo',
    query: '¿El envío es gratis?',
    problem: 'La política cambió, pero la versión 2025 sigue indexada. Ambas son casi idénticas, así que ambas aparecen arriba y el modelo mezcla.',
    fixLabel: 'filtro por metadata',
    fix: 'Al reindexar, borra o marca las versiones antiguas y filtra por metadata (vigente = true, fecha) antes de rankear.',
    broken: {
      rows: [
        { id: 'envios-2025#2', score: 0.957, text: 'El envío es gratis en compras sobre $29.990…', tag: 'actualizado 2025-03-01', bad: true },
        { id: 'envios#2', score: 0.955, text: 'El envío es gratis en compras sobre $39.990…', tag: 'actualizado 2026-10-02' },
      ],
      answer: 'Sí, el envío es gratis en compras sobre $29.990 [1].',
      ok: false,
      verdict: 'Usa el monto antiguo: el chunk viejo quedó primero por 0,002.',
    },
    fixed: {
      rows: [{ id: 'envios#2', score: 0.955, text: 'El envío es gratis en compras sobre $39.990…', tag: 'vigente' }],
      answer: 'Sí, el envío es gratis en compras sobre $39.990 [1].',
      ok: true,
      verdict: 'El filtro `vigente = true` se aplica antes de buscar.',
    },
  },
  {
    id: 'chunk',
    label: 'Chunk cortado',
    query: '¿Qué productos no tienen devolución?',
    problem: 'Con chunks muy chicos y sin solapamiento, la lista quedó partida en dos fragmentos y solo uno se recupera.',
    fixLabel: 'chunk por párrafo',
    fix: 'Corta respetando la estructura (párrafos, secciones) o agrega solapamiento. Revisa la lección de Ingesta.',
    broken: {
      rows: [
        { id: 'devoluciones#4b', score: 0.71, text: '…artículos personalizados no tienen devolución por razones de higiene, salvo que…', bad: true },
        { id: 'productos#1', score: 0.62, text: 'Nuestras zapatillas usan talla chilena…' },
      ],
      answer: 'Los artículos personalizados no tienen devolución [1].',
      ok: false,
      verdict: 'Incompleta: faltan ropa interior y trajes de baño (quedaron en el chunk 4a).',
    },
    fixed: {
      rows: [{ id: 'devoluciones#4', score: 0.793, text: 'Los productos de ropa interior, trajes de baño y artículos personalizados no tienen devolución…' }],
      answer: 'No tienen devolución la ropa interior, los trajes de baño y los artículos personalizados, salvo que tengan falla de fábrica [1].',
      ok: true,
      verdict: 'El párrafo completo llega junto.',
    },
  },
]

export function DiagnosisLab() {
  const [id, setId] = useState(SCENARIOS[0].id)
  const [fixed, setFixed] = useState(false)
  const sc = SCENARIOS.find((s) => s.id === id)!
  const v = fixed ? sc.fixed : sc.broken
  return (
    <Lab title="Diagnóstico: cuatro formas típicas de que un RAG falle" hint="Elige una falla y aplica el arreglo">
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Segmented
            value={id}
            onChange={(x) => {
              setId(x)
              setFixed(false)
            }}
            options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
          />
          <button className={`btn${fixed ? '' : ' btn-primary'}`} onClick={() => setFixed((f) => !f)}>
            <Wrench size={15} /> {fixed ? 'Quitar arreglo' : `Aplicar arreglo: ${sc.fixLabel}`}
          </button>
        </div>
        <div className="brag-bubble" style={{ alignSelf: 'flex-start' }}>
          {sc.query}
        </div>
        <div className="split">
          <Panel title="Recuperado" tone="data" right={<span className="mono">{v.rows.length} chunk(s)</span>}>
            <div className="stack" style={{ gap: 8 }} key={String(fixed) + id}>
              {v.rows.length === 0 && <div className="small muted">Ningún chunk supera el umbral.</div>}
              {v.rows.map((r, i) => (
                <div key={r.id} className={`brag-row anim-in${r.bad ? ' bad' : ''}`} style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="brag-cite">{i + 1}</span>
                    <span className="mono small">{r.id}</span>
                    {r.tag && <Pill tone={r.bad ? 'error' : 'data'}>{r.tag}</Pill>}
                    <span className="mono small" style={{ marginLeft: 'auto' }}>
                      {r.score.toFixed(3)}
                    </span>
                  </div>
                  <div className="small" style={{ color: 'var(--text-2)', marginTop: 4 }}>
                    {r.text}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <div className="stack" style={{ gap: 10 }}>
            <Panel title="Respuesta" tone="model">
              <div key={String(fixed) + id} className="anim-fade">
                <Cited text={v.answer} />
              </div>
            </Panel>
            <div className="brag-verdict" data-tone={v.ok ? 'ok' : 'error'}>
              {v.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {v.verdict}
            </div>
            <div className="small" style={{ color: 'var(--text-2)' }}>
              <strong>{fixed ? 'Arreglo: ' : 'Problema: '}</strong>
              {fixed ? sc.fix : sc.problem}
            </div>
          </div>
        </div>
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* 3. RAG agéntico                                                             */
/* -------------------------------------------------------------------------- */

const USER_MSG = 'holaa, oye si me arrepiento de las zapatillas q compré me devuelven la plata a la tarjeta o como es??'
const REWRITE = 'plazo de reembolso de una devolución pagada con tarjeta'

export function AgenticLab() {
  const literal = useMemo(() => searchTopK(USER_MSG, KB_INDEX, 4), [])
  const rewritten = useMemo(() => searchTopK(REWRITE, KB_INDEX, 4), [])
  const toolOut = useMemo(() => runTool('consultar_politicas', { pregunta: REWRITE }), [])

  const all: Msg[] = [
    { role: 'user', content: USER_MSG },
    {
      role: 'assistant',
      note: 'llamada 1 · stop_reason: tool_use',
      content: [
        { type: 'text', text: 'Voy a revisar la política de devoluciones.' },
        { type: 'tool_use', id: 'toolu_01', name: 'consultar_politicas', input: { pregunta: REWRITE } },
      ],
    },
    {
      role: 'user',
      note: 'tu código ejecutó la búsqueda',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: toolOut.content }],
    },
    {
      role: 'assistant',
      note: 'llamada 2 · stop_reason: end_turn',
      content:
        '¡Sí! Si las devuelves, el reembolso va a la misma tarjeta con que pagaste y demora entre 5 y 10 días hábiles desde que llegan a nuestra bodega (politicas/devoluciones.md). ¿Quieres que te explique cómo iniciar la devolución?',
    },
  ]
  const steps: StepInfo[] = [
    { title: 'Mensaje informal', body: 'Saludo, abreviaturas, dos preguntas en una. Si lo usas tal cual como consulta, el vector queda "diluido".' },
    {
      title: 'El agente decide buscar… y reformula',
      body: (
        <>
          La búsqueda es una <strong>herramienta</strong> más. El LLM escribe su propia consulta, limpia y específica: "{REWRITE}".
        </>
      ),
    },
    { title: 'Tu código ejecuta la búsqueda', body: 'Mismo pipeline de antes (embedding → top-k), pero con la consulta reformulada. Los fragmentos vuelven como tool_result.' },
    { title: 'Respuesta fundamentada', body: 'Con el resultado en el contexto, el modelo responde. Si no hubiera bastado, podría buscar de nuevo con otra consulta.' },
  ]
  const player = usePlayer(steps.length, { interval: 2800 })

  return (
    <Lab title="RAG clásico vs RAG agéntico" hint="Compara las dos consultas y reproduce la conversación">
      <div className="stack">
        <div className="grid-2">
          <Panel title="Consulta literal (RAG clásico)" tone="system">
            <div className="small mono" style={{ color: 'var(--text-2)', marginBottom: 8 }}>
              “{USER_MSG}”
            </div>
            <div className="stack" style={{ gap: 5 }}>
              {literal.map((h) => (
                <BarRow key={h.item.id} label={h.item.id} value={Math.max(0, h.score)} display={h.score.toFixed(3)} tone="system" pick={h.item.id === 'devoluciones#3'} />
              ))}
            </div>
          </Panel>
          <Panel title="Consulta reformulada por el agente" tone="data">
            <div className="small mono" style={{ color: 'var(--text-2)', marginBottom: 8 }}>
              “{REWRITE}”
            </div>
            <div className="stack" style={{ gap: 5 }}>
              {rewritten.map((h) => (
                <BarRow key={h.item.id} label={h.item.id} value={Math.max(0, h.score)} display={h.score.toFixed(3)} tone="data" pick={h.item.id === 'devoluciones#3'} />
              ))}
            </div>
          </Panel>
        </div>
        <div className="small muted">
          El chunk correcto (<span className="mono">devoluciones#3</span>) sube de{' '}
          <strong>{literal.find((h) => h.item.id === 'devoluciones#3')?.score.toFixed(3) ?? '—'}</strong> a{' '}
          <strong>{rewritten.find((h) => h.item.id === 'devoluciones#3')?.score.toFixed(3) ?? '—'}</strong> de similitud solo por reformular.
        </div>
        <div className="split">
          <MessageList messages={all.slice(0, player.step + 1)} newFrom={player.step} highlight={[player.step]} />
          <div className="stack">
            <Narration steps={steps} step={player.step} />
            <div className="small" style={{ color: 'var(--text-2)' }}>
              <Wrench size={13} style={{ verticalAlign: '-2px' }} /> La herramienta <span className="mono">consultar_politicas</span> es la del
              agente Andi del taller: su resultado aquí es real (se calcula con el mismo índice simulado).
            </div>
          </div>
        </div>
        <PlayerBar player={player} labels={steps.map((s) => s.title)} />
      </div>
    </Lab>
  )
}
