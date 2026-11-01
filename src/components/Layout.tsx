import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { CheckCircle2, Menu, Moon, Sun, X } from 'lucide-react'
import { setTheme, useTheme } from '../lib/theme'
import { useVisited } from '../lib/hooks'
import { LESSONS, lessonNumber, lessonsByModule } from '../lessons'
import { MODULES } from '../lessons/modules'

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--bg-inset)" />
      <path d="M17 20 27 28M47 20 37 28M17 44 27 36M47 44 37 36" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="9" fill="var(--c-model)" />
      <circle cx="14" cy="18" r="5" fill="var(--c-user)" />
      <circle cx="50" cy="18" r="5" fill="var(--c-tool)" />
      <circle cx="14" cy="46" r="5" fill="var(--c-data)" />
      <circle cx="50" cy="46" r="5" fill="var(--c-memory)" />
    </svg>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const visited = useVisited()
  return (
    <nav aria-label="Lecciones">
      {MODULES.map((m) => (
        <div key={m.id} className="nav-module" data-tone={m.tone}>
          <div className="nav-module-title">
            <span className="dot" />
            {m.n}. {m.title}
          </div>
          <ul>
            {lessonsByModule(m.id).map((l) => (
              <li key={l.slug}>
                <NavLink to={`/leccion/${l.slug}`} onClick={onNavigate} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                  <span className="num">{String(lessonNumber(l.slug)).padStart(2, '0')}</span>
                  <span style={{ flex: 1 }}>{l.short ?? l.title}</span>
                  {visited.includes(l.slug) && <CheckCircle2 size={13} className="check" style={{ alignSelf: 'center' }} />}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function Layout() {
  const theme = useTheme()
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'
  const visited = useVisited()
  const done = LESSONS.filter((l) => visited.includes(l.slug)).length

  useEffect(() => setDrawer(false), [location.pathname])

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="icon-btn lg-hide" onClick={() => setDrawer(true)} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <Link to="/" className="brand">
            <Logo />
            <span>
              Agents<span className="brand-dim"> Workshop</span>
            </span>
          </Link>
          <div className="spacer" />
          <div className="topbar-progress sm-hide" title="Lecciones visitadas">
            <span>
              {done}/{LESSONS.length} lecciones
            </span>
            <span className="meter">
              <span style={{ width: `${(done / Math.max(1, LESSONS.length)) * 100}%` }} />
            </span>
          </div>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className={`shell${isHome ? ' no-sidebar' : ''}`}>
        {!isHome && (
          <aside className="sidebar">
            <Sidebar />
          </aside>
        )}
        <main className="main">
          <Outlet />
        </main>
      </div>

      {drawer && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer-panel">
            <div className="drawer-head">
              <Link to="/" className="brand">
                <Logo /> <span>Agents Workshop</span>
              </Link>
              <button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Cerrar menú">
                <X size={20} />
              </button>
            </div>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <footer className="footer">
        Agents Workshop · Taller visual para entender cómo funcionan los agentes de IA por dentro. Los datos, vectores y respuestas de
        los modelos son <strong>simulados</strong> con fines didácticos; los formatos de API y los algoritmos son los reales.
      </footer>
      <ScrollRestoration />
    </div>
  )
}
