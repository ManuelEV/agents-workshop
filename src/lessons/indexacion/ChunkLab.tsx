import { Fragment, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react'
import { Lab, Segmented, Slider, Stat, type Tone } from '../../components/ui'
import { KB_DOCS } from '../../sim/corpus'
import { embed } from '../../sim/embed'
import { cosine, countTokens, fmtUsd } from '../../sim/math'
import { chunkBg, chunkDoc, chunkTone, EMBED_PRICE_LOW, type Strategy } from './data'

const DOC = KB_DOCS.find((d) => d.id === 'devoluciones')!
const QUESTION = '¿Cuánto demora el reembolso con tarjeta de crédito?'
const QV = embed(QUESTION)
const ANSWER = 'Con tarjeta de crédito o débito demora entre 5 y 10 días hábiles'

export function ChunkLab() {
  const [strategy, setStrategy] = useState<Strategy>('fijo')
  const [size, setSize] = useState(15)
  const [overlap, setOverlap] = useState(0)
  const ov = Math.min(overlap, Math.floor(size / 2))

  const { words, paraStarts, chunks } = useMemo(() => chunkDoc(DOC.paragraphs, strategy, size, ov), [strategy, size, ov])

  // posición de la respuesta en el arreglo de palabras
  const ansWords = ANSWER.split(' ')
  const ansStart = words.findIndex((_, i) => ansWords.every((w, j) => words[i + j] === w))
  const ansEnd = ansStart + ansWords.length

  const scored = chunks.map((c, i) => ({ i, c, score: cosine(QV, embed(c.text)) })).sort((a, b) => b.score - a.score)
  const best = scored[0]
  const covered = Math.max(0, Math.min(best.c.end, ansEnd) - Math.max(best.c.start, ansStart))
  const full = covered === ansWords.length
  const holders = chunks.map((c, i) => ({ c, i })).filter(({ c }) => c.start < ansEnd && c.end > ansStart)
  const fullHolder = holders.find(({ c }) => c.start <= ansStart && c.end >= ansEnd)

  // cobertura por palabra (para pintar solapes)
  const cover: number[][] = words.map(() => [])
  chunks.forEach((c, ci) => {
    for (let w = c.start; w < c.end; w++) cover[w].push(ci)
  })
  const startsAt = new Map<number, number>()
  chunks.forEach((c, ci) => {
    if (!startsAt.has(c.start)) startsAt.set(c.start, ci)
  })

  const tokens = chunks.map((c) => countTokens(c.text))
  const totalTokens = tokens.reduce((a, b) => a + b, 0)
  const docTokens = countTokens(DOC.paragraphs.join('\n\n'))
  const avgWords = chunks.reduce((n, c) => n + (c.end - c.start), 0) / chunks.length
  const dup = totalTokens / docTokens - 1

  const verdict: { tone: Tone; icon: typeof CheckCircle2; title: string } = full
    ? { tone: 'ok', icon: CheckCircle2, title: 'El mejor chunk contiene la respuesta completa' }
    : covered > 0
      ? { tone: 'guard', icon: CircleAlert, title: `Respuesta cortada: el mejor chunk solo tiene ${covered} de ${ansWords.length} palabras` }
      : { tone: 'error', icon: XCircle, title: 'El mejor chunk no contiene la respuesta' }
  const VIcon = verdict.icon

  const paragraphsView = paraStarts.map((ps, pi) => {
    const pe = paraStarts[pi + 1] ?? words.length
    return (
      <p key={pi}>
        {words.slice(ps, pe).map((w, k) => {
          const wi = ps + k
          const cs = cover[wi]
          const bg =
            cs.length === 0
              ? undefined
              : cs.length === 1
                ? chunkBg(cs[0])
                : `repeating-linear-gradient(135deg, ${chunkBg(cs[0], 32)} 0 5px, ${chunkBg(cs[1], 32)} 5px 10px)`
          const isAns = wi >= ansStart && wi < ansEnd
          const starts = startsAt.get(wi)
          return (
            <Fragment key={wi}>
              {starts !== undefined && (
                <span className="indexacion-cmark" data-tone={chunkTone(starts)}>
                  C{starts + 1}
                </span>
              )}
              <span className={`indexacion-w${isAns ? ' is-ans' : ''}`} style={{ background: bg }} title={cs.length ? `chunk ${cs.map((c) => 'C' + (c + 1)).join(' + ')}` : undefined}>
                {w}
              </span>{' '}
            </Fragment>
          )
        })}
      </p>
    )
  })

  return (
    <Lab title="Laboratorio de chunking" hint="Cambia estrategia, tamaño y solapamiento">
      <div className="stack">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Segmented
            options={[
              { value: 'fijo', label: 'Tamaño fijo' },
              { value: 'oracion', label: 'Por oración' },
              { value: 'parrafo', label: 'Por párrafo' },
            ]}
            value={strategy}
            onChange={setStrategy}
          />
          {strategy !== 'parrafo' && (
            <Slider label={strategy === 'fijo' ? 'Tamaño (palabras)' : 'Máx. palabras por chunk'} value={size} min={8} max={70} onChange={setSize} style={{ flex: '1 1 180px' }} />
          )}
          {strategy === 'fijo' && (
            <Slider label="Solapamiento (palabras)" value={ov} min={0} max={Math.floor(size / 2)} onChange={setOverlap} style={{ flex: '1 1 180px' }} />
          )}
        </div>
        <div className="small muted">
          {strategy === 'fijo' && 'Corta cada N palabras sin mirar el contenido. El solapamiento repite las últimas palabras al inicio del chunk siguiente (zonas rayadas).'}
          {strategy === 'oracion' && 'Junta oraciones completas hasta el máximo de palabras: nunca corta una oración por la mitad.'}
          {strategy === 'parrafo' && 'Un chunk por párrafo: respeta la estructura que escribió el autor. Funciona bien si los párrafos tienen un tamaño razonable.'}
        </div>

        <div className="indexacion-doc" aria-label="Documento dividido en chunks">
          <div className="label" style={{ marginBottom: 6 }}>
            {DOC.source}
          </div>
          {paragraphsView}
        </div>

        <div className="indexacion-stats">
          <Stat label="chunks" value={chunks.length} tone="data" />
          <Stat label="tamaño promedio" value={`${avgWords.toFixed(0)} pal.`} sub={`≈ ${(totalTokens / chunks.length).toFixed(0)} tokens`} />
          <Stat label="tokens a embeber" value={totalTokens} sub={dup > 0.01 ? `+${(dup * 100).toFixed(0)}% por solape` : 'sin duplicación'} />
          <Stat label="costo (1 doc)" value={fmtUsd((totalTokens / 1e6) * EMBED_PRICE_LOW)} sub={`50 mil docs ≈ ${fmtUsd((totalTokens * 50000) / 1e6 * EMBED_PRICE_LOW)}`} />
        </div>

        <div className="indexacion-verdict" data-tone={verdict.tone}>
          <div className="label">Prueba de recuperación</div>
          <div className="small">
            Pregunta: <b>“{QUESTION}”</b> · la respuesta está subrayada en el texto.
          </div>
          <div className="head">
            <VIcon size={18} /> {verdict.title}
          </div>
          <div className="body">
            Chunk más parecido: <b className="mono">C{best.i + 1}</b> (coseno {best.score.toFixed(3)}) — “
            {best.c.text.split(' ').map((w, k) => {
              const wi = best.c.start + k
              return (
                <Fragment key={k}>
                  {wi >= ansStart && wi < ansEnd ? <mark>{w}</mark> : w}{' '}
                </Fragment>
              )
            })}
            ”
          </div>
          {!full && (
            <div className="body">
              {fullHolder
                ? `La respuesta completa está en C${fullHolder.i + 1}, pero otro chunk se parece más a la pregunta (por ejemplo, el que dice “reembolso”). Chunks muy chicos separan el tema de su respuesta.`
                : `La respuesta quedó repartida entre ${holders.map((h) => 'C' + (h.i + 1)).join(' y ')}. El modelo recibiría una frase a medias. Prueba chunks más grandes o agrega solapamiento.`}
            </div>
          )}
        </div>
      </div>
    </Lab>
  )
}
