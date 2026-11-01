import { Component, Suspense, useEffect, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'
import { LESSONS, getLesson, lessonComponent, lessonNumber } from '../lessons'
import { MODULES } from '../lessons/modules'
import { markVisited } from '../lib/hooks'
import { Pill } from '../components/ui'
import { NotFoundPage } from './NotFoundPage'

class LessonBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error)
      return (
        <div className="callout" data-tone="error">
          <span />
          <div>
            <div className="callout-title">La lección falló al renderizar</div>
            <div className="callout-body mono small">{this.state.error.message}</div>
          </div>
        </div>
      )
    return this.props.children
  }
}

export function LessonPage() {
  const { slug = '' } = useParams()
  const meta = getLesson(slug)
  const Comp = lessonComponent(slug)

  useEffect(() => {
    if (meta) {
      markVisited(meta.slug)
      document.title = `${meta.title} · Agents Workshop`
    }
  }, [meta])

  if (!meta || !Comp) return <NotFoundPage />
  const mod = MODULES.find((m) => m.id === meta.module)!
  const idx = LESSONS.findIndex((l) => l.slug === slug)
  const prev = LESSONS[idx - 1]
  const next = LESSONS[idx + 1]

  return (
    <article className="lesson" key={slug}>
      <header className="lesson-hero" data-tone={mod.tone}>
        <div className="eyebrow">
          Módulo {mod.n} · {mod.title} · Lección {String(lessonNumber(slug)).padStart(2, '0')}
        </div>
        <h1>{meta.title}</h1>
        <p className="lead">{meta.summary}</p>
        <div className="hero-meta">
          <span className="minutes">
            <Clock size={13} style={{ verticalAlign: '-2px' }} /> {meta.minutes} min
          </span>
          {meta.concepts.map((c) => (
            <Pill key={c} tone={mod.tone} mono>
              {c}
            </Pill>
          ))}
        </div>
      </header>

      <LessonBoundary>
        <Suspense fallback={<div className="muted">Cargando lección…</div>}>
          <Comp />
        </Suspense>
      </LessonBoundary>

      <nav className="lesson-nav" aria-label="Navegación entre lecciones">
        {prev ? (
          <Link to={`/leccion/${prev.slug}`}>
            <span className="dir">
              <ArrowLeft size={13} /> Anterior
            </span>
            <span className="t">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/leccion/${next.slug}`} className="next">
            <span className="dir">
              Siguiente <ArrowRight size={13} />
            </span>
            <span className="t">{next.title}</span>
          </Link>
        ) : (
          <Link to="/" className="next">
            <span className="dir">
              Fin del taller <ArrowRight size={13} />
            </span>
            <span className="t">Volver al mapa</span>
          </Link>
        )}
      </nav>
    </article>
  )
}
