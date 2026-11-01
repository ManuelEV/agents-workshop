import { Link } from 'react-router'
import { Callout, KeyIdeas, Section, Term } from '../../components/ui'
import { Code } from '../../components/Code'
import { PipelineLab } from './PipelineLab'
import { PiiLab } from './PiiLab'
import { PrivilegeLab } from './PrivilegeLab'
import './lesson.css'

const OWASP: [string, string, boolean][] = [
  ['LLM01', 'Prompt Injection', true],
  ['LLM02', 'Sensitive Information Disclosure', true],
  ['LLM03', 'Supply Chain', false],
  ['LLM04', 'Data and Model Poisoning', false],
  ['LLM05', 'Improper Output Handling', true],
  ['LLM06', 'Excessive Agency', true],
  ['LLM07', 'System Prompt Leakage', false],
  ['LLM08', 'Vector and Embedding Weaknesses', false],
  ['LLM09', 'Misinformation', false],
  ['LLM10', 'Unbounded Consumption', false],
]

const GATE = `HIGH_RISK = {"emitir_reembolso", "enviar_correo_externo"}

def autorizar(tool: str, args: dict, usuario: Usuario) -> Decision:
    """Se ejecuta ANTES de cada herramienta, fuera del modelo."""
    if tool not in ALLOWLIST[usuario.rol]:
        return Decision.deny("herramienta no permitida")
    pedido = args.get("pedido_id")
    if pedido and PEDIDOS[pedido].cliente_id != usuario.id:
        return Decision.deny("el pedido no es del usuario")
    if tool in HIGH_RISK or args.get("prioridad") == "alta":
        return Decision.hold("requiere aprobación humana")
    return Decision.allow()

# El resultado (allow / deny / hold + motivo) se registra siempre.`

export default function Lesson() {
  return (
    <>
      <Section n={1} title="Un agente que se equivoca, actúa">
        <p>
          Un chatbot engañado da una mala respuesta. Un agente engañado <strong>hace cosas</strong>: cambia una dirección, crea un ticket, envía datos.
          El riesgo aparece cuando se juntan tres cosas: acceso a datos privados, contenido no confiable y capacidad de actuar hacia afuera.
        </p>
        <p>
          La <Term tip="Instrucciones que un atacante cuela en el texto que procesa el modelo para cambiar su comportamiento.">prompt injection</Term> es
          el riesgo número uno del <strong>OWASP Top 10 for LLM Applications</strong> (2025). Puede ser <strong>directa</strong> (el usuario escribe
          "ignora tus instrucciones") o <strong>indirecta</strong>: viene escondida en un documento, una reseña, un correo o el resultado de una
          herramienta, y el usuario ni se entera.
        </p>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Riesgo (OWASP LLM 2025)</th>
                <th>En esta lección</th>
              </tr>
            </thead>
            <tbody>
              {OWASP.map(([id, name, here]) => (
                <tr key={id} className={here ? 'is-hl' : ''}>
                  <td className="mono">{id}</td>
                  <td>{name}</td>
                  <td>{here ? 'sí' : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={2} title="Defensa en profundidad">
        <p>
          Ningún filtro elimina la inyección. Por eso se apilan capas alrededor del agente: unas <strong>probabilísticas</strong> (clasificadores) que
          reducen cuántos ataques pasan, y otras <strong>deterministas</strong> (permisos, identidad, aprobación humana) que acotan el daño cuando uno
          pasa. Prueba cada ataque, apaga capas y observa dónde se detiene, o si no se detiene.
        </p>
        <PipelineLab />
        <Callout tone="info" title="Qué está simplificado">
          El clasificador del lab suma pesos de rasgos reconocibles y aplica una función logística; en producción se usa un modelo entrenado (por ejemplo
          el filtro de prompt attack de Bedrock Guardrails o Model Armor) que también se equivoca. Los detectores de PII sí son reales. La herramienta{' '}
          <code>consultar_resenas</code> existe solo en esta simulación.
        </Callout>
        <Callout tone="warn" title="Fíjate en el abuso de herramienta">
          "Cambia la dirección del pedido 5102" no tiene nada de malicioso como texto: ningún clasificador lo marca. Solo una regla que conoce la
          identidad del usuario lo detiene. Por eso los controles críticos van <strong>fuera del modelo</strong>.
        </Callout>
      </Section>

      <Section n={3} title="PII: detectar bien antes de enmascarar">
        <p>
          Enmascarar datos personales antes de que lleguen al modelo evita que terminen en el proveedor, en los logs y en las trazas. Pero una regex
          sola produce falsos positivos: cualquier número de 16 dígitos parece tarjeta. Validar con el algoritmo real (<strong>Luhn</strong> para
          tarjetas, <strong>módulo 11</strong> para el RUT) separa los datos reales del ruido.
        </p>
        <PiiLab />
        <Callout tone="tip">
          El modo <strong>seudónimo</strong> es reversible: el modelo razona con <code>[RUT_1]</code> y tu código, fuera del modelo, lo reemplaza por el
          valor real solo donde haga falta (por ejemplo, al llamar a una herramienta).
        </Callout>
      </Section>

      <Section n={4} title="Mínimo privilegio y aprobación humana">
        <p>
          La pregunta no es solo "¿pueden engañar a mi agente?" sino "si lo engañan, ¿qué puede hacer?". OWASP lo llama{' '}
          <strong>Excessive Agency</strong> (LLM06): más herramientas, permisos o autonomía de los necesarios. Dale a cada agente solo las herramientas de
          su rol, limitadas a los datos del usuario, y exige aprobación humana en lo irreversible.
        </p>
        <PrivilegeLab />
        <p>
          El control de herramientas es código normal que se ejecuta antes de cada llamada, con la identidad real del usuario y no con lo que diga el
          modelo:
        </p>
        <Code code={GATE} lang="python" title="autorizar.py (esquema)" highlight={[5, 8, 10]} />
        <Callout tone="danger" title="Registra todo">
          Cada decisión de cada capa (score, coincidencias, allow/deny, quién aprobó) debe quedar en un log de auditoría, con PII redactada. Sin eso no
          puedes investigar un incidente ni convertir ataques reales en casos de prueba. Más en{' '}
          <Link to="/leccion/observabilidad">Observabilidad</Link>; para amenazas propias de servidores MCP, revisa{' '}
          <Link to="/leccion/mcp">MCP por dentro</Link>.
        </Callout>
        <KeyIdeas
          items={[
            <>Asume que el modelo puede ser manipulado: los controles críticos van fuera de él.</>,
            <>
              La inyección <strong>indirecta</strong> llega en datos (reseñas, documentos, resultados de tools): revisa también lo que devuelven las
              herramientas.
            </>,
            <>Ninguna capa basta sola: los clasificadores reducen la frecuencia; permisos, identidad y aprobación humana acotan el impacto.</>,
            <>Enmascara PII antes del modelo y valida con algoritmos reales (Luhn, módulo 11) para evitar falsos positivos.</>,
            <>Mínimo privilegio: pocas herramientas, limitadas a los datos del usuario y con aprobación humana en lo irreversible.</>,
            <>Registra cada decisión de los guardrails: es tu evidencia de auditoría y tu fuente de casos de prueba.</>,
          ]}
        />
      </Section>
    </>
  )
}
