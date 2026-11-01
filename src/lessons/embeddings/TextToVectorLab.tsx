import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Box } from 'lucide-react'
import { Lab, Pill, Segmented, TokenChips, VectorStrip } from '../../components/ui'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { VectorMap } from '../../components/VectorMap'
import { usePlayer } from '../../lib/hooks'
import { analyze, cellColor, CONCEPTS, DIM_LABELS, embed, project } from '../../sim/embed'
import { norm } from '../../sim/math'
import { CORPUS, rawEmbed, toneOf, toyTokens } from './data'

const OPTIONS = [
  { value: 'a', text: '¿Cuánto demora el reembolso si pagué con tarjeta?' },
  { value: 'b', text: 'Me llegó la polera con una falla' },
  { value: 'c', text: 'No puedo ingresar, olvidé la clave' },
] as const
type Opt = (typeof OPTIONS)[number]['value']

/** Revela `total` elementos de a uno mientras `active` sea true. */
function useReveal(active: boolean, total: number, ms: number) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) {
      setN(0)
      return
    }
    setN(0)
    const t = setInterval(() => setN((x) => (x >= total ? x : x + 1)), ms)
    return () => clearInterval(t)
  }, [active, total, ms])
  return n
}

export function TextToVectorLab() {
  const [opt, setOpt] = useState<Opt>('a')
  const text = OPTIONS.find((o) => o.value === opt)!.text
  const tokens = toyTokens(text)
  const { scores, hits } = analyze(text)
  const raw = rawEmbed(text)
  const rawNorm = norm(raw)
  const unit = embed(text)
  const xy = project(text)

  const steps: StepInfo[] = [
    { title: 'Empieza con texto', body: 'Una consulta de cliente, tal cual llega. Para el computador todavía es solo una secuencia de caracteres.' },
    {
      title: 'Se corta en tokens',
      body: (
        <>
          El tokenizador divide el texto en {tokens.length} piezas con un ID cada una. Las palabras largas se parten en subpalabras. (Tokenizador simplificado: el detalle está en la lección{' '}
          <Link to="/leccion/tokens">Tokens</Link>.)
        </>
      ),
    },
    {
      title: 'El modelo procesa los tokens (caja negra)',
      body: 'Un modelo de embeddings (un transformer) lee todos los tokens juntos, considera el contexto y “resume” la frase entera. Nadie programa a mano qué significa cada dimensión: el modelo las aprende.',
    },
    {
      title: 'Sale un vector de 16 números',
      body: 'El resultado es una lista fija de números, sin importar el largo del texto. En nuestro modelo didáctico las 12 primeras dimensiones miden conceptos y las 4 últimas son “matices”. En un modelo real son entre 768 y 3072 dimensiones que nadie puede leer una por una.',
    },
    {
      title: 'Se normaliza a largo 1',
      body: (
        <>
          Se divide cada número por el largo del vector (‖v‖ = {rawNorm.toFixed(3)}). Así todos los vectores miden 1 y solo importa hacia dónde apuntan: la dirección es el
          significado.
        </>
      ),
    },
    {
      title: 'Un punto en el mapa',
      body: 'Para dibujarlo se proyectan las 16 dimensiones a 2 (como hacen UMAP o PCA). La proyección pierde información: sirve para mirar, pero la búsqueda real se hace con el vector completo.',
    },
  ]
  const player = usePlayer(steps.length, { interval: (s) => (s === 3 ? 3600 : 2800) })
  const s = player.step
  const revealed = useReveal(s === 3, 16, 140)
  const shown = s > 3 ? 16 : revealed

  return (
    <Lab title="De texto a vector, paso a paso" hint="Dale play o avanza con las flechas">
      <div className="stack">
        <div className="row">
          <Segmented
            options={OPTIONS.map((o) => ({ value: o.value, label: o.text.length > 28 ? o.text.slice(0, 26) + '…' : o.text }))}
            value={opt}
            onChange={(v) => {
              setOpt(v)
              player.reset()
            }}
          />
        </div>
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
        <Narration steps={steps} step={s} />

        <div className="embeddings-stage">
          {s === 0 && (
            <div className="embeddings-quote anim-in" key={opt}>
              “{text}”
            </div>
          )}

          {s === 1 && (
            <div className="stack anim-fade">
              <div className="embeddings-quote" style={{ fontSize: 16 }}>
                “{text}”
              </div>
              <TokenChips tokens={tokens} />
            </div>
          )}

          {s === 2 && (
            <div className="embeddings-blackbox anim-fade">
              <TokenChips tokens={tokens} showIds={false} />
              <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
                <ArrowRight className="arrow" size={20} color="var(--text-3)" />
              </div>
              <div className="embeddings-model">
                <div className="row" style={{ gap: 6 }}>
                  <Box size={16} color="var(--c-data)" />
                  <b className="small">Modelo de embeddings</b>
                </div>
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="layer" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
                <div className="small muted">capas de atención → 1 vector</div>
                <div className="small" style={{ marginTop: 6 }}>
                  Lo que detecta nuestro modelo didáctico:
                </div>
                <div className="row" style={{ gap: 5 }}>
                  {CONCEPTS.map((c, i) =>
                    scores[i] > 0 ? (
                      <Pill key={c.id} tone={toneOf(i)}>
                        {c.label}: {hits[i].join(', ')}
                      </Pill>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          )}

          {s === 3 && (
            <div className="stack">
              <div className="embeddings-cells">
                {raw.map((x, i) => (
                  <div key={i} className={`embeddings-cellbox${i >= shown ? ' is-empty' : ''}${i === shown - 1 ? ' is-new' : ''}`}>
                    <span className="k" title={DIM_LABELS[i]}>
                      {i}·{DIM_LABELS[i]}
                    </span>
                    <span className="sw" style={{ background: i < shown ? cellColor(x) : 'var(--bg-inset)' }} />
                    <span className="n">{i < shown ? x.toFixed(3) : '…'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {s === 4 && (
            <div className="stack anim-fade">
              <div className="embeddings-norm">
                <span className="label">Crudo</span>
                <VectorStrip values={raw} labels={DIM_LABELS} />
                <span className="mono">‖v‖ = {rawNorm.toFixed(3)}</span>
                <span className="label">÷ ‖v‖</span>
                <VectorStrip values={unit} labels={DIM_LABELS} />
                <span className="mono" style={{ color: 'var(--c-data)', fontWeight: 600 }}>
                  ‖v‖ = {norm(unit).toFixed(3)}
                </span>
              </div>
              <div className="mono small muted" style={{ overflowWrap: 'anywhere' }}>
                [{unit.map((x) => x.toFixed(3)).join(', ')}]
              </div>
            </div>
          )}

          {s === 5 && (
            <div className="anim-fade">
              <VectorMap
                points={CORPUS.map((p) => ({ id: p.id, x: p.xy[0], y: p.xy[1], tone: toneOf(p.concept), dim: true, r: 5.5, tip: p.text }))}
                query={{ x: xy[0], y: xy[1], label: '16 dims → 2D' }}
                ariaLabel="La frase proyectada como punto en el mapa semántico"
              />
            </div>
          )}
        </div>
      </div>
    </Lab>
  )
}
