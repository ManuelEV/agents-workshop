import { useMemo } from 'react'
import { Code, Json } from '../../components/Code'
import { MessageList, msgTokens, type Msg } from '../../components/Messages'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { Lab, Panel, Pill, VectorStrip } from '../../components/ui'
import { VectorMap, type MapLink, type MapPoint } from '../../components/VectorMap'
import { usePlayer, useTypewriter } from '../../lib/hooks'
import { embed, project } from '../../sim/embed'
import { cosine, fmtInt } from '../../sim/math'
import { BASE_SYSTEM, EXTRACT_PROMPT, EXTRACTED, S2_QUERY, SESSION1 } from './data'

const THRESHOLD = 0.5
const ANSWER =
  '¡Hola de nuevo, Camila! Para trail te recomiendo las Zapatillas Trail Andes Pro: suela con tacos de 5 mm y muy buen agarre en barro y tierra suelta. Te las busco en talla 40, como tu último cambio. ¿Te las envío a Providencia o prefieres otra forma de entrega?'
const NO_MEMORY_ANSWER = '¡Hola! Te recomiendo las Zapatillas Trail Andes Pro. ¿Qué talla usas? ¿Y en qué comuna estás para ver opciones de entrega?'

const S1_VISIBLE = [2, 4, 7, 7, 7] // mensajes visibles de la sesión 1 en los pasos 0..4

export function SessionsLab() {
  const player = usePlayer(10, { interval: (s) => (s === 9 ? 6000 : s === 3 ? 4200 : 3200) })
  const step = player.step

  const mem = useMemo(() => {
    const qv = embed(S2_QUERY)
    return EXTRACTED.map((m) => {
      const v = embed(m.texto)
      return { ...m, vector: v, xy: project(m.texto), score: cosine(qv, v) }
    })
  }, [])
  const qxy = useMemo(() => project(S2_QUERY), [])
  const bySim = mem.filter((m) => m.tipo !== 'perfil' && m.score >= THRESHOLD).sort((a, b) => b.score - a.score).slice(0, 3)
  const byKey = mem.filter((m) => m.tipo === 'perfil')
  const loaded = new Set([...bySim, ...byKey].map((m) => m.id))

  const memBlock = `<memoria_del_cliente>
perfil (por clave): Camila Rojas · ${byKey.map((m) => m.texto).join(' · ')}
recuerdos relevantes (por similitud):
${bySim.map((m) => `- ${m.texto} [${m.score.toFixed(2)}]`).join('\n')}
</memoria_del_cliente>`

  const s1: Msg[] = SESSION1.slice(0, step <= 4 ? S1_VISIBLE[step] : SESSION1.length)
  const s2: Msg[] =
    step < 5
      ? []
      : [
          { role: 'system', content: step >= 8 ? `${BASE_SYSTEM}\n\n${memBlock}` : BASE_SYSTEM, note: step >= 8 ? '+ memoria inyectada' : undefined },
          ...(step >= 6 ? [{ role: 'user' as const, content: S2_QUERY }] : []),
        ]
  const typed = useTypewriter(ANSWER, step === 9, { cps: 70 })
  if (step === 9) s2.push({ role: 'assistant', content: typed.shown || '…' })

  const tok = (ms: Msg[]) => ms.reduce((s, m) => s + msgTokens(m), 0)
  const s1Dead = step >= 5

  const steps: StepInfo[] = [
    { title: 'Lunes: Camila escribe', body: <>Sesión 1. La ventana de contexto contiene el system prompt y su primer mensaje: eso es la memoria de corto plazo.</> },
    { title: 'Menciona dónde vive y cómo prefiere recibir', body: <>Cada turno se agrega al arreglo <code>messages</code> y se reenvía completo en la siguiente llamada.</> },
    { title: 'Fin de la conversación', body: <>Andi resolvió el cambio. Dentro de esta sesión lo “recuerda” todo… porque todo está en la ventana.</> },
    {
      title: 'Al cerrar: una llamada extra extrae recuerdos',
      body: <>Un LLM (puede ser uno más barato) lee la conversación y devuelve hechos duraderos en JSON. Ignora lo transitorio, como el n.º de cambio CAM-2291.</>,
    },
    { title: 'Se embeben y se guardan', body: <>Cada recuerdo se convierte en vector y se guarda en el memory store con su tipo y su clave, asociado al usuario.</> },
    { title: 'Domingo: sesión nueva, ventana vacía', body: <>La ventana del lunes ya no existe. Sin memoria de largo plazo, Andi no sabría nada de Camila.</> },
    { title: 'Camila pide una recomendación', body: <>Antes de llamar al LLM, la app embebe la pregunta para buscar recuerdos parecidos.</> },
    {
      title: 'Recuperación: similitud + clave',
      body: (
        <>
          Por similitud (umbral {THRESHOLD}) salen {bySim.map((m) => `“${m.texto.split(' (')[0].split(';')[0]}”`).join(' y ')}. El perfil se carga siempre por clave de usuario. “Retiro en tienda” no se parece a la pregunta y
          queda fuera.
        </>
      ),
    },
    { title: 'Se inyectan en el system prompt', body: <>Solo {loaded.size} recuerdos, ~{fmtInt(tok([{ role: 'system', content: memBlock }]))} tokens, no la conversación completa del lunes.</> },
    { title: 'La respuesta usa la talla 40', body: <>El modelo no “recuerda”: lee el bloque de memoria como cualquier otro texto del prompt.</> },
  ]

  const points: MapPoint[] = mem.map((m) => ({
    id: m.id,
    x: m.xy[0],
    y: m.xy[1],
    label: `${m.id} · ${m.clave}`,
    tip: m.texto,
    tone: 'memory',
    hl: step >= 7 && loaded.has(m.id),
    dim: step >= 7 && !loaded.has(m.id),
    enterDelay: step === 4 ? 0.2 + Number(m.id.slice(1)) * 0.15 : undefined,
  }))
  const links: MapLink[] = step >= 7 ? bySim.map((m) => ({ from: qxy, to: m.xy, label: m.score.toFixed(2), tone: 'memory' })) : []

  return (
    <Lab title="Dos sesiones con Andi" hint="Dale play: lunes → extracción → domingo" badge="Animación">
      <PlayerBar player={player} labels={steps.map((s) => s.title)} />
      <div style={{ margin: '12px 0' }}>
        <Narration steps={steps} step={step} />
      </div>

      <div className="grid-2">
        <div className={`memoria-window${s1Dead ? ' is-dead' : ''}${step <= 2 ? ' is-live' : ''}`}>
          <div className="memoria-window-head">
            <span>Sesión 1 · lunes 26-oct</span>
            <Pill tone="user" mono>
              {fmtInt(tok(s1))} tok
            </Pill>
          </div>
          <MessageList messages={s1} newFrom={step <= 2 ? (step === 0 ? 1 : S1_VISIBLE[step - 1]) : undefined} maxHeight={330} />
          {s1Dead && <div className="memoria-window-stamp">ventana descartada</div>}
        </div>
        <div className={`memoria-window${step >= 5 ? ' is-live' : ''}`}>
          <div className="memoria-window-head">
            <span>Sesión 2 · domingo 1-nov</span>
            <Pill tone="user" mono>
              {fmtInt(tok(s2))} tok
            </Pill>
          </div>
          {step < 5 ? (
            <div className="memoria-empty">Todavía no empieza.</div>
          ) : (
            <MessageList messages={s2} highlight={step >= 8 ? [0] : []} newFrom={step === 6 ? 1 : step === 9 ? 2 : undefined} maxHeight={330} />
          )}
          {step === 9 && typed.done && (
            <div className="memoria-contrast anim-fade">
              <span className="label">Sin memoria habría dicho</span>
              <div className="small">{NO_MEMORY_ANSWER}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Panel
          title="Memoria de largo plazo · user_id = camila.rojas"
          tone="memory"
          right={<span className="small muted">{step >= 4 ? `${mem.length} recuerdos` : 'vacía'}</span>}
        >
          {step <= 2 && (
            <div className="memoria-empty">
              Vacía. Por ahora todo vive en la ventana de la sesión 1: si se cierra, se pierde.
            </div>
          )}
          {step === 3 && (
            <div className="grid-2 anim-fade">
              <Code code={EXTRACT_PROMPT} lang="text" title="prompt del extractor (system)" />
              <Json value={EXTRACTED.map(({ tipo, clave, texto, confianza }) => ({ tipo, clave, texto, confianza }))} title="salida del extractor" />
            </div>
          )}
          {step >= 4 && (
            <div className="memoria-store-grid anim-fade">
              <div className="table-wrap" style={{ margin: 0 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>id</th>
                      <th>recuerdo</th>
                      <th>vector</th>
                      <th style={{ textAlign: 'right' }}>{step >= 7 ? 'sim.' : 'conf.'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mem.map((m) => (
                      <tr key={m.id} className={step >= 7 && loaded.has(m.id) ? 'is-hl' : undefined} style={{ opacity: step >= 7 && !loaded.has(m.id) ? 0.5 : 1 }}>
                        <td className="mono">{m.id}</td>
                        <td>
                          <div style={{ color: 'var(--text)' }}>{m.texto}</div>
                          <div className="row" style={{ gap: 4, marginTop: 3 }}>
                            <Pill tone={m.tipo === 'perfil' ? 'user' : m.tipo === 'preferencia' ? 'memory' : 'system'} mono>
                              {m.tipo}
                            </Pill>
                            {step >= 7 && m.tipo === 'perfil' && <Pill tone="ok">por clave</Pill>}
                            {step >= 7 && bySim.includes(m) && <Pill tone="memory">por similitud</Pill>}
                          </div>
                        </td>
                        <td>
                          <VectorStrip values={m.vector} size="sm" />
                        </td>
                        <td className="num">{step >= 7 ? m.score.toFixed(2) : m.confianza.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <VectorMap
                points={points}
                query={step >= 6 ? { x: qxy[0], y: qxy[1], label: 'pregunta' } : null}
                links={links}
                showLabels="all"
                ariaLabel="Recuerdos de Camila en el espacio de embeddings"
              />
            </div>
          )}
        </Panel>
      </div>
    </Lab>
  )
}
