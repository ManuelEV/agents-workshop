import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import type { Player } from '../lib/hooks'

/** Controles de reproducción + línea de tiempo clicable por pasos. */
export function PlayerBar({ player, labels, extra }: { player: Player; labels?: string[]; extra?: ReactNode }) {
  const { step, count, playing } = player
  return (
    <div className="player">
      <div className="player-btns">
        <button className="icon-btn" onClick={player.reset} aria-label="Reiniciar" title="Reiniciar">
          <RotateCcw size={16} />
        </button>
        <button className="icon-btn" onClick={player.prev} disabled={player.isFirst} aria-label="Paso anterior" title="Anterior">
          <ChevronLeft size={18} />
        </button>
        <button className="icon-btn play" onClick={player.toggle} aria-label={playing ? 'Pausar' : 'Reproducir'} title={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="icon-btn" onClick={player.next} disabled={player.isLast} aria-label="Paso siguiente" title="Siguiente">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="player-track">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            className={`player-seg${i < step ? ' done' : ''}${i === step ? ' current' : ''}`}
            onClick={() => player.goTo(i)}
            title={labels?.[i] ? `${i + 1}. ${labels[i]}` : `Paso ${i + 1}`}
            aria-label={labels?.[i] ?? `Paso ${i + 1}`}
          />
        ))}
      </div>
      <span className="player-count">
        {step + 1}/{count}
      </span>
      {extra}
    </div>
  )
}

export type StepInfo = { title: string; body: ReactNode }

/** Texto que narra el paso actual de una animación. */
export function Narration({ steps, step }: { steps: StepInfo[]; step: number }) {
  const s = steps[step]
  if (!s) return null
  return (
    <div className="narration" key={step}>
      <div className="narration-step">
        Paso {step + 1} de {steps.length}
      </div>
      <div className="narration-title anim-fade">{s.title}</div>
      <div className="narration-body anim-fade">{s.body}</div>
    </div>
  )
}
