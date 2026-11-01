import { useMemo, useState, type ReactNode } from 'react'
import { Check, CornerDownLeft, X } from 'lucide-react'
import { Lab, Panel, Pill, Segmented, Slider, VectorStrip, BarRow } from '../../components/ui'
import { Code, linesOf } from '../../components/Code'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { VectorMap, type MapLink, type MapPoint } from '../../components/VectorMap'
import { usePlayer, useTypewriter } from '../../lib/hooks'
import { KB_INDEX, SAMPLE_QUERIES, type KbChunk } from '../../sim/corpus'
import { CONCEPTS, DIM_LABELS, analyze, embed, project, vecToString, type Embedded } from '../../sim/embed'
import { cosine, countTokens } from '../../sim/math'
import { generateAnswer } from './answers'

export const SYSTEM_RAG = `Eres Andi, asistente de Andes Market.
Responde SOLO con la información de <documentos>.
Cita cada afirmación con [n]. Si la respuesta no está, dilo.`

const CODE = `def responder(pregunta: str, k: int = 3, umbral: float = 0.45):
    # 1) la pregunta se convierte en vector (MISMO modelo que indexó los chunks)
    q = embed(pregunta)
    q = q / np.linalg.norm(q)          # 2) vector unitario: un punto en el espacio

    # 3) similitud coseno contra TODOS los chunks (M es una matriz N×d)
    scores = M @ q

    # 4) los k más parecidos
    top = np.argsort(-scores)[:k]

    # 5) descarta lo que no supera el umbral
    hits = [(chunks[i], scores[i]) for i in top if scores[i] >= umbral]
    if not hits:
        return "No encontré eso en la base de conocimiento."

    # 6) prompt aumentado: instrucciones + documentos + pregunta
    contexto = "\\n".join(
        f'<doc id="{n}" fuente="{c["fuente"]}">{c["texto"]}</doc>'
        for n, (c, _) in enumerate(hits, start=1)
    )
    resp = client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=400,
        system=SYSTEM_RAG,
        messages=[{"role": "user",
                   "content": f"<documentos>\\n{contexto}\\n</documentos>\\n\\n{pregunta}"}],
    )
    # 7) respuesta con citas [n]
    return resp.content[0].text`

const CODE_LINES: number[][] = [
  linesOf(CODE, 'def responder'),
  linesOf(CODE, 'q = embed(pregunta)', '# 1)'),
  linesOf(CODE, 'np.linalg.norm'),
  linesOf(CODE, 'scores = M @ q', '# 3)'),
  linesOf(CODE, 'np.argsort', '# 4)'),
  linesOf(CODE, 'hits = [', 'if not hits', 'return "No encontré', '# 5)'),
  linesOf(CODE, 'contexto =', '<doc id=', 'enumerate(hits', '# 6)', 'join('),
  linesOf(CODE, 'client.messages.create', 'model=', 'max_tokens', 'system=SYSTEM_RAG', 'messages=[', '"content"', '    )', 'resp.content'),
]

type Ranked = { item: Embedded<KbChunk>; score: number }

function useRetrieval(query: string, k: number, threshold: number) {
  return useMemo(() => {
    const vec = embed(query)
    const xy = project(query)
    const ranked: Ranked[] = KB_INDEX.map((item) => ({ item, score: cosine(vec, item.vector) })).sort((a, b) => b.score - a.score)
    const top = ranked.slice(0, k)
    const passed = top.filter((r) => r.score >= threshold)
    const answer = generateAnswer(
      query,
      passed.map((p) => p.item),
    )
    return { vec, xy, ranked, top, passed, answer, analysis: analyze(query) }
  }, [query, k, threshold])
}

export function RagPipeline() {
  const [query, setQuery] = useState(SAMPLE_QUERIES[0])
  const [draft, setDraft] = useState('')
  const [k, setK] = useState(3)
  const [threshold, setThreshold] = useState(0.45)
  const [view, setView] = useState<'datos' | 'codigo'>('datos')
  const r = useRetrieval(query, k, threshold)

  const answerText = r.answer.parts.map((p) => (typeof p === 'number' ? `[${p}]` : p)).join('')
  const prompt = buildPrompt(query, r.passed)

  const steps: StepInfo[] = [
    {
      title: 'Llega la pregunta',
      body: (
        <>
          El usuario escribe en lenguaje natural. Del otro lado ya existe un índice con <strong>{KB_INDEX.length} chunks</strong> de la base de
          conocimiento, cada uno guardado como vector (los puntos verdes del mapa).
        </>
      ),
    },
    {
      title: 'La pregunta se convierte en vector',
      body: (
        <>
          Se llama al <strong>mismo modelo de embeddings</strong> que se usó para indexar los documentos. Resultado: {r.vec.length} números (en
          producción, 768–3072). Si usas otro modelo, las coordenadas no son comparables.
        </>
      ),
    },
    {
      title: 'Se ubica en el mapa',
      body: (
        <>
          El vector es un punto en el espacio semántico. Cae cerca de los chunks que hablan de lo mismo, aunque no compartan palabras. El mapa 2D es
          una proyección: sirve para intuir, pero la distancia real se mide en las {r.vec.length} dimensiones.
        </>
      ),
    },
    {
      title: `Se compara contra los ${KB_INDEX.length} chunks`,
      body: (
        <>
          Similitud coseno entre la consulta y cada chunk: {KB_INDEX.length} productos punto. Con millones de chunks esto sería lento, por eso los
          vector stores usan índices aproximados (lección HNSW).
        </>
      ),
    },
    {
      title: `Top-${k}: los ${k} vecinos más cercanos`,
      body: (
        <>
          Se ordenan por similitud y se quedan los <strong>{k}</strong> mejores. El #1 tiene coseno <strong>{r.top[0]?.score.toFixed(3)}</strong>
          {r.top[0] && <> ({r.top[0].item.id})</>}. Ojo: más parecido no siempre significa que contenga la respuesta.
        </>
      ),
    },
    {
      title: 'Filtro por umbral',
      body:
        r.passed.length === r.top.length ? (
          <>Todos los candidatos superan el umbral de {threshold.toFixed(2)}: pasan al prompt.</>
        ) : r.passed.length === 0 ? (
          <>
            Ningún candidato supera {threshold.toFixed(2)}. Mejor no inventar: el sistema responde que no tiene información, sin siquiera llamar
            al LLM.
          </>
        ) : (
          <>
            {r.top.length - r.passed.length} candidato(s) bajo {threshold.toFixed(2)} se descartan. Meter fragmentos irrelevantes gasta tokens y
            confunde al modelo.
          </>
        ),
    },
    {
      title: 'Se arma el prompt aumentado',
      body: (
        <>
          Los fragmentos se pegan en el mensaje con su fuente y un número para citar. El LLM nunca "consulta" la base: solo lee este texto (~
          {countTokens(prompt.system + prompt.user)} tokens).
        </>
      ),
    },
    {
      title: 'El LLM genera la respuesta con citas',
      body: (
        <>
          El modelo predice tokens condicionado por los documentos, así que puede responder con datos de Andes Market que nunca vio en su
          entrenamiento. Las citas [n] permiten verificar cada afirmación.
        </>
      ),
    },
  ]

  const player = usePlayer(steps.length, { interval: (s) => (s === 6 ? 3800 : 3200) })
  const s = player.step
  const typing = useTypewriter(answerText, s === 7, { cps: 70 })

  // ---------------- mapa
  const topIds = new Set(r.top.map((t) => t.item.id))
  const passedIds = new Set(r.passed.map((t) => t.item.id))
  const points: MapPoint[] = KB_INDEX.map((c) => {
    const n = r.passed.findIndex((p) => p.item.id === c.id) + 1
    return {
      id: c.id,
      x: c.xy[0],
      y: c.xy[1],
      tip: `${c.id} · ${c.text}`,
      tone: 'data',
      label: s >= 6 && n > 0 ? `[${n}] ${c.id}` : c.id,
      hl: (s === 4 && topIds.has(c.id)) || (s >= 5 && passedIds.has(c.id)),
      dim: (s === 4 && !topIds.has(c.id)) || (s >= 5 && !passedIds.has(c.id) && !(s === 5 && topIds.has(c.id))),
    }
  })
  let links: MapLink[] = []
  if (s === 3) links = r.ranked.map((x) => ({ from: r.xy, to: x.item.xy, tone: 'system' as const, dashed: true }))
  if (s === 4) links = r.top.map((x) => ({ from: r.xy, to: x.item.xy, tone: 'user' as const, label: x.score.toFixed(2) }))
  if (s === 5)
    links = r.top.map((x) => ({
      from: r.xy,
      to: x.item.xy,
      tone: x.score >= threshold ? ('data' as const) : ('error' as const),
      dashed: x.score < threshold,
      label: x.score.toFixed(2),
    }))
  if (s >= 6) links = r.passed.map((x) => ({ from: r.xy, to: x.item.xy, tone: 'data' as const }))

  const applyDraft = () => {
    const q = draft.trim()
    if (q) setQuery(q)
  }

  return (
    <Lab title="Una consulta RAG, paso a paso" hint="Dale play o cambia la consulta en cualquier paso">
      <div className="stack" style={{ gap: 14 }}>
        <div className="brag-queries">
          {SAMPLE_QUERIES.map((q) => (
            <button key={q} className={`brag-chip${q === query ? ' is-active' : ''}`} onClick={() => setQuery(q)}>
              {q}
            </button>
          ))}
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 280px', position: 'relative' }}>
            <input
              className="input"
              placeholder="…o escribe tu propia pregunta y presiona Enter"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyDraft()}
              aria-label="Pregunta personalizada"
            />
            <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 4, top: 5 }} onClick={applyDraft} aria-label="Usar pregunta">
              <CornerDownLeft size={14} />
            </button>
          </div>
          <Slider label="k (vecinos)" value={k} min={1} max={6} onChange={setK} style={{ flex: '1 1 140px' }} />
          <Slider label="umbral mínimo" value={threshold} min={0} max={0.9} step={0.05} onChange={setThreshold} format={(v) => v.toFixed(2)} style={{ flex: '1 1 140px' }} />
        </div>

        <div className="split">
          <div className="stack" style={{ gap: 8 }}>
            <VectorMap
              points={points}
              query={s >= 2 ? { x: r.xy[0], y: r.xy[1], label: 'tu pregunta' } : null}
              links={links}
              showLabels={s >= 4 ? 'hl' : 'none'}
              ariaLabel="Mapa de chunks de la base de conocimiento y la consulta"
            />
            <div className="small muted">
              Pasa el mouse sobre un punto para ver el chunk. Cada región es un "barrio" temático del espacio de embeddings.
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Pill tone="user">consulta: “{query.length > 38 ? query.slice(0, 38) + '…' : query}”</Pill>
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: 'datos', label: 'Datos' },
                  { value: 'codigo', label: 'Código' },
                ]}
              />
            </div>
            {view === 'codigo' ? (
              <Code code={CODE} lang="python" title="rag.py" highlight={CODE_LINES[s]} dim maxHeight={420} />
            ) : (
              <div key={s} className="anim-fade">
                <SidePanel step={s} r={r} query={query} k={k} threshold={threshold} prompt={prompt} typed={typing.shown} typingDone={typing.done} />
              </div>
            )}
          </div>
        </div>

        <Narration steps={steps} step={s} />
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
      </div>
    </Lab>
  )
}

function buildPrompt(query: string, passed: Ranked[]) {
  const docs = passed.map((p, i) => `<doc id="${i + 1}" fuente="${p.item.source}">${p.item.text}</doc>`)
  return { system: SYSTEM_RAG, docs, user: `<documentos>\n${docs.join('\n')}\n</documentos>\n\n${query}` }
}

function SidePanel({
  step,
  r,
  query,
  k,
  threshold,
  prompt,
  typed,
  typingDone,
}: {
  step: number
  r: ReturnType<typeof useRetrieval>
  query: string
  k: number
  threshold: number
  prompt: ReturnType<typeof buildPrompt>
  typed: string
  typingDone: boolean
}) {
  switch (step) {
    case 0:
      return (
        <Panel title="Entrada" tone="user">
          <div className="brag-bubble">{query}</div>
          <div className="row small muted" style={{ marginTop: 10 }}>
            <span>{query.length} caracteres</span>·<span>~{countTokens(query)} tokens</span>
          </div>
          <p className="small" style={{ color: 'var(--text-2)', margin: '10px 0 0' }}>
            El índice ya está listo: cada chunk se vectorizó al ingerir los documentos (lección <em>Ingesta</em>). Ahora solo falta vectorizar
            la pregunta.
          </p>
        </Panel>
      )
    case 1:
      return (
        <Panel title="embed(pregunta)" tone="data">
          <div className="stack" style={{ gap: 10 }}>
            <VectorStrip values={r.vec} labels={DIM_LABELS} />
            <div className="mono small" style={{ color: 'var(--text-2)', wordBreak: 'break-all' }}>
              {vecToString(r.vec, 8)}
            </div>
            <div className="label">Qué activó cada dimensión</div>
            <div className="row" style={{ gap: 6 }}>
              {CONCEPTS.map((c, i) =>
                r.analysis.hits[i].length ? (
                  <Pill key={c.id} tone="data">
                    {c.label}: {r.analysis.hits[i].join(', ')}
                  </Pill>
                ) : null,
              )}
              {r.analysis.hits.every((h) => h.length === 0) && <span className="small muted">Ninguna dimensión conceptual: queda cerca del centro.</span>}
            </div>
            <div className="small muted">Simulación didáctica: aquí las primeras 12 dimensiones son legibles; en un modelo real ninguna lo es.</div>
          </div>
        </Panel>
      )
    case 2: {
      const nearest = [...CONCEPTS].sort(
        (a, b) => Math.hypot(a.anchor[0] - r.xy[0], a.anchor[1] - r.xy[1]) - Math.hypot(b.anchor[0] - r.xy[0], b.anchor[1] - r.xy[1]),
      )[0]
      return (
        <Panel title="Posición en el mapa" tone="user">
          <div className="grid-2" style={{ gap: 10 }}>
            <div>
              <div className="label">Proyección 2D</div>
              <div className="mono" style={{ fontSize: 20 }}>
                ({r.xy[0].toFixed(1)}, {r.xy[1].toFixed(1)})
              </div>
            </div>
            <div>
              <div className="label">Barrio más cercano</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{nearest.label}</div>
            </div>
          </div>
          <p className="small" style={{ color: 'var(--text-2)', margin: '10px 0 0' }}>
            La estrella azul es tu pregunta. Prueba otra consulta: la estrella se mueve al barrio correspondiente.
          </p>
        </Panel>
      )
    }
    case 3:
      return (
        <Panel title={`cos(q, chunk) × ${r.ranked.length}`} tone="data" right={<span className="mono">{r.ranked.length} comparaciones</span>}>
          <div className="stack" style={{ gap: 5, maxHeight: 330, overflowY: 'auto' }}>
            {r.ranked.map((x) => (
              <BarRow key={x.item.id} label={x.item.id} value={Math.max(0, x.score)} display={x.score.toFixed(3)} tone="data" />
            ))}
          </div>
        </Panel>
      )
    case 4:
      return (
        <Panel title={`Ranking · top-${k}`} tone="data">
          <div className="stack" style={{ gap: 5 }}>
            {r.ranked.slice(0, k + 3).map((x, i) => (
              <BarRow key={x.item.id} label={`#${i + 1} ${x.item.id}`} value={Math.max(0, x.score)} display={x.score.toFixed(3)} tone="data" pick={i < k} off={i >= k} />
            ))}
          </div>
          <div className="brag-snippet">
            <span className="label">#1 · {r.top[0]?.item.source}</span>
            <div>{r.top[0]?.item.text}</div>
          </div>
        </Panel>
      )
    case 5:
      return (
        <Panel title={`umbral ≥ ${threshold.toFixed(2)}`} tone="guard">
          <div className="stack" style={{ gap: 6 }}>
            {r.top.map((x) => {
              const ok = x.score >= threshold
              return (
                <div key={x.item.id} className={`brag-filter${ok ? ' ok' : ' ko'}`}>
                  {ok ? <Check size={16} /> : <X size={16} />}
                  <span className="mono">{x.item.id}</span>
                  <span className="mono" style={{ marginLeft: 'auto' }}>
                    {x.score.toFixed(3)}
                  </span>
                </div>
              )
            })}
            {r.passed.length === 0 && <div className="small" style={{ color: 'var(--c-guard)' }}>Nada supera el umbral → respuesta "no sé", sin llamar al LLM.</div>}
          </div>
        </Panel>
      )
    case 6:
      return (
        <Panel title="Lo que recibe el LLM" tone="model" right={<span className="mono">~{countTokens(prompt.system + prompt.user)} tok</span>}>
          <PromptView system={prompt.system} docs={prompt.docs} query={query} />
        </Panel>
      )
    default:
      return (
        <Panel title="Respuesta" tone="model">
          <div className="brag-answer">
            <Cited text={typed} />
            {!typingDone && <span className="caret" />}
          </div>
          {typingDone && (
            <div className="stack anim-fade" style={{ gap: 6, marginTop: 12 }}>
              {r.passed.map((p, i) => (
                <div key={p.item.id} className="small" style={{ opacity: r.answer.cited.includes(p.item.id) ? 1 : 0.5 }}>
                  <span className="brag-cite">{i + 1}</span> <span className="mono">{p.item.source}</span>{' '}
                  <span className="muted">· actualizado {p.item.updated}</span>
                </div>
              ))}
              {r.answer.note && <div className="small" style={{ color: 'var(--c-guard)' }}>{r.answer.note}</div>}
            </div>
          )}
        </Panel>
      )
  }
}

/** Texto con marcas [n] convertidas en chips de cita. */
export function Cited({ text }: { text: string }) {
  const parts = text.split(/(\[\d\])/)
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d)\]$/)
        return m ? (
          <span key={i} className="brag-cite">
            {m[1]}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      })}
    </>
  )
}

export function PromptView({ system, docs, query, extra }: { system: string; docs: string[]; query: string; extra?: ReactNode }) {
  return (
    <div className="brag-prompt">
      <div className="brag-prompt-part" data-tone="system">
        <span className="brag-prompt-tag">system</span>
        {system}
      </div>
      <div className="brag-prompt-part" data-tone="user">
        <span className="brag-prompt-tag">user</span>
        <span className="muted">{'<documentos>'}</span>
        {docs.length === 0 && <div className="muted">(vacío)</div>}
        {docs.map((d, i) => (
          <div key={i} className="brag-prompt-doc">
            {d}
          </div>
        ))}
        <span className="muted">{'</documentos>'}</span>
        <div style={{ marginTop: 8, color: 'var(--c-user)', fontWeight: 600 }}>{query}</div>
      </div>
      {extra}
    </div>
  )
}
