import { ArrowDown } from 'lucide-react'
import { Code } from '../../components/Code'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { BarRow, Lab, Panel, Pill, type Tone } from '../../components/ui'
import { usePlayer } from '../../lib/hooks'

/* Generación token a token de una llamada a herramienta.
   Probabilidades y "atención" son ilustrativas (escritas a mano, coherentes). */

const TOOL_ROW = ['buscar_pedido', 'cambiar_direccion', 'consultar_politicas', 'crear_ticket']
const USER_ROW = ['¿', 'Dónde', ' está', ' mi', ' pedido', ' 482', '1', '?']

type Cand = { t: string; p: number; kind?: 'special' | 'text' | 'tool' | 'arg' }
type Gen = {
  token: string
  kind: 'special' | 'tool' | 'arg'
  cands: Cand[]
  /** pesos de "atención" ilustrativos: t = fila de herramientas, u = fila del usuario */
  att: { t?: Record<number, number>; u?: Record<number, number> }
  title: string
  body: StepInfo['body']
}

const GEN: Gen[] = [
  {
    token: '<tool_call>',
    kind: 'special',
    cands: [
      { t: '<tool_call>', p: 0.86, kind: 'special' },
      { t: 'Hola', p: 0.06, kind: 'text' },
      { t: 'Voy', p: 0.04, kind: 'text' },
      { t: 'Tu', p: 0.02, kind: 'text' },
      { t: '(otros)', p: 0.02, kind: 'text' },
    ],
    att: { u: { 1: 0.35, 4: 0.45, 5: 0.2 }, t: { 0: 0.4 } },
    title: 'La decisión real: ¿texto o llamada?',
    body: (
      <>
        El primer token lo decide todo. Compiten un token especial que abre una llamada a herramienta y tokens de texto normal ("Hola", "Tu"…). Una pregunta por un
        pedido concreto + una herramienta descrita para eso = <strong>86%</strong> para la llamada. No hubo ningún <code>if</code>: es la misma predicción de
        siempre.
      </>
    ),
  },
  {
    token: 'buscar',
    kind: 'tool',
    cands: [
      { t: 'buscar', p: 0.93, kind: 'tool' },
      { t: 'consultar', p: 0.04, kind: 'tool' },
      { t: 'crear', p: 0.02, kind: 'tool' },
      { t: 'cambiar', p: 0.01, kind: 'tool' },
    ],
    att: { t: { 0: 0.75, 2: 0.15 }, u: { 4: 0.3 } },
    title: 'Elegir la herramienta = predecir su nombre',
    body: (
      <>
        Dentro de la llamada, el modelo genera el nombre de la herramienta, token a token. Los candidatos son los nombres que <strong>leyó en el prompt</strong>. La
        descripción de <code>buscar_pedido</code> ("cuando el cliente pregunte por un pedido específico") empuja su probabilidad a 0,93.
      </>
    ),
  },
  {
    token: '_pedido',
    kind: 'tool',
    cands: [
      { t: '_pedido', p: 0.997, kind: 'tool' },
      { t: '_producto', p: 0.002, kind: 'tool' },
      { t: '_orden', p: 0.001, kind: 'tool' },
    ],
    att: { t: { 0: 0.95 } },
    title: 'Los nombres también son subpalabras',
    body: (
      <>
        <code>buscar_pedido</code> son dos tokens. Una vez elegido <code>buscar</code>, el resto es casi seguro: no hay otra herramienta que empiece así. Nombres
        parecidos (<code>buscar_pedido</code> vs. <code>buscar_pedidos</code>) harían este paso mucho más incierto.
      </>
    ),
  },
  {
    token: '{"pedido_id": "',
    kind: 'arg',
    cands: [
      { t: '{"pedido_id": "', p: 0.99, kind: 'arg' },
      { t: '{"id": "', p: 0.006, kind: 'arg' },
      { t: '{"numero": "', p: 0.004, kind: 'arg' },
    ],
    att: { t: { 0: 0.85 } },
    title: 'Los argumentos siguen el esquema que leyó',
    body: (
      <>
        Aquí agrupamos varios tokens (<code>{'{"'}</code>, <code>pedido</code>, <code>_id</code>, <code>{'": "'}</code>). El nombre del campo sale del{' '}
        <code>input_schema</code> que estaba en el prompt. Que no se equivoque es aprendizaje, no magia: por eso existen los modos estrictos (sección 4).
      </>
    ),
  },
  {
    token: '482',
    kind: 'arg',
    cands: [
      { t: '482', p: 0.95, kind: 'arg' },
      { t: '#', p: 0.025, kind: 'arg' },
      { t: '481', p: 0.012, kind: 'arg' },
      { t: '123', p: 0.008, kind: 'arg' },
      { t: '(otros)', p: 0.005, kind: 'arg' },
    ],
    att: { u: { 5: 0.9, 4: 0.15 } },
    title: 'Copiar del mensaje del usuario',
    body: (
      <>
        Para el valor, el modelo "mira" hacia atrás y copia el número del mensaje de Camila. Las flechas ilustran ese patrón de copia: el token <code>482</code> del
        usuario concentra la atención. Los números suelen partirse en grupos de dígitos.
      </>
    ),
  },
  {
    token: '1',
    kind: 'arg',
    cands: [
      { t: '1', p: 0.975, kind: 'arg' },
      { t: '"', p: 0.015, kind: 'arg' },
      { t: '0', p: 0.01, kind: 'arg' },
    ],
    att: { u: { 6: 0.85, 5: 0.2 } },
    title: 'Sigue copiando',
    body: (
      <>
        El siguiente fragmento es <code>1</code>. Si el usuario no hubiera escrito un número, aquí aparecería el riesgo: el modelo podría <strong>inventar</strong>{' '}
        uno con tal de completar el campo obligatorio.
      </>
    ),
  },
  {
    token: '"}',
    kind: 'arg',
    cands: [
      { t: '"}', p: 0.99, kind: 'arg' },
      { t: '", "', p: 0.01, kind: 'arg' },
    ],
    att: { t: { 0: 0.5 } },
    title: 'Cerrar el JSON',
    body: <>El esquema solo pide <code>pedido_id</code>, así que lo más probable es cerrar el objeto.</>,
  },
  {
    token: '</tool_call>',
    kind: 'special',
    cands: [
      { t: '</tool_call>', p: 0.995, kind: 'special' },
      { t: '(otros)', p: 0.005, kind: 'text' },
    ],
    att: {},
    title: 'Fin de la llamada → la generación se detiene',
    body: (
      <>
        El token de cierre funciona como señal de parada: el modelo deja de generar y espera un resultado. Ese es el origen de <code>stop_reason: "tool_use"</code>.
      </>
    ),
  },
]

const TOOL_USE_BLOCK = {
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'toolu_01HJq8V2rN5YtK', name: 'buscar_pedido', input: { pedido_id: '4821' } }],
}

const STEPS: StepInfo[] = [
  {
    title: 'El turno del asistente empieza vacío',
    body: (
      <>
        El prompt (system + herramientas + mensaje) ya está tokenizado. El modelo ahora debe predecir el primer token del turno del asistente. Abajo verás, en cada
        paso, los candidatos con su probabilidad y hacia dónde "mira" el modelo.
      </>
    ),
  },
  ...GEN.map((g) => ({ title: g.title, body: g.body })),
  {
    title: 'La API lo convierte en un bloque tool_use',
    body: (
      <>
        Los tokens crudos nunca te llegan. El servidor del proveedor detecta la llamada, <strong>parsea</strong> nombre y argumentos y te devuelve un bloque{' '}
        <code>tool_use</code> con JSON ya estructurado, más un <code>id</code> para enlazar el resultado. La "decisión" fue una secuencia de 8 predicciones.
      </>
    ),
  },
]

/* ----------------------------- SVG de atención ----------------------------- */

const CW = 7.3
const boxW = (t: string) => t.length * CW + 14
function layout(tokens: string[], x0: number, gap: number) {
  let x = x0
  return tokens.map((t) => {
    const w = boxW(t)
    const r = { t, x, w, cx: x + w / 2 }
    x += w + gap
    return r
  })
}

const GEN_TOKENS = GEN.map((g) => g.token)
const ROW_T = layout(TOOL_ROW, 12, 10)
const ROW_U = layout(USER_ROW, 12, 4)
const ROW_G = layout(GEN_TOKENS, 12, 5)
const Y_T = 34
const Y_U = 112
const Y_G = 222
const BH = 26

const GEN_TONE: Record<Gen['kind'], Tone> = { special: 'model', tool: 'tool', arg: 'data' }

function AttentionSvg({ k }: { k: number }) {
  // k = cantidad de tokens generados visibles; el último es el "actual"
  const cur = k > 0 && k <= GEN.length ? GEN[k - 1] : null
  const curBox = cur ? ROW_G[k - 1] : null
  const wT = cur?.att.t ?? {}
  const wU = cur?.att.u ?? {}
  const arcs: { x1: number; x2: number; y2: number; w: number; tone: Tone }[] = []
  if (curBox) {
    Object.entries(wT).forEach(([i, w]) => arcs.push({ x1: curBox.cx, x2: ROW_T[+i].cx, y2: Y_T + BH, w, tone: 'tool' }))
    Object.entries(wU).forEach(([i, w]) => arcs.push({ x1: curBox.cx, x2: ROW_U[+i].cx, y2: Y_U + BH, w, tone: 'user' }))
  }
  return (
    <svg className="decision-herramienta-att" viewBox="0 0 640 262" role="img" aria-label="Tokens del prompt, tokens generados y hacia dónde atiende el token actual">
      <text x={12} y={Y_T - 9} className="row-lbl">
        herramientas (nombres en el prompt)
      </text>
      <text x={12} y={Y_U - 9} className="row-lbl">
        mensaje del usuario
      </text>
      <text x={12} y={Y_G - 9} className="row-lbl">
        turno del asistente (generado)
      </text>
      {arcs.map((a, i) => {
        const y1 = Y_G
        const my = (y1 + a.y2) / 2
        return (
          <path
            key={`${k}-${i}`}
            d={`M${a.x1},${y1} C${a.x1},${my} ${a.x2},${my + 20} ${a.x2},${a.y2}`}
            className="arc"
            style={{ ['--tone' as string]: `var(--c-${a.tone})`, strokeWidth: 1 + a.w * 5, opacity: 0.25 + a.w * 0.75 }}
          />
        )
      })}
      {ROW_T.map((b, i) => {
        const w = wT[i] ?? 0
        return (
          <g key={b.t} className="tok" data-tone="tool" style={{ ['--w' as string]: w }}>
            <rect x={b.x} y={Y_T} width={b.w} height={BH} rx={6} className={w > 0 ? 'box is-att' : 'box'} />
            <text x={b.cx} y={Y_T + 17} textAnchor="middle">
              {b.t}
            </text>
          </g>
        )
      })}
      {ROW_U.map((b, i) => {
        const w = wU[i] ?? 0
        return (
          <g key={i} className="tok" data-tone="user" style={{ ['--w' as string]: w }}>
            <rect x={b.x} y={Y_U} width={b.w} height={BH} rx={6} className={w > 0 ? 'box is-att' : 'box'} />
            <text x={b.cx} y={Y_U + 17} textAnchor="middle">
              {b.t.replace(/ /g, '·')}
            </text>
          </g>
        )
      })}
      {ROW_G.map((b, i) => {
        if (i >= k) return null
        const isCur = i === k - 1 && k <= GEN.length
        return (
          <g key={i} className={`tok gen${isCur ? ' is-cur' : ''}`} data-tone={GEN_TONE[GEN[i].kind]}>
            <rect x={b.x} y={Y_G} width={b.w} height={BH} rx={6} className="box" />
            <text x={b.cx} y={Y_G + 17} textAnchor="middle">
              {b.t.replace(/ /g, '·')}
            </text>
          </g>
        )
      })}
      {k < GEN.length + 1 && (
        <rect x={(ROW_G[k]?.x ?? ROW_G[GEN.length - 1].x + ROW_G[GEN.length - 1].w + 5)} y={Y_G + 4} width={2} height={BH - 8} className="cursor" />
      )}
    </svg>
  )
}

export function TokenLab() {
  const player = usePlayer(STEPS.length, { interval: 3800 })
  const s = player.step
  const gen = s >= 1 && s <= GEN.length ? GEN[s - 1] : null
  const visible = Math.min(s, GEN.length)
  const joint = GEN.slice(0, visible).reduce((a, g) => a * g.cands.find((c) => c.t === g.token)!.p, 1)
  const raw = GEN_TOKENS.join('')
  return (
    <Lab title="La decisión, token a token" hint="Avanza paso a paso">
      <div className="decision-herramienta-q">
        <span className="label">usuario</span> ¿Dónde está mi pedido 4821?
      </div>
      <PlayerBar player={player} labels={STEPS.map((x) => x.title)} />
      <div className="decision-herramienta-token-grid">
        <div className="stack" style={{ gap: 10 }}>
          <AttentionSvg k={s === STEPS.length - 1 ? GEN.length + 1 : visible} />
          <Narration steps={STEPS} step={s} />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {gen ? (
            <Panel title={`candidatos · token ${s}`} tone="model" right={<span className="mono small">elegido: {gen.token}</span>}>
              <div className="stack anim-fade" key={s} style={{ gap: 6 }}>
                {gen.cands.map((c) => (
                  <BarRow
                    key={c.t}
                    label={c.t}
                    value={c.p}
                    display={c.p < 0.01 ? c.p.toFixed(3) : c.p.toFixed(2)}
                    tone={c.kind === 'text' ? 'user' : c.kind === 'special' ? 'model' : c.kind === 'tool' ? 'tool' : 'data'}
                    pick={c.t === gen.token}
                  />
                ))}
              </div>
              {s === 1 && (
                <div className="decision-herramienta-split small">
                  <span data-tone="user">texto directo: {(1 - 0.86).toFixed(2)}</span>
                  <span data-tone="model">llamar herramienta: 0.86</span>
                </div>
              )}
            </Panel>
          ) : s === 0 ? (
            <Panel title="próximo token" tone="model">
              <p className="small" style={{ margin: 0 }}>
                El modelo calcula una distribución sobre <strong>todo su vocabulario</strong> (~100–200 mil tokens). Mostraremos solo los candidatos más probables.
              </p>
            </Panel>
          ) : (
            <div className="stack anim-fade" style={{ gap: 6 }}>
              <Panel title="tokens generados (crudo, ilustrativo)" tone="model">
                <div className="mono small decision-herramienta-raw">{raw}</div>
              </Panel>
              <div className="decision-herramienta-down">
                <ArrowDown size={18} /> el servidor parsea y valida
              </div>
              <Code code={JSON.stringify(TOOL_USE_BLOCK, null, 2)} lang="json" title="lo que recibe tu código" highlight={[2, 5, 6, 7, 8]} />
            </div>
          )}
          <div className="row small" style={{ gap: 8 }}>
            <Pill tone="model" mono>
              P(secuencia) = {joint.toFixed(3)}
            </Pill>
            <span className="muted">producto de las probabilidades elegidas</span>
          </div>
        </div>
      </div>
    </Lab>
  )
}
