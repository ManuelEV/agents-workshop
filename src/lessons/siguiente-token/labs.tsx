import { useState } from 'react'
import { ArrowRight, Dices, RotateCw, Shuffle } from 'lucide-react'
import { BarRow, Lab, Panel, Pill, Segmented, Slider, Stat, type Tone } from '../../components/ui'
import { Json } from '../../components/Code'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { fmt, pct, rng, sampleIndex, softmax, topPIndices } from '../../sim/math'
import { MODEL_ID } from '../../sim/scenario'
import { DISTS, FULL_ANSWER, GEN, PROMPT_TOOL, PROMPT_USER, STOP, TREE } from './data'

const show = (t: string) => (t === STOP ? '⏹ fin' : t.replace(/\n/g, '↵').replace(/ /g, '·'))
const argmax = (xs: number[]) => xs.reduce((b, x, i) => (x > xs[b] ? i : b), 0)
const fmtT = (v: number) => (v < 0.05 ? '≈0 (greedy)' : fmt(v, 2))

/* -------------------------------------------------------------------------- */
/* Lab 1 · Generación autoregresiva paso a paso                                */
/* -------------------------------------------------------------------------- */

function Pipeline() {
  const st = ['contexto', 'modelo', 'logits', 'softmax(T)', 'elegir 1 token', 'anexar']
  return (
    <div className="siguiente-token-pipe" aria-label="Ciclo de generación">
      {st.map((s, i) => (
        <span key={s} className="siguiente-token-pipe-item">
          <span className="siguiente-token-pipe-box" data-tone={i === 1 ? 'model' : i === 4 ? 'tool' : i === 5 ? 'data' : 'system'}>
            {s}
          </span>
          {i < st.length - 1 && <ArrowRight size={14} className="muted" />}
        </span>
      ))}
      <span className="siguiente-token-pipe-loop mono small">↺ repetir hasta ⏹ o max_tokens</span>
    </div>
  )
}

export function GenerationLab() {
  const total = GEN.length + 1
  const player = usePlayer(total, { interval: (s) => (s === 0 ? 2600 : 2200) })
  const [T, setT] = useState(1)
  const isFinal = player.step === GEN.length
  const k = Math.min(player.step, GEN.length - 1)
  const g = GEN[k]
  const probs = softmax(
    g.cands.map((c) => c.l),
    T,
  )
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a])
  const nShown = isFinal ? GEN.length : player.step + 1
  const out = GEN.slice(0, nShown).map((x) => x.cands[0].t)

  const steps: StepInfo[] = [
    ...GEN.map((x, i) => {
      const p = softmax(
        x.cands.map((c) => c.l),
        T,
      )[0]
      const c = x.cands[0].t
      return {
        title: c === STOP ? `Paso ${i + 1}: el token de fin de turno` : `Paso ${i + 1}: «${c.trim()}»`,
        body: (
          <>
            {x.note} Con T = {fmtT(T)} el elegido tiene <b>{pct(p)}</b> de probabilidad.
          </>
        ),
      }
    }),
    {
      title: 'Listo: stop_reason = "end_turn"',
      body: (
        <>
          Fueron {GEN.length} pasadas completas por el modelo, una por token, cada una viendo todo lo anterior. La API te entrega el texto y{' '}
          <span className="mono">"stop_reason": "end_turn"</span>. El token ⏹ no aparece en el texto.
        </>
      ),
    },
  ]

  return (
    <Lab title="Generando la respuesta token a token" hint="Reproduce y mueve la temperatura" badge="Lab animado">
      <div className="stack">
        <Pipeline />
        <PlayerBar player={player} labels={steps.map((s) => s.title)} />
        <div className="split">
          <Panel title="Contexto que ve el modelo" tone="user" right={<span className="mono small">{out.filter((t) => t !== STOP).length} tokens generados</span>}>
            <div className="siguiente-token-ctx">
              <div className="siguiente-token-ctx-line" data-tone="user">
                <span className="siguiente-token-role">user</span> {PROMPT_USER}
              </div>
              <div className="siguiente-token-ctx-line" data-tone="tool">
                <span className="siguiente-token-role">tool_result</span> <span className="mono small">{PROMPT_TOOL}</span>
              </div>
              <div className="siguiente-token-ctx-line" data-tone="model">
                <span className="siguiente-token-role">assistant</span>{' '}
                <span className="siguiente-token-out">
                  {out.map((t, i) => {
                    const isNew = !isFinal && i === out.length - 1
                    if (t === STOP)
                      return (
                        <span key={`${i}-${player.step}`} className={`siguiente-token-stop${isNew ? ' siguiente-token-fly' : ''}`}>
                          ⏹ end_turn
                        </span>
                      )
                    return (
                      <span key={isNew ? `${i}-${player.step}` : i} className={`siguiente-token-tok${isNew ? ' siguiente-token-fly' : ''}`}>
                        {t}
                      </span>
                    )
                  })}
                  {!isFinal && out[out.length - 1] !== STOP && <span className="caret" />}
                </span>
              </div>
            </div>
          </Panel>
          <Panel
            title={isFinal ? 'Respuesta final' : `Candidatos para el token ${k + 1}`}
            tone="model"
            right={<span className="mono small">T = {fmtT(T)}</span>}
          >
            {isFinal ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="siguiente-token-final">{FULL_ANSWER}</div>
                <div className="row">
                  <Pill tone="model" mono>
                    output_tokens: {GEN.length - 1}
                  </Pill>
                  <Pill tone="ok" mono>
                    stop_reason: end_turn
                  </Pill>
                </div>
              </div>
            ) : (
              <div className="siguiente-token-cands" key={player.step}>
                <div className="siguiente-token-cands-head label">
                  <span>logit</span>
                  <span>token → probabilidad</span>
                </div>
                {order.map((i) => (
                  <div key={g.cands[i].t} className="siguiente-token-cand anim-fade">
                    <span className="mono siguiente-token-logit">{g.cands[i].l.toFixed(1)}</span>
                    <BarRow label={show(g.cands[i].t)} value={probs[i]} display={pct(probs[i])} tone={i === 0 ? 'model' : 'system'} pick={i === 0} />
                  </div>
                ))}
                <div className="small muted">…y el resto del vocabulario (~100k tokens) con probabilidad casi nula.</div>
              </div>
            )}
          </Panel>
        </div>
        <Slider label="Temperatura (cambia las barras en vivo)" value={T} min={0} max={2} step={0.05} onChange={setT} format={fmtT} />
        <Narration steps={steps} step={player.step} />
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 2 · Temperatura + top-p + muestreo                                      */
/* -------------------------------------------------------------------------- */

export function SamplingLab() {
  const [distId, setDistId] = useState(DISTS[1].id)
  const [T, setT] = useState(1)
  const [p, setP] = useState(1)
  const [seed, setSeed] = useState(42)
  const [res, setRes] = useState<{ key: string; picks: number[]; seed: number } | null>(null)

  const d = DISTS.find((x) => x.id === distId) ?? DISTS[0]
  const logits = d.cands.map((c) => c.l)
  const probs = softmax(logits, T)
  const keep = topPIndices(probs, p)
  const keepSet = new Set(keep)
  const z = keep.reduce((s, i) => s + probs[i], 0)
  const greedy = T < 0.05
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a])
  const key = `${distId}|${T}|${p}`

  const sample = () => {
    const r = rng(seed)
    const ns = keep.map((i) => probs[i] / z)
    const picks = Array.from({ length: 20 }, () => (greedy ? argmax(probs) : keep[sampleIndex(ns, r())]))
    setRes({ key, picks, seed })
    setSeed((s) => s + 1)
  }

  const valid = res && res.key === key ? res : null
  const tally = d.cands.map((_, i) => valid?.picks.filter((x) => x === i).length ?? 0)

  return (
    <Lab title="Temperatura, top-p y muestreo" hint="Mueve los sliders y muestrea">
      <div className="stack">
        <Segmented value={distId} onChange={(v) => setDistId(v)} options={DISTS.map((x) => ({ value: x.id, label: x.label }))} />
        <div className="siguiente-token-context mono small">
          {d.context}
          <span className="siguiente-token-blank">___</span>
        </div>
        <div className="grid-2">
          <Slider label="Temperatura T" value={T} min={0} max={2} step={0.05} onChange={setT} format={fmtT} />
          <Slider label="top-p (núcleo)" value={p} min={0.1} max={1} step={0.05} onChange={setP} format={(v) => fmt(v, 2)} />
        </div>
        <div className="split">
          <Panel title="Distribución del siguiente token" tone="model" right={<span className="mono small">núcleo: {keep.length}/{d.cands.length}</span>}>
            <div className="stack" style={{ gap: 6 }}>
              {order.map((i) => (
                <BarRow
                  key={i}
                  label={show(d.cands[i].t)}
                  value={probs[i]}
                  display={pct(probs[i])}
                  tone={keepSet.has(i) ? 'model' : 'system'}
                  off={!keepSet.has(i)}
                  title={`logit ${d.cands[i].l}${keepSet.has(i) ? ` · tras top-p: ${pct(probs[i] / z)}` : ' · cortado por top-p'}`}
                />
              ))}
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              Atenuados: fuera del núcleo top-p (nunca se eligen). Los que quedan se re-normalizan para sumar 100%.
            </div>
          </Panel>
          <Panel
            title="20 muestras"
            tone="tool"
            right={
              <button className="btn btn-sm btn-primary" onClick={sample}>
                <Dices size={14} /> Muestrear 20 veces
              </button>
            }
          >
            {valid ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="siguiente-token-samples" key={valid.seed}>
                  {valid.picks.map((x, i) => (
                    <span key={i} className="siguiente-token-sample" style={{ animationDelay: `${i * 35}ms` }}>
                      {show(d.cands[x].t)}
                    </span>
                  ))}
                </div>
                {order
                  .filter((i) => tally[i] > 0)
                  .map((i) => (
                    <BarRow key={i} label={show(d.cands[i].t)} value={tally[i]} max={20} display={`${tally[i]}/20`} tone="tool" />
                  ))}
                <div className="small muted">
                  semilla {valid.seed} · {new Set(valid.picks).size} tokens distintos
                  {greedy ? ' · T≈0: siempre el más probable (greedy)' : ''}
                </div>
              </div>
            ) : (
              <span className="small muted">
                {res ? 'Cambiaste los parámetros: vuelve a muestrear.' : 'Presiona el botón para sacar 20 tokens con un generador aleatorio con semilla.'}
              </span>
            )}
          </Panel>
        </div>
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 3 · Mismo prompt, distintas corridas                                    */
/* -------------------------------------------------------------------------- */

type Piece = { t: string; p: number }

function runTree(T: number, seed: number): { pieces: Piece[]; prob: number } {
  const r = rng(seed)
  const pieces: Piece[] = []
  let node: string | null = 'root'
  let prob = 1
  while (node) {
    const cands: { t: string; l: number; next: string | null }[] = TREE[node]
    const probs = softmax(
      cands.map((c) => c.l),
      T,
    )
    const u = r()
    const idx = T < 0.05 ? argmax(probs) : sampleIndex(probs, u)
    pieces.push({ t: cands[idx].t, p: probs[idx] })
    prob *= probs[idx]
    node = cands[idx].next
  }
  return { pieces, prob }
}

const pieceTone = (p: number): Tone => (p >= 0.5 ? 'data' : p >= 0.2 ? 'user' : 'guard')

export function RunsLab() {
  const [T, setT] = useState(0.8)
  const [base, setBase] = useState(101)
  const runs = [0, 1, 2].map((i) => ({ seed: base + i * 17, ...runTree(T, base + i * 17) }))
  const texts = runs.map((r) =>
    r.pieces
      .filter((x) => x.t !== STOP)
      .map((x) => x.t)
      .join(''),
  )
  const distinct = new Set(texts).size

  return (
    <Lab title="Mismo prompt, tres corridas" hint="Cambia la temperatura o las semillas">
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Slider label="Temperatura" value={T} min={0} max={1.8} step={0.05} onChange={setT} format={fmtT} style={{ flex: '1 1 240px' }} />
          <button className="btn" onClick={() => setBase((b) => b + 53)}>
            <Shuffle size={15} /> Otras 3 semillas
          </button>
        </div>
        <div className="siguiente-token-context mono small">
          [user] ¿Cuándo llega mi pedido 4821? [tool_result] eta 2026-11-04 · Chilexpress · CX-99812-CL [assistant] ___
        </div>
        {runs.map((r, i) => (
          <div key={i} className="siguiente-token-run">
            <div className="siguiente-token-run-head">
              <span className="label">corrida {i + 1}</span>
              <span className="mono small muted">semilla {r.seed}</span>
              <span className="mono small" style={{ marginLeft: 'auto' }}>
                P(secuencia) = {pct(r.prob)}
              </span>
            </div>
            <div className="siguiente-token-pieces" key={`${T}-${r.seed}`}>
              {r.pieces.map((x, j) => (
                <span key={j} className="siguiente-token-piece" data-tone={x.t === STOP ? 'system' : pieceTone(x.p)} title={`p = ${pct(x.p)}`}>
                  <span className="siguiente-token-piece-t">{x.t === STOP ? '⏹' : x.t.trim()}</span>
                  <span className="siguiente-token-piece-p">{Math.round(x.p * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="row small">
          <Stat label="respuestas distintas" value={`${distinct} de 3`} tone={distinct === 1 ? 'ok' : 'tool'} />
          <span className="siguiente-token-legend muted">
            <i data-tone="data" /> p ≥ 50% <i data-tone="user" /> 20–50% <i data-tone="guard" /> &lt; 20% (sorpresa)
          </span>
        </div>
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 4 · max_tokens y stop_reason                                            */
/* -------------------------------------------------------------------------- */

export function StopLab() {
  const [max, setMax] = useState(16)
  const textToks = GEN.slice(0, -1).map((g) => g.cands[0].t)
  const ended = max >= textToks.length
  const shown = textToks.slice(0, Math.min(max, textToks.length))
  const text = shown.join('')
  const response = {
    id: 'msg_01AndiDemo',
    type: 'message',
    role: 'assistant',
    model: MODEL_ID,
    content: [{ type: 'text', text }],
    stop_reason: ended ? 'end_turn' : 'max_tokens',
    stop_sequence: null,
    usage: { input_tokens: 418, output_tokens: shown.length },
  }
  return (
    <Lab title="¿Por qué se detuvo?" hint="Baja max_tokens">
      <div className="stack">
        <Slider label="max_tokens" value={max} min={1} max={16} onChange={setMax} />
        <div className="siguiente-token-ctx-line" data-tone="model">
          <span className="siguiente-token-role">assistant</span>{' '}
          <span className="siguiente-token-out">
            {shown.map((t, i) => (
              <span key={i} className="siguiente-token-tok">
                {t}
              </span>
            ))}
            {ended ? <span className="siguiente-token-stop">⏹ end_turn</span> : <span className="siguiente-token-cut">✂ cortado</span>}
          </span>
        </div>
        <div className="split">
          <Json value={response} title="respuesta de la API (simulada)" />
          <div className="stack">
            <Stat
              label="stop_reason"
              value={response.stop_reason}
              tone={ended ? 'ok' : 'guard'}
              sub={ended ? 'el modelo eligió el token de fin' : 'se acabó el presupuesto de salida'}
            />
            <p className="small muted" style={{ margin: 0 }}>
              {ended
                ? 'La respuesta terminó sola. max_tokens es solo un tope: no hace que el modelo escriba más ni menos.'
                : 'El texto quedó a medias. El modelo no sabía del límite: simplemente se dejó de generar. Revisa siempre stop_reason antes de usar la respuesta.'}
            </p>
            <button className="btn btn-sm btn-ghost" onClick={() => setMax(ended ? 4 : 16)} style={{ alignSelf: 'flex-start' }}>
              <RotateCw size={14} /> {ended ? 'Probar con 4' : 'Volver a 16'}
            </button>
          </div>
        </div>
      </div>
    </Lab>
  )
}
