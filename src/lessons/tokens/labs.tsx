import { useMemo, useState } from 'react'
import { BarRow, Lab, Panel, Pill, Segmented, Stat, TokenChips, VectorStrip, type Tone, type TokenView } from '../../components/ui'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { fmt, fmtInt, fmtUsd, hashString, rng } from '../../sim/math'
import { PRICING } from '../../sim/scenario'
import { BPE_CORPUS, encodeWithRules, trainBpe } from './bpe'
import { PAIRS, PRESETS, VOCAB_SIZE, idOf, tokenize, type Tok } from './tokenizer'

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                  */
/* -------------------------------------------------------------------------- */

/** Colorea por tipo: tokens normales alternan usuario/modelo, números en tool, bytes en guard. */
export function toChips(toks: Tok[], showIds = true): TokenView[] {
  let alt = 0
  return toks.map((t) => {
    let tone: Tone
    if (t.kind === 'byte') tone = 'guard'
    else if (t.kind === 'num') tone = 'tool'
    else if (t.kind === 'space') tone = 'system'
    else tone = alt++ % 2 === 0 ? 'user' : 'model'
    return { text: t.text, id: showIds ? t.id : undefined, tone }
  })
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)
const costOf = (n: number) => (n * PRICING.inputPerM) / 1_000_000

function Legend() {
  return (
    <div className="tokens-legend small muted">
      <span>
        <i data-tone="user" />
        <i data-tone="model" /> palabra o subpalabra
      </span>
      <span>
        <i data-tone="tool" /> grupo de dígitos
      </span>
      <span>
        <i data-tone="guard" /> byte UTF-8 (fallback)
      </span>
      <span>
        <i data-tone="system" /> espacio suelto
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 1 · Tokenizador en vivo                                                 */
/* -------------------------------------------------------------------------- */

export function TokenizerLab() {
  const [mode, setMode] = useState<'libre' | 'idiomas'>('libre')
  const [text, setText] = useState(PRESETS[0].text)
  const [showIds, setShowIds] = useState(true)
  const toks = useMemo(() => tokenize(text), [text])
  const chars = Array.from(text).length
  const bytes = new TextEncoder().encode(text).length
  const nBytes = toks.filter((t) => t.kind === 'byte').length

  return (
    <Lab
      title="Tokenizador en vivo"
      hint="Escribe o elige un ejemplo"
      footer={
        <span className="small muted">
          Tokenizador simulado: vocabulario hecho a mano de {fmtInt(VOCAB_SIZE)} tokens con coincidencia voraz y fallback a bytes. Los cortes se
          parecen a los de un BPE real, pero los IDs no son los de ningún modelo.
        </span>
      }
    >
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'libre', label: 'Texto libre' },
              { value: 'idiomas', label: 'Español vs inglés' },
            ]}
          />
          {mode === 'libre' && (
            <label className="row small" style={{ gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} /> mostrar IDs
            </label>
          )}
        </div>

        {mode === 'libre' ? (
          <>
            <div className="row" style={{ gap: 6 }}>
              {PRESETS.map((p) => (
                <button key={p.id} className={`btn btn-sm${p.text === text ? ' btn-primary' : ''}`} onClick={() => setText(p.text)}>
                  {p.label}
                </button>
              ))}
            </div>
            <textarea className="textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Texto a tokenizar" spellCheck={false} />
            <div className="tokens-box">
              {toks.length ? <TokenChips tokens={toChips(toks, showIds)} /> : <span className="muted small">Escribe algo arriba…</span>}
            </div>
            <Legend />
            <div className="tokens-stats">
              <Stat label="caracteres" value={fmtInt(chars)} sub={`${fmtInt(bytes)} bytes UTF-8`} />
              <Stat label="palabras" value={fmtInt(words(text))} />
              <Stat label="tokens" value={fmtInt(toks.length)} tone="model" sub={nBytes ? `${nBytes} son bytes sueltos` : 'sin bytes sueltos'} />
              <Stat label="caract. / token" value={toks.length ? fmt(chars / toks.length, 2) : '—'} sub="inglés ≈ 4 · español ≈ 3" />
              <Stat
                label="costo como input"
                value={fmtUsd(costOf(toks.length))}
                tone="tool"
                sub={`× 1 millón de mensajes = US$ ${fmtInt(toks.length * PRICING.inputPerM)}`}
              />
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Lo que realmente recibe el modelo
              </div>
              <div className="tokens-ids mono">[{toks.map((t) => t.id).join(', ')}]</div>
            </div>
          </>
        ) : (
          <LanguageCompare />
        )}
      </div>
    </Lab>
  )
}

function LanguageCompare() {
  const rows = PAIRS.map((p) => ({ ...p, tes: tokenize(p.es), ten: tokenize(p.en) }))
  const totEs = rows.reduce((s, r) => s + r.tes.length, 0)
  const totEn = rows.reduce((s, r) => s + r.ten.length, 0)
  return (
    <div className="stack">
      {rows.map((r, i) => {
        const extra = r.tes.length / r.ten.length - 1
        return (
          <div key={i} className="tokens-pair anim-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="tokens-pair-row">
              <Pill tone="user" mono>
                ES · {r.tes.length}
              </Pill>
              <TokenChips tokens={toChips(r.tes, false)} />
            </div>
            <div className="tokens-pair-row">
              <Pill tone="system" mono>
                EN · {r.ten.length}
              </Pill>
              <TokenChips tokens={toChips(r.ten, false)} />
            </div>
            <div className="small muted">
              El español usa <b className="tokens-hot">+{Math.round(extra * 100)}%</b> tokens para decir lo mismo.
            </div>
          </div>
        )
      })}
      <div className="tokens-stats">
        <Stat label="tokens en español" value={totEs} tone="user" />
        <Stat label="tokens en inglés" value={totEn} />
        <Stat label="sobrecosto" value={`+${Math.round((totEs / totEn - 1) * 100)}%`} tone="tool" sub="mismo precio por token, más tokens" />
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        ¿Por qué? Los tokenizadores se entrenan con corpus donde el inglés domina: sus palabras frecuentes quedan como un token entero, mientras que
        «pedido» o «necesito» se arman con dos piezas. Las tildes y la «ñ» también tienden a quedar en tokens aparte.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 2 · Entrenamiento BPE paso a paso                                       */
/* -------------------------------------------------------------------------- */

const BPE_STATES = trainBpe(BPE_CORPUS, 12)

function bpeNarration(): StepInfo[] {
  return BPE_STATES.map((s, k) => {
    if (k === 0) {
      const p = s.pairs[0]
      return {
        title: 'Punto de partida: solo caracteres',
        body: (
          <>
            El vocabulario son los <b>{s.vocab.length} caracteres</b> que aparecen en el corpus y cada palabra está cortada letra por letra: el corpus
            completo suma <b>{s.totalTokens} tokens</b>. Contamos cada par de símbolos vecinos ponderando por la frecuencia de la palabra. El más
            común es «{p.a}» + «{p.b}» ({p.count} veces).
          </>
        ),
      }
    }
    const m = s.merge!
    const tok = m.a + m.b
    const inWords = s.parts.filter((p) => p.includes(tok)).length
    const whole = BPE_CORPUS.some((c) => c.word === tok)
    const prev = BPE_STATES[k - 1].totalTokens
    return {
      title: `Merge ${k}: «${m.a}» + «${m.b}» → «${tok}»`,
      body: (
        <>
          Es el par más frecuente ({m.count} apariciones). Se agrega la regla al vocabulario ({s.vocab.length} símbolos) y se re-segmenta todo: el
          corpus baja de {prev} a <b>{s.totalTokens} tokens</b>.{' '}
          {whole
            ? `¡«${tok}» ya es una palabra completa! Las palabras muy frecuentes terminan siendo un solo token.`
            : inWords >= 3
              ? `«${tok}» aparece en ${inWords} palabras distintas: es una pieza reutilizable (como un sufijo).`
              : k > 1 && BPE_STATES[k - 1].vocab.includes(m.a) && m.a.length > 1
                ? `Fíjate que fusiona un símbolo que ya era un merge: así crecen las piezas largas.`
                : ''}
        </>
      ),
    }
  })
}

export function BpeLab() {
  const steps = useMemo(bpeNarration, [])
  const player = usePlayer(BPE_STATES.length, { interval: 2600 })
  const s = BPE_STATES[player.step]
  const newTok = s.merge ? s.merge.a + s.merge.b : null
  const learned = new Set(s.rules.map((r) => r.a + r.b))
  const [probe, setProbe] = useState('reenviado')
  const probeParts = encodeWithRules(probe.toLowerCase().slice(0, 24), s.rules)
  const top = s.pairs.slice(0, 6)
  const maxCount = top[0]?.count ?? 1

  const chip = (t: string): TokenView => ({ text: t, tone: t === newTok ? 'model' : learned.has(t) ? 'data' : 'system' })

  return (
    <Lab title="BPE aprendiendo su vocabulario" hint="Dale play o avanza merge a merge" badge="Lab animado">
      <div className="stack">
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
        <div className="split">
          <Panel title="Corpus (palabra × frecuencia)" tone="data" right={<span className="mono small">{s.totalTokens} tokens</span>}>
            <div className="tokens-bpe-words">
              {BPE_CORPUS.map((c, i) => {
                const parts = s.parts[i]
                const hit = newTok !== null && parts.includes(newTok)
                return (
                  <div key={c.word} className={`tokens-bpe-word${hit ? ' is-hit' : ''}`}>
                    <TokenChips tokens={parts.map(chip)} showIds={false} />
                    <span className="mono small muted">×{c.freq}</span>
                  </div>
                )
              })}
            </div>
            <div className="tokens-legend small muted" style={{ marginTop: 8 }}>
              <span>
                <i data-tone="system" /> carácter
              </span>
              <span>
                <i data-tone="data" /> token aprendido
              </span>
              <span>
                <i data-tone="model" /> recién fusionado
              </span>
            </div>
          </Panel>
          <div className="stack">
            <Panel title={player.step === 0 ? 'Pares más frecuentes' : `Pares contados antes del merge ${player.step}`} tone="model">
              <div className="stack" style={{ gap: 6 }}>
                {top.map((p, i) => (
                  <BarRow
                    key={p.a + '|' + p.b}
                    label={`${p.a} + ${p.b}`}
                    value={p.count}
                    max={maxCount}
                    display={String(p.count)}
                    tone={i === 0 ? 'model' : 'system'}
                    pick={i === 0 && player.step > 0}
                  />
                ))}
              </div>
            </Panel>
            <Panel title="Reglas de merge (en orden)" tone="data" right={<span className="mono small">vocab: {s.vocab.length}</span>}>
              {s.rules.length === 0 ? (
                <span className="small muted">Todavía ninguna. Vocabulario inicial: {s.vocab.join(' ')}</span>
              ) : (
                <ol className="tokens-rules">
                  {s.rules.map((r, i) => (
                    <li key={i} className={i === s.rules.length - 1 ? 'is-new' : ''}>
                      <span className="mono">
                        {r.a} + {r.b}
                      </span>{' '}
                      → <b className="mono">{r.a + r.b}</b>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
        <Narration steps={steps} step={player.step} />
        <div className="tokens-probe">
          <label className="label" htmlFor="tokens-probe">
            Prueba una palabra nueva con las reglas aprendidas hasta este paso
          </label>
          <div className="row">
            <input id="tokens-probe" className="input" style={{ maxWidth: 220 }} value={probe} onChange={(e) => setProbe(e.target.value)} />
            <TokenChips tokens={probeParts.map(chip)} showIds={false} />
            <span className="mono small muted">{probeParts.length} tokens</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {['reenviado', 'pedidito', 'cambiada', 'xilófono'].map((w) => (
              <button key={w} className="btn btn-sm btn-ghost" onClick={() => setProbe(w)}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Lab>
  )
}

/* -------------------------------------------------------------------------- */
/* Lab 3 · IDs → filas de la matriz de embeddings                              */
/* -------------------------------------------------------------------------- */

const EMB_DIMS = 12
const EMB_SENTENCE = '¿Dónde está mi pedido?'
const EMB_TOKS = tokenize(EMB_SENTENCE)
const FILLERS = [' the', ' de', 'ción', ' order', ' gracias', 'ado', ' la']

function embRow(text: string): number[] {
  const r = rng(hashString('emb:' + text))
  return Array.from({ length: EMB_DIMS }, () => Math.round((r() * 2 - 1) * 0.6 * 100) / 100)
}

type MatRow = { id: number; text: string; vec: number[] }
const MATRIX: MatRow[] = (() => {
  const seen = new Map<number, MatRow>()
  for (const t of [...EMB_TOKS.map((x) => x.text), ...FILLERS]) {
    const id = idOf(t)
    if (!seen.has(id)) seen.set(id, { id, text: t, vec: embRow(t) })
  }
  return [...seen.values()].sort((a, b) => a.id - b.id)
})()

const EMB_STEPS: StepInfo[] = [
  {
    title: 'Texto → tokens → IDs',
    body: (
      <>
        La frase se corta en <b>{EMB_TOKS.length} tokens</b> y cada uno se reemplaza por su ID. Desde aquí el modelo solo maneja números enteros.
      </>
    ),
  },
  ...EMB_TOKS.map((t, i) => ({
    title: `Posición ${i}: buscar la fila ${t.id}`,
    body: (
      <>
        El ID <span className="mono">{t.id}</span> («{t.text.replace(/ /g, '·')}») es solo un <b>índice</b>: el modelo toma la fila {t.id} de la
        matriz de embeddings y la copia a la posición {i} de la secuencia.
        {i === 0 ? ' No hay cálculo: es una búsqueda en una tabla.' : ''}
        {t.text === 'ido' ? ' «ped» e «ido» tienen vectores distintos: el significado de «pedido» se arma después, en las capas de atención.' : ''}
      </>
    ),
  })),
  {
    title: `Resultado: una matriz de ${EMB_TOKS.length} × d`,
    body: (
      <>
        Entra al modelo una secuencia de {EMB_TOKS.length} vectores. Aquí d = {EMB_DIMS} para que se vea; en modelos reales son miles de
        dimensiones. Además el modelo necesita el orden: según la arquitectura se suma un vector de posición o se codifica dentro de la atención.
      </>
    ),
  },
]

export function EmbeddingLab() {
  const player = usePlayer(EMB_STEPS.length, { interval: 1700 })
  const step = player.step
  const cur = step >= 1 && step <= EMB_TOKS.length ? step - 1 : -1
  const done = step === 0 ? 0 : Math.min(step, EMB_TOKS.length)
  const curId = cur >= 0 ? EMB_TOKS[cur].id : -1
  const usedIds = new Set(EMB_TOKS.slice(0, done).map((t) => t.id))

  const chips: TokenView[] = EMB_TOKS.map((t, i) => ({
    text: t.text,
    id: t.id,
    tone: i === cur ? 'model' : i < done ? 'data' : 'system',
  }))

  return (
    <Lab title="De IDs a vectores: la tabla de embeddings" hint="Avanza token por token" badge="Lab animado">
      <div className="stack">
        <PlayerBar player={player} labels={EMB_STEPS.map((s) => s.title)} />
        <div className="tokens-box">
          <div className="label" style={{ marginBottom: 6 }}>
            «{EMB_SENTENCE}»
          </div>
          <TokenChips tokens={chips} />
        </div>
        <div className="split">
          <Panel title="Matriz de embeddings E" tone="data" right={<span className="mono small">vocab × d</span>}>
            <div className="tokens-mat" role="table" aria-label="Filas de la matriz de embeddings">
              <div className="tokens-mat-gap mono">
                filas 0–255: bytes · <span className="muted">⋮</span>
              </div>
              {MATRIX.map((r, i) => {
                const gap = i === 0 ? r.id - 256 : r.id - MATRIX[i - 1].id - 1
                return (
                  <div key={r.id}>
                    {gap > 0 && <div className="tokens-mat-gap mono">⋮ {fmtInt(gap)} filas</div>}
                    <div className={`tokens-mat-row${r.id === curId ? ' is-hl' : usedIds.has(r.id) ? ' is-used' : ''}`} role="row">
                      <span className="mono tokens-mat-id">{r.id}</span>
                      <span className="mono tokens-mat-tok">{r.text.replace(/ /g, '·')}</span>
                      <VectorStrip values={r.vec} size="sm" />
                    </div>
                  </div>
                )
              })}
              <div className="tokens-mat-gap mono">⋮ hasta ~100.000–200.000 filas en modelos reales</div>
            </div>
          </Panel>
          <Panel title="Secuencia que entra al modelo" tone="model" right={<span className="mono small">{done} × {EMB_DIMS}</span>}>
            {done === 0 ? (
              <span className="small muted">Vacía. Avanza para ir copiando filas.</span>
            ) : (
              <div className="tokens-seq">
                {EMB_TOKS.slice(0, done).map((t, i) => (
                  <div key={i} className={`tokens-seq-row${i === cur ? ' is-new' : ''}`}>
                    <span className="mono small muted">{i}</span>
                    <span className="mono tokens-mat-tok">{t.text.replace(/ /g, '·')}</span>
                    <VectorStrip values={embRow(t.text)} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <Narration steps={EMB_STEPS} step={step} />
      </div>
    </Lab>
  )
}
