import { useMemo, useState } from 'react'
import { ArrowRight, Cpu } from 'lucide-react'
import { Lab, Pill, Slider, Stat } from '../../components/ui'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { fmtInt, fmtUsd, pct } from '../../sim/math'
import { PRICING } from '../../sim/scenario'
import { Hl } from './parts'
import { chunkTokens, hybrid, rerankScore, shortText } from './search'

const ROW = 58
const CANDS = 8

/* Lab 4: reranker (cross-encoder simulado) sobre el top-8 híbrido. */
export function RerankLab({ query }: { query: string }) {
  const [topK, setTopK] = useState(3)
  const cands = useMemo(() => hybrid(query).fused.slice(0, CANDS), [query])
  const scored = useMemo(() => cands.map((c) => rerankScore(query, c.chunk)), [cands, query])
  const order = useMemo(() => scored.map((_, i) => i).sort((a, b) => scored[b].score - scored[a].score), [scored])
  const n = cands.length
  const player = usePlayer(n + 3, { interval: (s) => (s >= 1 && s <= n ? 1300 : 2800) })
  const step = player.step
  const reading = step >= 1 && step <= n ? step - 1 : -1
  const sorted = step >= n + 1
  const cut = step >= n + 2
  const k = Math.min(topK, n)

  const keptIdx = order.slice(0, k)
  const tokAll = cands.reduce((s, c) => s + chunkTokens(c.chunk), 0)
  const tokKept = keptIdx.reduce((s, i) => s + chunkTokens(cands[i].chunk), 0)
  const best = order[0]
  const qPerDay = 10000
  const saveUsd = ((tokAll - tokKept) * qPerDay * PRICING.inputPerM) / 1e6

  const cur = reading >= 0 ? scored[reading] : null
  const steps: StepInfo[] = [
    {
      title: `Llegan ${n} candidatos de la búsqueda híbrida`,
      body: <>Orden RRF: rápido y con buen recall, pero grueso. El cross-encoder es lento, por eso solo se aplica a unos pocos candidatos.</>,
    },
    ...scored.map((d, i) => ({
      title: `Par ${i + 1}/${n}: (consulta, ${d.chunk.id})`,
      body: (
        <>
          Lee consulta y chunk <b>juntos</b>. Conceptos cubiertos {Math.round(d.conceptCov * 100)}%, términos {Math.round(d.termCov * 100)}%
          {d.exact.length ? `, coincidencia exacta de “${d.exact.join('”, “')}”` : ''} → relevancia <b>{d.score.toFixed(2)}</b>.
        </>
      ),
    })),
    {
      title: 'Reordenar por relevancia',
      body: (
        <>
          El nuevo 1.º es <b>{scored[best]?.chunk.id}</b>, que venía {best + 1}.º en la híbrida.{' '}
          {best === 0 ? 'Esta vez el orden híbrido ya acertaba, pero ahora el puntaje es calibrado (0–1) y sirve para cortar.' : 'Subió porque responde la pregunta completa, no solo una parte.'}
        </>
      ),
    },
    {
      title: `Cortar en top-${k} y enviar al LLM`,
      body: (
        <>
          Solo {k} chunk{k > 1 ? 's' : ''} entra{k > 1 ? 'n' : ''} al prompt: {fmtInt(tokKept)} tokens en vez de {fmtInt(tokAll)} ({pct(1 - tokKept / (tokAll || 1), 0)} menos). Menos ruido en el contexto también
          reduce respuestas que mezclan políticas.
        </>
      ),
    },
  ]

  return (
    <Lab title="Reranker: el cross-encoder reordena" hint="Play para ver cada par; luego ajusta el top-k" badge="Animación">
      <PlayerBar player={player} labels={steps.map((s) => s.title)} />
      <div style={{ margin: '12px 0' }}>
        <Narration steps={steps} step={step} />
      </div>

      <div className="busqueda-hibrida-xenc" data-active={cur ? 'true' : undefined}>
        <div className="busqueda-hibrida-xenc-in">
          <span className="busqueda-hibrida-tag">[CLS]</span> <span className="busqueda-hibrida-q">{query}</span> <span className="busqueda-hibrida-tag">[SEP]</span>{' '}
          {cur ? <Hl text={shortText(cur.chunk.text, 150)} terms={cur.matched} prefix /> : <span className="muted">chunk candidato…</span>} <span className="busqueda-hibrida-tag">[SEP]</span>
        </div>
        <ArrowRight size={18} className="busqueda-hibrida-xenc-arrow" aria-hidden />
        <div className="busqueda-hibrida-xenc-box">
          <Cpu size={18} aria-hidden />
          <span>cross-encoder</span>
        </div>
        <ArrowRight size={18} className="busqueda-hibrida-xenc-arrow" aria-hidden />
        <div className="busqueda-hibrida-xenc-out mono">{cur ? cur.score.toFixed(2) : '—'}</div>
      </div>

      <div className="busqueda-hibrida-stage" style={{ height: n * ROW + 4, marginTop: 12 }}>
        {cands.map((c, i) => {
          const d = scored[i]
          const pos = sorted ? order.indexOf(i) : i
          const seen = step > i && step >= 1
          const kept = !cut || pos < k
          return (
            <div
              key={c.chunk.id}
              className={`busqueda-hibrida-rr${reading === i ? ' is-reading' : ''}${!kept ? ' is-cut' : ''}${cut && kept ? ' is-kept' : ''}`}
              style={{ top: pos * ROW }}
            >
              <span className="busqueda-hibrida-rr-rank">{pos + 1}</span>
              <span className="busqueda-hibrida-rr-main">
                <span className="busqueda-hibrida-chip-id">
                  {c.chunk.id} <span className="muted">· híbrida #{i + 1}</span>
                </span>
                <span className="busqueda-hibrida-rr-text">{shortText(c.chunk.text, 88)}</span>
              </span>
              <span className="busqueda-hibrida-rr-score">
                <span className="busqueda-hibrida-bar" data-tone="model">
                  <span style={{ width: seen ? `${d.score * 100}%` : 0 }} />
                </span>
                <span className="mono small">{seen ? d.score.toFixed(2) : '··'}</span>
              </span>
            </div>
          )
        })}
      </div>

      <div className="row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
        <Slider label="top-k que se envía al LLM" value={topK} min={1} max={CANDS} onChange={setTopK} style={{ flex: '1 1 220px', maxWidth: 320 }} />
        <button className="btn btn-sm" onClick={() => player.goTo(n + 2)}>
          Ver el corte
        </button>
      </div>
      <div className="row" style={{ marginTop: 12, alignItems: 'stretch' }}>
        <Stat label="Sin reranker (top-8)" value={`${fmtInt(tokAll)} tok`} tone="system" sub="todo el candidato al prompt" />
        <Stat label={`Con reranker (top-${k})`} value={`${fmtInt(tokKept)} tok`} tone="model" sub={`${pct(1 - tokKept / (tokAll || 1), 0)} menos contexto`} />
        <Stat label="Ahorro a 10 000 consultas/día" value={fmtUsd(saveUsd)} tone="ok" sub={`input a US$ ${PRICING.inputPerM}/M tok`} />
        <Stat label="Latencia extra" value={`~${40 + n * 12} ms`} tone="guard" sub={`${n} pares (simulado)`} />
      </div>
      {best > 0 && (
        <p className="small" style={{ margin: '10px 0 0' }}>
          <Pill tone="guard">Ojo</Pill> Sin reranker, el chunk más relevante ({scored[best].chunk.id}) estaba en la posición {best + 1}: con top-{k} sobre el orden híbrido{' '}
          {best < k ? 'igual habría entrado.' : <b>se habría quedado fuera</b>}
        </p>
      )}
    </Lab>
  )
}
