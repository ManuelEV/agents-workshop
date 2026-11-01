import { useState } from 'react'
import { Lab, Segmented, Slider, Stat, toneVar, type Tone } from '../../components/ui'
import { fmt, fmtInt } from '../../sim/math'

const R = 700 // tokens de un resultado de herramienta típico (búsqueda, JSON de API)
const STEP = R + 60 // resultado + el tool_use que lo pidió
const SYS_SINGLE = 1500
const SYS_SUP = 1300
const SYS_WORKER = 700
const SUMMARY = 150

type Ret = 'resumen' | 'transcripcion'

/** Suma de contextos de un loop: cada llamada reenvía todo lo anterior. */
const loopTotal = (base: number, calls: number, inc: number) => Array.from({ length: calls }, (_, i) => base + i * inc).reduce((s, x) => s + x, 0)

type Seg = { tone: Tone; tok: number; label: string }

function Window({ label, segs, max, note }: { label: string; segs: Seg[]; max: number; note?: string }) {
  const total = segs.reduce((s, x) => s + x.tok, 0)
  return (
    <div className="multiagente-win">
      <div className="multiagente-win-head">
        <span>{label}</span>
        <span className="mono">{fmtInt(total)} tok</span>
      </div>
      <div className="multiagente-win-bar">
        {segs.map((s, i) => (
          <span key={i} title={`${s.label}: ${fmtInt(s.tok)} tok`} style={{ width: `${(s.tok / max) * 100}%`, background: toneVar(s.tone) }} />
        ))}
      </div>
      {note && <div className="small muted">{note}</div>}
    </div>
  )
}

export function IsolationLab() {
  const [n, setN] = useState(3)
  const [m, setM] = useState(4)
  const [ret, setRet] = useState<Ret>('resumen')

  const retTok = ret === 'resumen' ? SUMMARY : m * STEP + 120
  const singlePeak = SYS_SINGLE + n * m * STEP
  const workerPeak = SYS_WORKER + m * STEP
  const supPeak = SYS_SUP + n * (retTok + 60)
  const max = Math.max(singlePeak, supPeak, workerPeak)

  const singleTotal = loopTotal(SYS_SINGLE, n * m + 1, STEP)
  const workerTotal = loopTotal(SYS_WORKER, m + 1, STEP)
  const supTotal = loopTotal(SYS_SUP, n + 1, retTok + 60)
  const multiTotal = supTotal + n * workerTotal

  return (
    <Lab title="Aislamiento de contexto" hint="Sube herramientas por subagente y cambia qué devuelven">
      <div className="row" style={{ gap: 18, marginBottom: 14 }}>
        <Slider label="Subagentes" value={n} min={1} max={5} onChange={setN} style={{ flex: '1 1 160px' }} />
        <Slider label="Llamadas a herramientas por subagente" value={m} min={1} max={10} onChange={setM} style={{ flex: '1 1 220px' }} />
        <Segmented
          options={[
            { value: 'resumen', label: 'Devuelven resumen' },
            { value: 'transcripcion', label: 'Devuelven transcripción' },
          ]}
          value={ret}
          onChange={setRet}
        />
      </div>

      <div className="label" style={{ marginBottom: 8 }}>
        Ventana más grande que ve cada agente
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <Window
          label="Agente único (todo en una ventana)"
          max={max}
          segs={[
            { tone: 'system', tok: SYS_SINGLE, label: 'system + herramientas' },
            { tone: 'tool', tok: n * m * STEP, label: 'resultados de herramientas' },
          ]}
        />
        <Window
          label="Supervisor"
          max={max}
          segs={[
            { tone: 'system', tok: SYS_SUP, label: 'system + agentes-herramienta' },
            { tone: ret === 'resumen' ? 'model' : 'tool', tok: n * (retTok + 60), label: ret === 'resumen' ? 'resúmenes de subagentes' : 'transcripciones de subagentes' },
          ]}
          note={ret === 'resumen' ? `Recibe ${n} resúmenes de ~${SUMMARY} tokens.` : 'Recibe todo lo que vio cada subagente: perdiste el aislamiento.'}
        />
        <Window
          label={`Cada subagente (×${n})`}
          max={max}
          segs={[
            { tone: 'system', tok: SYS_WORKER, label: 'system del especialista' },
            { tone: 'tool', tok: m * STEP, label: 'sus resultados de herramientas' },
          ]}
          note="Contexto limpio: solo su encargo y sus herramientas."
        />
      </div>

      <div className="row" style={{ marginTop: 16, alignItems: 'stretch' }}>
        <Stat label="Tokens procesados · agente único" value={fmtInt(singleTotal)} tone="ok" sub={`${n * m + 1} llamadas`} />
        <Stat label="Tokens procesados · multi-agente" value={fmtInt(multiTotal)} tone="model" sub={`${n + 1 + n * (m + 1)} llamadas`} />
        <Stat label="Multiplicador" value={`${fmt(multiTotal / singleTotal, 2)}×`} tone={multiTotal > singleTotal ? 'guard' : 'ok'} sub="costo relativo" />
        <Stat label="Ventana pico" value={`${fmt(Math.max(supPeak, workerPeak) / singlePeak, 2)}×`} tone={Math.max(supPeak, workerPeak) < singlePeak ? 'ok' : 'error'} sub="vs. agente único" />
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>
        Modelo simplificado: cada resultado de herramienta pesa ~{R} tokens y cada llamada reenvía todo el historial (sin caché de prompt). El loop único crece de forma cuadrática; el
        multi-agente paga system prompts y llamadas de coordinación extra. Con tareas chicas (1 subagente, 1–2 herramientas) el multi-agente cuesta más; con muchas, puede
        costar menos. La ventaja que no cambia: ninguna ventana se satura.
      </p>
    </Lab>
  )
}
