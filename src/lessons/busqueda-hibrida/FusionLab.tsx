import { useMemo, useState } from 'react'
import { Lab, Slider } from '../../components/ui'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { fmt } from '../../sim/math'
import { hybrid, RRF_K } from './search'

const ROW = 50
const TOP = 5

/* Lab 3: la fusión RRF animada, ítem por ítem. */
export function FusionLab({ query }: { query: string }) {
  const [k, setK] = useState(RRF_K)
  const r = useMemo(() => hybrid(query, k, TOP), [query, k])
  const player = usePlayer(5, { interval: (s) => (s === 3 ? 2600 : 3000) })
  const step = player.step

  // orden de "llegada" a la columna fusionada (antes de ordenar): por mejor posición en cualquier lista
  const gather = useMemo(
    () =>
      [...r.fused].sort(
        (a, b) =>
          Math.min(a.bmRank ?? 99, a.vecRank ?? 99) - Math.min(b.bmRank ?? 99, b.vecRank ?? 99) || (a.bmRank ?? 99) - (b.bmRank ?? 99),
      ),
    [r],
  )
  const rows = Math.max(TOP, r.fused.length)
  const both = r.fused.filter((f) => f.bmRank && f.vecRank)
  const top = r.fused[0]
  const fmtP = (x: number) => x.toFixed(4)

  const steps: StepInfo[] = [
    {
      title: 'Dos rankings con escalas incompatibles',
      body: (
        <>
          BM25 da puntajes sin techo ({r.bm[0] ? `el primero tiene ${fmt(r.bm[0].score, 2)}` : 'aquí ninguno'}) y el coseno vive entre −1 y 1 ({r.vec[0] ? `el primero tiene ${r.vec[0].score.toFixed(3)}` : ''}). Sumarlos
          directamente premiaría al que tenga números más grandes.
        </>
      ),
    },
    {
      title: 'RRF ignora el puntaje y usa la posición',
      body: (
        <>
          Cada chunk de la lista BM25 recibe <b>1 / (k + posición)</b>. Con k = {k}: el 1.º vale {fmtP(1 / (k + 1))}, el 2.º {fmtP(1 / (k + 2))}, el 5.º {fmtP(1 / (k + 5))}.
          {r.bm.length === 0 && ' Esta vez BM25 no encontró nada, así que no aporta puntos.'}
        </>
      ),
    },
    {
      title: 'Lo mismo para la lista vectorial',
      body: <>Mismo cálculo, independiente de que el coseno sea 0,9 o 0,03: solo importa el lugar en la fila.</>,
    },
    {
      title: 'Se juntan por chunk y se suman',
      body: (
        <>
          Cada chunk suma lo que obtuvo en cada lista. {both.length > 0 ? `${both.map((f) => f.chunk.id).join(', ')} aparece${both.length > 1 ? 'n' : ''} en ambas, así que suma${both.length > 1 ? 'n' : ''} dos veces.` : 'Ningún chunk aparece en ambas listas.'}
        </>
      ),
    },
    {
      title: 'Ranking final',
      body: top ? (
        <>
          Gana <b>{top.chunk.id}</b> con {top.bmRank ? fmtP(top.bmPart) : '0'} + {top.vecRank ? fmtP(top.vecPart) : '0'} = <b>{fmtP(top.rrf)}</b>. Estar arriba en <i>ambas</i> listas
          vale más que ser 1.º en una sola. Mueve k: con k pequeño pesa mucho el primer lugar; con k grande la lista se aplana.
        </>
      ) : (
        <>Sin candidatos.</>
      ),
    },
  ]

  const colLeft = (c: number) => `calc(${c} * (100% + 8px) / 3)`
  const colW = 'calc((100% - 16px) / 3)'

  return (
    <Lab title="Fusión RRF paso a paso" hint="Dale play o avanza paso a paso" badge="Animación">
      <PlayerBar player={player} labels={steps.map((s) => s.title)} />
      <div style={{ margin: '12px 0' }}>
        <Narration steps={steps} step={step} />
      </div>

      <div className="busqueda-hibrida-cols busqueda-hibrida-colhead">
        <span data-tone="tool">BM25 (top {TOP})</span>
        <span data-tone="data">Vector (top {TOP})</span>
        <span data-tone="accent">Híbrida RRF</span>
      </div>
      <div className="busqueda-hibrida-stage" style={{ height: rows * ROW + 4 }}>
        {/* guías de filas */}
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="busqueda-hibrida-guide" style={{ top: i * ROW }}>
            <span>{i + 1}</span>
          </div>
        ))}
        {r.bm.length === 0 && (
          <div className="busqueda-hibrida-chip is-empty" style={{ left: colLeft(0), width: colW, top: 0, height: ROW * 2 - 8 }}>
            0 resultados: ninguna palabra coincide
          </div>
        )}
        {r.bm.map((h, i) => (
          <div key={'b' + h.chunk.id} className="busqueda-hibrida-chip" data-tone="tool" style={{ left: colLeft(0), width: colW, top: i * ROW }}>
            <span className="busqueda-hibrida-chip-id">{h.chunk.id}</span>
            <span className="busqueda-hibrida-chip-v">{step >= 1 ? (<><span className="busqueda-hibrida-hide-sm">1/({k}+{i + 1}) = </span>{fmtP(1 / (k + i + 1))}</>) : `bm25 ${fmt(h.score, 2)}`}</span>
          </div>
        ))}
        {r.vec.map((h, i) => (
          <div key={'v' + h.chunk.id} className="busqueda-hibrida-chip" data-tone="data" style={{ left: colLeft(1), width: colW, top: i * ROW }}>
            <span className="busqueda-hibrida-chip-id">{h.chunk.id}</span>
            <span className="busqueda-hibrida-chip-v">{step >= 2 ? (<><span className="busqueda-hibrida-hide-sm">1/({k}+{i + 1}) = </span>{fmtP(1 / (k + i + 1))}</>) : `cos ${h.score.toFixed(3)}`}</span>
          </div>
        ))}
        {/* fichas que viajan a la columna fusionada */}
        {r.fused.map((f) => {
          const src = f.bmRank ? 0 : 1
          const srcRow = (f.bmRank ?? f.vecRank ?? 1) - 1
          const pos = step >= 4 ? r.fused.indexOf(f) : gather.indexOf(f)
          const moved = step >= 3
          return (
            <div
              key={'f' + f.chunk.id}
              className={`busqueda-hibrida-chip is-fly${moved ? ' is-moved' : ''}${step >= 4 && pos < 3 ? ' is-top' : ''}`}
              data-tone="accent"
              style={{ left: moved ? colLeft(2) : colLeft(src), width: colW, top: (moved ? pos : srcRow) * ROW, opacity: moved ? 1 : 0 }}
            >
              <span className="busqueda-hibrida-chip-id">
                {f.chunk.id}
                <span className="busqueda-hibrida-src">
                  {f.bmRank && <span data-tone="tool">B{f.bmRank}</span>}
                  {f.vecRank && <span data-tone="data">V{f.vecRank}</span>}
                </span>
              </span>
              <span className="busqueda-hibrida-chip-v">
                {f.bmRank && f.vecRank && <span className="busqueda-hibrida-hide-sm">{fmtP(f.bmPart)}+{fmtP(f.vecPart)} = </span>}
                <b>{fmtP(f.rrf)}</b>
              </span>
            </div>
          )
        })}
      </div>

      <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
        <Slider label="Constante k de RRF" value={k} min={1} max={120} onChange={setK} style={{ flex: '1 1 240px', maxWidth: 360 }} />
        <code className="small">score(d) = Σ_listas 1 / (k + rank_lista(d))</code>
      </div>
    </Lab>
  )
}
