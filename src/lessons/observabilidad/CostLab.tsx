import { useState } from 'react'
import { BarRow, Lab, Pill, Slider, Stat } from '../../components/ui'
import { fmtInt } from '../../sim/math'
import { PRICING } from '../../sim/scenario'

type Params = { req: number; iter: number; tin: number; tout: number; cache: number }

const PRESETS: { id: string; label: string; p: Params }[] = [
  { id: 'andi', label: 'Andi hoy', p: { req: 5000, iter: 3, tin: 1500, tout: 110, cache: 0 } },
  { id: 'cache', label: 'Andi + prompt caching', p: { req: 5000, iter: 3, tin: 1500, tout: 110, cache: 60 } },
  { id: 'research', label: 'Agente de investigación', p: { req: 400, iter: 9, tin: 14000, tout: 900, cache: 40 } },
]

const usd = (n: number) => `US$ ${n >= 100 ? fmtInt(n) : n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function compute(p: Params) {
  const inTok = p.iter * p.tin
  const cached = inTok * (p.cache / 100)
  const fresh = inTok - cached
  const outTok = p.iter * p.tout
  const perReq = {
    fresh: (fresh * PRICING.inputPerM) / 1e6,
    cached: (cached * PRICING.cachedInputPerM) / 1e6,
    out: (outTok * PRICING.outputPerM) / 1e6,
  }
  const reqTotal = perReq.fresh + perReq.cached + perReq.out
  const m = p.req * 30
  return { perReq, reqTotal, month: { fresh: perReq.fresh * m, cached: perReq.cached * m, out: perReq.out * m, total: reqTotal * m }, inTok, outTok }
}

export function CostLab() {
  const [p, setP] = useState<Params>(PRESETS[0].p)
  const set = (k: keyof Params) => (v: number) => setP({ ...p, [k]: v })
  const r = compute(p)
  const single = compute({ ...p, iter: 1 })
  const max = r.month.total || 1
  const inShare = (r.month.fresh + r.month.cached) / max
  return (
    <Lab title="Explorador de costos" hint="Mueve los supuestos" footer={<span className="small muted">Precios de referencia por millón de tokens: entrada US$ {PRICING.inputPerM}, salida US$ {PRICING.outputPerM}, entrada leída de caché US$ {PRICING.cachedInputPerM}. No incluye el recargo por escribir en caché ni impuestos.</span>}>
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        {PRESETS.map((x) => (
          <button key={x.id} className={`btn btn-sm${JSON.stringify(x.p) === JSON.stringify(p) ? ' btn-primary' : ''}`} onClick={() => setP(x.p)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="observabilidad-cost-grid">
        <div className="stack" style={{ gap: 12 }}>
          <Slider label="conversaciones por día" value={p.req} min={100} max={50000} step={100} onChange={set('req')} format={fmtInt} />
          <Slider label="iteraciones promedio (llamadas al LLM)" value={p.iter} min={1} max={12} step={0.5} onChange={set('iter')} format={(v) => v.toFixed(1)} />
          <Slider label="tokens de entrada por llamada" value={p.tin} min={500} max={20000} step={250} onChange={set('tin')} format={fmtInt} />
          <Slider label="tokens de salida por llamada" value={p.tout} min={20} max={2000} step={10} onChange={set('tout')} format={fmtInt} />
          <Slider label="% de la entrada servida desde caché" value={p.cache} min={0} max={90} step={5} onChange={set('cache')} format={(v) => `${v}%`} />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <div className="observabilidad-big" data-tone="guard">
            <div className="label">costo mensual estimado</div>
            <div className="observabilidad-big-n">{usd(r.month.total)}</div>
            <div className="small muted">
              {usd(r.reqTotal * 1000)} por cada 1.000 conversaciones · {fmtInt(r.inTok + r.outTok)} tokens por conversación
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <BarRow label="entrada" value={r.month.fresh} max={max} display={`${((r.month.fresh / max) * 100).toFixed(0)}%`} tone="model" />
            <BarRow label="entrada caché" value={r.month.cached} max={max} display={`${((r.month.cached / max) * 100).toFixed(0)}%`} tone="data" />
            <BarRow label="salida" value={r.month.out} max={max} display={`${((r.month.out / max) * 100).toFixed(0)}%`} tone="tool" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Stat label="vs. 1 sola llamada" value={`×${(r.month.total / (single.month.total || 1)).toFixed(1)}`} tone="model" sub="lo que cuesta el loop" />
            <Stat label="peso de la entrada" value={`${(inShare * 100).toFixed(0)}%`} tone="model" sub="del costo total" />
          </div>
          <p className="small" style={{ margin: 0 }}>
            {inShare > 0.6 ? (
              <>
                La <strong>entrada</strong> domina: cada iteración reenvía el historial. Caché del prefijo estable (system + tools), resumir resultados largos de
                herramientas y recortar historial son las palancas.
              </>
            ) : (
              <>
                La <strong>salida</strong> pesa mucho: es 5× más cara por token. Pide respuestas más concisas o limita <code>max_tokens</code> por paso.
              </>
            )}{' '}
            <Pill tone="guard" mono>
              referencial
            </Pill>
          </p>
        </div>
      </div>
    </Lab>
  )
}
