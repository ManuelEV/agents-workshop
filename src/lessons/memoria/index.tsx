import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { CompactLab } from './CompactLab'
import { HygieneLab } from './HygieneLab'
import { KindsLab } from './KindsLab'
import { SessionsLab } from './SessionsLab'
import './lesson.css'

const MEMORY_CODE = `import json
import anthropic

client = anthropic.Anthropic()
MODEL = "claude-sonnet-5-5"

def cerrar_sesion(user_id: str, conversacion: list[dict]) -> None:
    """Al terminar: destila hechos duraderos y los consolida en el store."""
    r = client.messages.create(
        model=MODEL, max_tokens=600, system=PROMPT_EXTRACTOR,
        messages=[{"role": "user", "content": json.dumps(conversacion, ensure_ascii=False)}],
    )
    for hecho in json.loads(r.content[0].text):
        similares = store.search(user_id, embed(hecho["texto"]), k=3)
        op = decidir_operacion(hecho, similares)      # ADD / UPDATE / DELETE / NOOP
        store.apply(user_id, op)

def responder(user_id: str, historial: list[dict], pregunta: str) -> str:
    perfil = store.get(user_id, tipo="perfil")                          # por clave
    recuerdos = store.search(user_id, embed(pregunta), k=3, min_score=0.5)  # por similitud
    system = f"{SYSTEM_PROMPT}\\n\\n<memoria_del_cliente>\\n{formatear(perfil, recuerdos)}\\n</memoria_del_cliente>"
    r = client.messages.create(
        model=MODEL, max_tokens=800, system=system,
        messages=historial + [{"role": "user", "content": pregunta}],
    )
    return r.content[0].text`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="El modelo no recuerda nada">
        <p>
          Un LLM es <Term tip="Sin estado: cada llamada a la API es independiente. Todo lo que el modelo 'sabe' de la conversación es lo que le envías en esa llamada.">stateless</Term>: cada
          llamada empieza de cero. Lo que llamamos “memoria” es trabajo de <b>tu app</b>, que decide qué texto poner en la ventana de contexto en cada llamada.
        </p>
        <p>
          Hay tres tipos con tecnologías distintas: el <b>historial</b> de la sesión (corto plazo), el <b>estado de la tarea</b> (memoria de trabajo) y los <b>hechos destilados</b>{' '}
          que sobreviven entre sesiones (largo plazo).
        </p>
        <KindsLab />
      </Section>

      <Section n={2} title="De una sesión a otra">
        <p>
          El lunes Camila habla con Andi; el domingo vuelve y la ventana está vacía. Para que Andi “se acuerde”, al cerrar la primera sesión una llamada extra al LLM{' '}
          <b>extrae</b> hechos útiles, que se embeben y se guardan. En la segunda sesión se <b>recuperan</b> los relevantes y se <b>inyectan</b> en el prompt.
        </p>
        <SessionsLab />
        <Callout tone="tip" title="Similitud y clave, juntas">
          La recuperación por similitud trae lo que se parece a la pregunta; lo que siempre hace falta (nombre, comuna, idioma) conviene cargarlo por clave. “Prefiere retiro en
          tienda” no salió esta vez, y está bien: se buscaría cuando Camila llegue a elegir la entrega.
        </Callout>
      </Section>

      <Section n={3} title="Compactación: cuando el historial no cabe">
        <p>
          La memoria de corto plazo crece en cada turno, y los <code>tool_result</code> son los que más pesan. Cuando la conversación se acerca al límite (o al presupuesto que
          definas por costo), hay que <b>compactar</b>: conservar literal lo reciente y condensar lo antiguo.
        </p>
        <CompactLab />
        <Callout tone="warn" title="Un resumen también olvida">
          Recortar es gratis pero pierde datos sin aviso. Resumir conserva hechos, pero cuesta una llamada extra y puede borrar justo el detalle que importará diez turnos
          después. La opción más segura y barata suele ser limpiar resultados de herramientas antiguos primero. Nunca separes un <code>tool_use</code> de su{' '}
          <code>tool_result</code>: la API lo rechaza.
        </Callout>
      </Section>

      <Section n={4} title="Higiene: actualizar, olvidar, no guardar">
        <p>
          Un store que solo agrega se llena de contradicciones (“vive en Providencia” y “vive en Ñuñoa”). Las capas de memoria populares, como Mem0, siguen un patrón: por cada
          hecho nuevo buscan recuerdos parecidos y le piden al LLM que elija una operación: <b>ADD</b>, <b>UPDATE</b>, <b>DELETE</b> o <b>NOOP</b>.
        </p>
        <HygieneLab />
        <Callout tone="danger" title="La memoria es superficie de ataque y dato personal">
          Lo que se guarda se reinyecta en sesiones futuras: si un atacante logra que el agente “recuerde” una instrucción, la ejecutará después (<i>memory poisoning</i>). Filtra
          PII y datos de pago antes de guardar, acota todo por usuario, define TTL y ofrece borrado real, como exigen las leyes de protección de datos.
        </Callout>
        <Callout tone="info" title="Lo que está simulado">
          Las decisiones del store están guionadas para que el ejemplo sea claro; en un sistema real las toma un LLM con los recuerdos similares en el prompt. Las similitudes sí se
          calculan con el modelo de embeddings didáctico del taller.
        </Callout>
      </Section>

      <Section n={5} title="En código">
        <Code code={MEMORY_CODE} lang="python" title="memoria.py · store, embed, decidir_operacion y formatear son tuyos (o de tu capa de memoria)" />
        <p>
          Los frameworks ya traen piezas de esto: sesiones y checkpointers para el corto plazo, y servicios de memoria con extracción y consolidación gestionadas para el largo
          plazo. Lo que no te resuelven es <b>qué</b> vale la pena recordar: eso es diseño de producto.
        </p>
        <KeyIdeas
          items={[
            'El LLM es stateless: toda memoria es texto que tu app decide poner en la ventana en cada llamada.',
            'Corto plazo = historial de la sesión; trabajo = estado de la tarea; largo plazo = hechos destilados en un store externo.',
            'La memoria de largo plazo es un pipeline: extraer → embeber → guardar → recuperar (por similitud y por clave) → inyectar.',
            'Compactar mantiene lo reciente literal y condensa lo antiguo; limpiar tool_results viejos es lo más barato y seguro.',
            'Un store sano decide ADD / UPDATE / DELETE / NOOP, expira lo temporal y nunca guarda datos de pago ni secretos.',
          ]}
        />
      </Section>
    </>
  )
}
