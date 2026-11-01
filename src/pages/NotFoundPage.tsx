import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="lesson" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div className="eyebrow">404</div>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Esta página no existe</h1>
      <p className="muted">Puede que la lección haya cambiado de nombre.</p>
      <Link className="btn btn-primary" to="/">
        Volver al mapa del taller
      </Link>
    </div>
  )
}
