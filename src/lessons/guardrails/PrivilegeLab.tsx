import { useState } from 'react'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Lab, Panel, Pill, Stat, type Tone } from '../../components/ui'
import { PRESETS, PRIV_TOOLS, USE_CASES, riskLevel, toolRisk, type Perm } from './data'

const LEVEL_TONE: Record<string, Tone> = { ninguno: 'system', bajo: 'ok', medio: 'guard', alto: 'error' }
const MAX_RISK = PRIV_TOOLS.reduce((a, t) => a + toolRisk(t, { on: true, scoped: false, approval: false }), 0)

export function PrivilegeLab() {
  const [perms, setPerms] = useState<Record<string, Perm>>(PRESETS.todo)
  const set = (id: string, k: keyof Perm) => setPerms((p) => ({ ...p, [id]: { ...p[id], [k]: !p[id][k] } }))

  const risks = PRIV_TOOLS.map((t) => toolRisk(t, perms[t.id]))
  const total = risks.reduce((a, b) => a + b, 0)
  const pct = total / MAX_RISK
  const totalLevel = pct < 0.15 ? 'bajo' : pct < 0.4 ? 'medio' : 'alto'
  const covered = USE_CASES.filter((u) => perms[u.needs]?.on).length
  const exposed = PRIV_TOOLS.filter((_, i) => risks[i] >= 1)

  return (
    <Lab title="Mínimo privilegio: los permisos de Andi" hint="Activa permisos y mira el riesgo">
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        <span className="label">Presets</span>
        <button className="btn btn-sm" onClick={() => setPerms(PRESETS.todo)}>
          Todo habilitado
        </button>
        <button className="btn btn-sm" onClick={() => setPerms(PRESETS.lectura)}>
          Solo lectura
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => setPerms(PRESETS.minimo)}>
          Mínimo privilegio
        </button>
      </div>
      <div className="table-wrap" style={{ marginTop: 0 }}>
        <table className="tbl guardrails-matrix">
          <thead>
            <tr>
              <th>Herramienta</th>
              <th>Tipo</th>
              <th>Habilitada</th>
              <th>Solo datos del usuario</th>
              <th>Aprobación humana</th>
              <th>Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {PRIV_TOOLS.map((t, i) => {
              const p = perms[t.id]
              const lvl = riskLevel(risks[i])
              return (
                <tr key={t.id} className={p.on ? '' : 'is-off'}>
                  <td>
                    <span className="mono" style={{ color: 'var(--text)' }}>
                      {t.id}
                    </span>
                    <div className="small muted">{t.desc}</div>
                  </td>
                  <td>
                    <Pill tone={t.kind === 'lectura' ? 'data' : 'tool'}>{t.kind}</Pill>
                  </td>
                  <td>
                    <input type="checkbox" checked={p.on} onChange={() => set(t.id, 'on')} aria-label={`Habilitar ${t.id}`} />
                  </td>
                  <td>
                    {t.scopable ? (
                      <input type="checkbox" checked={p.scoped} disabled={!p.on} onChange={() => set(t.id, 'scoped')} aria-label={`Restringir ${t.id} al usuario`} />
                    ) : (
                      <span className="muted small">n/a</span>
                    )}
                  </td>
                  <td>
                    {t.kind === 'escritura' ? (
                      <input type="checkbox" checked={p.approval} disabled={!p.on} onChange={() => set(t.id, 'approval')} aria-label={`Aprobación humana para ${t.id}`} />
                    ) : (
                      <span className="muted small">n/a</span>
                    )}
                  </td>
                  <td>
                    <Pill tone={LEVEL_TONE[lvl]}>{lvl}</Pill>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="grid-3" style={{ marginTop: 14 }}>
        <div className="stack" style={{ gap: 8 }}>
          <Stat label="Riesgo total" value={`${Math.round(pct * 100)}%`} tone={LEVEL_TONE[totalLevel]} sub={`nivel ${totalLevel}`} />
          <div className="guardrails-meter" data-tone={LEVEL_TONE[totalLevel]}>
            <span style={{ width: `${Math.min(100, pct * 100)}%` }} />
          </div>
          <Stat label="Casos cubiertos" value={`${covered}/${USE_CASES.length}`} tone={covered === USE_CASES.length ? 'ok' : 'guard'} />
        </div>
        <Panel title="¿Andi puede ayudar?" tone="user">
          <ul className="guardrails-cases">
            {USE_CASES.map((u) => {
              const p = perms[u.needs]
              const icon = !p.on ? <XCircle size={15} color="var(--c-error)" /> : p.approval ? <Clock size={15} color="var(--c-guard)" /> : <CheckCircle2 size={15} color="var(--c-ok)" />
              return (
                <li key={u.q}>
                  {icon}
                  <span>
                    {u.q}
                    {p.on && p.approval && <span className="muted small"> · con aprobación</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
        <Panel title="Si lo inyectan, podría…" tone="error">
          {exposed.length ? (
            <ul className="guardrails-cases">
              {exposed.map((t) => (
                <li key={t.id}>
                  <XCircle size={15} color="var(--c-error)" />
                  <span>
                    {t.abuse} <span className="mono muted small">({t.id})</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="small" style={{ color: 'var(--text-2)' }}>
              Nada grave sin que una persona lo apruebe: el radio de daño quedó acotado.
            </div>
          )}
        </Panel>
      </div>
      <p className="small muted" style={{ margin: '12px 0 0' }}>
        Puntaje didáctico: impacto de la herramienta × 1,5 si escribe × 0,4 si se limita a los datos del usuario × 0,3 si requiere aprobación humana.
      </p>
    </Lab>
  )
}
