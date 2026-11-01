import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Cpu, Database, Eraser, FileText, Scissors } from 'lucide-react'
import { Lab, Stat, VectorStrip } from '../../components/ui'
import { FlowDiagram, type FlowEdge, type FlowNode } from '../../components/Flow'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { VectorMap, type MapPoint } from '../../components/VectorMap'
import { usePlayer } from '../../lib/hooks'
import { KB_DOCS, KB_INDEX } from '../../sim/corpus'
import { DIM_LABELS, vecToString } from '../../sim/embed'
import { countTokens, fmtUsd } from '../../sim/math'
import { chunkBg, chunkTone, EMBED_PRICE_LOW, rawLines } from './data'

/** true si la pantalla es angosta (para cambiar el layout del diagrama). */
function useNarrow(max = 640) {
  const q = `(max-width: ${max}px)`
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return narrow
}

const STAGES = [
  { id: 'doc', label: 'Documento', sub: 'markdown del CMS', tone: 'system', icon: FileText },
  { id: 'parse', label: 'Parser', sub: 'limpieza', tone: 'tool', icon: Eraser },
  { id: 'chunk', label: 'Chunker', sub: 'por párrafo', tone: 'tool', icon: Scissors },
  { id: 'embed', label: 'Embeddings', sub: 'modelo (16 dims)', tone: 'model', icon: Cpu },
  { id: 'store', label: 'Vector store', sub: 'upsert', tone: 'data', icon: Database },
] as const

const FLOWS = [[], ['doc>parse'], ['parse>chunk'], ['chunk>embed'], ['embed>store'], []]
const ACTIVE = [['doc'], ['parse'], ['chunk'], ['embed'], ['store'], ['doc', 'parse', 'chunk', 'embed', 'store']]

export function PipelineLab() {
  const [docId, setDocId] = useState('devoluciones')
  const doc = KB_DOCS.find((d) => d.id === docId)!
  const lines = rawLines(doc)
  const chunks = KB_INDEX.filter((c) => c.docId === docId)
  const narrow = useNarrow()

  const nodes: FlowNode[] = STAGES.map((s, i) =>
    narrow
      ? { id: s.id, label: s.label, sub: s.sub, tone: s.tone, icon: s.icon, x: 180, y: 40 + i * 76, w: 270, h: 54 }
      : { id: s.id, label: s.label, sub: s.sub, tone: s.tone, icon: s.icon, x: 92 + i * 179, y: 50, w: 156, h: 62 },
  )
  const edges: FlowEdge[] = STAGES.slice(1).map((s, i) => ({ from: STAGES[i].id, to: s.id }))

  const rawChars = lines.reduce((n, l) => n + l.text.length + 1, 0)
  const cleanChars = doc.paragraphs.join('\n\n').length
  const tokens = chunks.reduce((n, c) => n + countTokens(c.text), 0)

  const steps: StepInfo[] = [
    { title: 'Documento crudo', body: `Así llega “${doc.source}” desde el CMS: con front matter, navegación, comentarios HTML y un pie de página que no aportan al contenido.` },
    {
      title: 'Parser y limpieza',
      body: `Se extrae el texto útil y se descarta el ruido (${rawChars} → ${cleanChars} caracteres). El front matter no se bota: pasa a la metadata (título, fecha).`,
    },
    { title: 'Chunker', body: `El texto se corta en ${chunks.length} chunks, uno por párrafo. Cada chunk recibe un ID estable: doc + posición.` },
    { title: 'Modelo de embeddings', body: `Cada chunk se convierte en un vector (${tokens} tokens en total). Se envían en lote para ahorrar llamadas.` },
    { title: 'Upsert al vector store', body: 'Se guarda cada fila: ID, texto, vector y metadata. “Upsert” = inserta si no existe, reemplaza si ya existe ese ID.' },
    {
      title: 'Listo para consultar',
      body: (
        <>
          Los nuevos puntos ya viven junto al resto de la base. Ahora una consulta puede encontrarlos por cercanía: eso lo verás en la lección{' '}
          <Link to="/leccion/busqueda-rag">Consulta RAG</Link>.
        </>
      ),
    },
  ]
  const player = usePlayer(steps.length, { interval: 3200 })
  const s = player.step

  const points: MapPoint[] = KB_INDEX.map((c) => {
    const mine = c.docId === docId
    const idx = chunks.findIndex((x) => x.id === c.id)
    return {
      id: c.id,
      x: c.xy[0],
      y: c.xy[1],
      label: mine ? c.id : undefined,
      tip: `${c.id}: ${c.text}`,
      tone: mine ? chunkTone(idx) : 'system',
      hl: mine,
      dim: !mine,
      r: mine ? 8 : 5.5,
      enterDelay: mine && s === 4 ? 0.3 + idx * 0.35 : undefined,
    }
  })

  return (
    <Lab title="La tubería de ingesta, con datos reales" hint="Elige un documento y dale play">
      <div className="stack">
        <div className="row">
          <span className="label">Documento</span>
          <select
            className="select"
            style={{ maxWidth: 360 }}
            value={docId}
            onChange={(e) => {
              setDocId(e.target.value)
              player.reset()
            }}
          >
            {KB_DOCS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.source})
              </option>
            ))}
          </select>
        </div>
        <div className="indexacion-flowwrap">
          <FlowDiagram
            nodes={nodes}
            edges={edges}
            width={narrow ? 360 : 900}
            height={narrow ? 390 : 100}
            flows={FLOWS[s]}
            active={ACTIVE[s]}
            dimInactive={s < 5}
            onNodeClick={(id) => player.goTo(Math.min(4, STAGES.findIndex((x) => x.id === id)))}
            ariaLabel="Tubería de ingesta: documento, parser, chunker, modelo de embeddings y vector store"
          />
        </div>
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
        <Narration steps={steps} step={s} />

        <div key={`${docId}-${s}`} className="anim-fade">
          {s <= 1 && (
            <div className="indexacion-raw" aria-label="Documento crudo">
              {lines.map((l, i) => (
                <span key={i} className={`ln${l.noise ? ' is-noise' : ''}${l.noise && s === 1 ? ' is-cut' : ''}`}>
                  {l.text || ' '}
                  {l.noise && s === 1 && <span className="why">✕ {l.why}</span>}
                </span>
              ))}
            </div>
          )}

          {s === 2 && (
            <div className="indexacion-doc">
              {chunks.map((c, i) => (
                <p key={c.id}>
                  <span className="indexacion-cmark" data-tone={chunkTone(i)}>
                    {c.id}
                  </span>
                  <span className="indexacion-w" style={{ background: chunkBg(i) }}>
                    {c.text}
                  </span>
                </p>
              ))}
            </div>
          )}

          {s === 3 && (
            <div className="stack" style={{ gap: 8 }}>
              {chunks.map((c, i) => (
                <div key={c.id} className="indexacion-chunkrow anim-in" data-tone={chunkTone(i)} style={{ animationDelay: `${i * 0.35}s` }}>
                  <span className="mono small">
                    <b>{c.id}</b> · {countTokens(c.text)} tok
                  </span>
                  <span className="t">{c.text}</span>
                  <VectorStrip values={c.vector} labels={DIM_LABELS} size="sm" />
                </div>
              ))}
            </div>
          )}

          {s >= 4 && (
            <div className="stack">
              <div className="table-wrap" style={{ margin: 0 }}>
                <table className="tbl indexacion-tbl">
                  <thead>
                    <tr>
                      <th>id</th>
                      <th>texto</th>
                      <th>vector</th>
                      <th>metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunks.map((c, i) => (
                      <tr key={c.id} className={s === 4 ? 'is-new' : ''} style={s === 4 ? { animationDelay: `${0.3 + i * 0.35}s` } : undefined}>
                        <td className="mono">
                          <b style={{ color: `var(--c-${chunkTone(i)})` }}>{c.id}</b>
                        </td>
                        <td className="txt">{c.text.length > 80 ? c.text.slice(0, 78) + '…' : c.text}</td>
                        <td className="mono">{vecToString(c.vector, 3, 2)}</td>
                        <td className="mono">{`{fuente: "${c.source}", actualizado: "${c.updated}", doc: "${c.docId}"}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <VectorMap points={points} showLabels="hl" ariaLabel="Los chunks del documento aparecen en el mapa del índice" />
              {s === 5 && (
                <div className="indexacion-stats">
                  <Stat label="chunks nuevos" value={chunks.length} tone="data" />
                  <Stat label="total en el índice" value={KB_INDEX.length} sub={`${KB_DOCS.length} documentos`} />
                  <Stat label="tokens embebidos" value={tokens} />
                  <Stat label="costo aprox." value={fmtUsd((tokens / 1e6) * EMBED_PRICE_LOW)} sub="a US$0,02 / 1M tokens" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Lab>
  )
}
