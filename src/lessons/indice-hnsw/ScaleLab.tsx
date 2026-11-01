import { useState } from 'react'
import { Callout, Lab, Segmented, Slider, Stat } from '../../components/ui'
import { fmtInt } from '../../sim/math'

/* Modelo de costos ILUSTRATIVO (órdenes de magnitud, no un benchmark):
   - fuerza bruta: N·d multiplicaciones a ~1e10 por segundo (CPU vectorizada, varios núcleos)
   - HNSW (M=16, ef=64): ~M·log_M(N)·2 + ef·M·0,6 distancias, cada una con un acceso
     aleatorio a memoria (~150 ns) además del cálculo. */
const RATE = 1e10
const M = 16
const EF = 64
const CELLS = 400

const hnswComps = (n: number) => Math.min(n, M * (Math.log(n) / Math.log(M)) * 2 + EF * M * 0.6)
const fmtMs = (ms: number) => (ms < 1 ? `${ms.toFixed(2).replace('.', ',')} ms` : ms < 1000 ? `${fmtInt(ms)} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)
const fmtBytes = (b: number) => (b < 1e9 ? `${(b / 1e6).toFixed(0)} MB` : `${(b / 1e9).toFixed(1).replace('.', ',')} GB`)
const fmtN = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `${(n / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 0 })} mil` : String(n))

/** barra en escala logarítmica entre 10^lo y 10^hi */
const logW = (v: number, lo: number, hi: number) => Math.max(1.5, ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * 100)

export function ScaleLab() {
  const [logN, setLogN] = useState(6)
  const [dim, setDim] = useState('1536')
  const n = Math.round(10 ** logN)
  const d = Number(dim)

  const bruteComps = n
  const hComps = hnswComps(n)
  const bruteMs = ((n * d) / RATE) * 1000
  const hMs = hComps * (d / RATE + 1.5e-7) * 1000
  const speed = bruteMs / hMs
  const ram = n * d * 4 + n * M * 2 * 4 * 1.1
  const lit = Math.max(1, Math.round((hComps / n) * CELLS))

  return (
    <Lab title="Fuerza bruta vs índice aproximado" hint="Mueve el tamaño de la colección">
      <div className="stack">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Slider label="Vectores en la colección" value={logN} min={3} max={7} step={0.25} onChange={setLogN} format={() => fmtN(n)} style={{ flex: '1 1 260px' }} />
          <div className="stack" style={{ gap: 4 }}>
            <span className="label">Dimensiones</span>
            <Segmented options={['384', '768', '1536', '3072'].map((x) => ({ value: x, label: x }))} value={dim} onChange={setDim} />
          </div>
        </div>

        <div className="indice-hnsw-cmp">
          <span className="label">Comparaciones</span>
          <span />
          <span />
          <span>Fuerza bruta</span>
          <span className="track" data-tone="error">
            <span className="fill" style={{ width: `${logW(bruteComps, 0, 7)}%`, display: 'block' }} />
          </span>
          <span className="v">{fmtInt(bruteComps)}</span>
          <span>HNSW</span>
          <span className="track" data-tone="data">
            <span className="fill" style={{ width: `${logW(hComps, 0, 7)}%`, display: 'block' }} />
          </span>
          <span className="v">{fmtInt(hComps)}</span>

          <span className="label" style={{ marginTop: 6 }}>
            Latencia
          </span>
          <span />
          <span />
          <span>Fuerza bruta</span>
          <span className="track" data-tone="error">
            <span className="fill" style={{ width: `${logW(bruteMs, -2, 4)}%`, display: 'block' }} />
          </span>
          <span className="v">{fmtMs(bruteMs)}</span>
          <span>HNSW</span>
          <span className="track" data-tone="data">
            <span className="fill" style={{ width: `${logW(hMs, -2, 4)}%`, display: 'block' }} />
          </span>
          <span className="v">{fmtMs(hMs)}</span>
        </div>
        <div className="small muted">Barras en escala logarítmica: cada marca es ×10.</div>

        <div className="grid-2">
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">Fuerza bruta mide todo</span>
            <div className="indice-hnsw-grid" data-tone="error" aria-hidden>
              {Array.from({ length: CELLS }, (_, i) => (
                <span key={i} className="is-on" />
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="label">HNSW mide {((hComps / n) * 100).toLocaleString('es-CL', { maximumSignificantDigits: 2 })}%</span>
            <div className="indice-hnsw-grid" data-tone="data" aria-hidden>
              {Array.from({ length: CELLS }, (_, i) => (
                <span key={i} className={i < lit ? 'is-on' : ''} />
              ))}
            </div>
          </div>
        </div>
        <div className="small muted">Cada cuadrito representa {fmtN(Math.max(1, Math.round(n / CELLS)))} vectores.</div>

        <div className="row">
          {speed >= 1 ? (
            <Stat label="HNSW es" value={`×${speed < 10 ? speed.toFixed(1).replace('.', ',') : fmtInt(speed)}`} sub="más rápido" tone="data" />
          ) : (
            <Stat label="HNSW es" value={`×${(1 / speed).toFixed(1).replace('.', ',')}`} sub="más lento: con pocos vectores, la fuerza bruta basta" tone="guard" />
          )}
          <Stat label="RAM del índice" value={fmtBytes(ram)} sub="vectores float32 + grafo" tone="guard" />
        </div>
        <Callout tone="info" title="Números ilustrativos">
          Son órdenes de magnitud con un modelo simple (CPU, M = 16, ef = 64, sin red ni disco), no un benchmark. Lo importante es la forma: la fuerza bruta crece lineal con N;
          HNSW crece aproximadamente con log N. A cambio, HNSW necesita tener el grafo en memoria y puede perder algún vecino.
        </Callout>
      </div>
    </Lab>
  )
}
