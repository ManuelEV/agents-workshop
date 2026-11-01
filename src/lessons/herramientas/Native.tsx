import { useState } from 'react'
import { ArrowLeft, ArrowRight, Cpu, Laptop, RefreshCw } from 'lucide-react'
import { Lab, Segmented } from '../../components/ui'
import { Code, linesOf } from '../../components/Code'
import { Narration, PlayerBar, type StepInfo } from '../../components/Player'
import { usePlayer } from '../../lib/hooks'
import { MODEL_ID, SYSTEM_PROMPT, TOOLS, runTool, toOpenAITool } from '../../sim/scenario'

/* ==========================================================================
   Nivel 2: function calling nativo. Las herramientas viajan en un campo
   estructurado de la API y la respuesta trae un bloque tool_use ya parseado.
   ========================================================================== */

const QUESTION = '¿Dónde está mi pedido 4821?'
const SHOWN_TOOLS = TOOLS.slice(0, 2)
const RESULT = runTool('buscar_pedido', { pedido_id: '4821' }).content
const FINAL = 'Tu pedido 4821 va en camino con Chilexpress (seguimiento CX-99812-CL). La entrega estimada es el miércoles 4 de noviembre.'
const SYS_SHORT = SYSTEM_PROMPT.split('\n')[0] + ' …'

const ANTHROPIC_CODE = `import json
from anthropic import Anthropic

client = Anthropic()
FUNCIONES = {"buscar_pedido": buscar_pedido, "consultar_politicas": consultar_politicas}

messages = [{"role": "user", "content": "¿Dónde está mi pedido 4821?"}]
while True:
    resp = client.messages.create(
        model="${MODEL_ID}", max_tokens=1024,
        system=SYSTEM_PROMPT, tools=TOOLS, messages=messages,
    )
    messages.append({"role": "assistant", "content": resp.content})
    if resp.stop_reason != "tool_use":
        break                                      # end_turn: respuesta final

    resultados = []
    for block in resp.content:
        if block.type == "tool_use":               # el modelo PIDE, tu código EJECUTA
            out = FUNCIONES[block.name](**block.input)
            resultados.append({"type": "tool_result", "tool_use_id": block.id,
                               "content": json.dumps(out)})
    messages.append({"role": "user", "content": resultados})

print(resp.content[0].text)`

const OPENAI_CODE = `import json
from openai import OpenAI

client = OpenAI()
FUNCIONES = {"buscar_pedido": buscar_pedido, "consultar_politicas": consultar_politicas}

messages = [{"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "¿Dónde está mi pedido 4821?"}]
while True:
    resp = client.chat.completions.create(
        model="gpt-5", tools=TOOLS_OPENAI, messages=messages,
    )
    msg = resp.choices[0].message
    messages.append(msg)
    if not msg.tool_calls:
        break                                      # finish_reason: "stop"

    for call in msg.tool_calls:                    # el modelo PIDE, tu código EJECUTA
        args = json.loads(call.function.arguments) # ¡los argumentos llegan como STRING!
        out = FUNCIONES[call.function.name](**args)
        messages.append({"role": "tool", "tool_call_id": call.id,
                         "content": json.dumps(out)})

print(msg.content)`

type Payload = { title: string; dir: 'req' | 'res' | 'local'; json: unknown; hl: string[]; addFrom?: string }

function anthropicPayloads(): Payload[] {
  const userMsg = { role: 'user', content: QUESTION }
  const assistantContent = [
    { type: 'text', text: 'Reviso tu pedido.' },
    { type: 'tool_use', id: 'toolu_01A9xK', name: 'buscar_pedido', input: { pedido_id: '4821' } },
  ]
  return [
    {
      title: 'POST /v1/messages · request 1',
      dir: 'req',
      json: { model: MODEL_ID, max_tokens: 1024, system: SYS_SHORT, tools: SHOWN_TOOLS, messages: [userMsg] },
      hl: ['"tools"', '"name"', '"input_schema"'],
    },
    {
      title: 'response 1',
      dir: 'res',
      json: { id: 'msg_01Xf3a', type: 'message', role: 'assistant', model: MODEL_ID, content: assistantContent, stop_reason: 'tool_use', usage: { input_tokens: 812, output_tokens: 64 } },
      hl: ['"tool_use"', '"stop_reason"', '"pedido_id"', '"name": "buscar_pedido"'],
    },
    {
      title: 'tu código ejecuta buscar_pedido(pedido_id="4821")',
      dir: 'local',
      json: RESULT,
      hl: ['"estado"', '"eta"'],
    },
    {
      title: 'POST /v1/messages · request 2',
      dir: 'req',
      json: {
        model: MODEL_ID,
        max_tokens: 1024,
        system: SYS_SHORT,
        tools: '… (las mismas 2 herramientas)',
        messages: [
          userMsg,
          { role: 'assistant', content: assistantContent },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01A9xK', content: JSON.stringify(RESULT) }] },
        ],
      },
      hl: ['"tool_result"', '"tool_use_id"'],
      addFrom: '"role": "assistant"',
    },
    {
      title: 'response 2',
      dir: 'res',
      json: { id: 'msg_01Xf9c', type: 'message', role: 'assistant', model: MODEL_ID, content: [{ type: 'text', text: FINAL }], stop_reason: 'end_turn', usage: { input_tokens: 1093, output_tokens: 41 } },
      hl: ['"stop_reason"', '"text": "Tu pedido'],
    },
  ]
}

function openaiPayloads(): Payload[] {
  const sys = { role: 'system', content: SYS_SHORT }
  const userMsg = { role: 'user', content: QUESTION }
  const toolCall = { id: 'call_7Qm2', type: 'function', function: { name: 'buscar_pedido', arguments: '{"pedido_id":"4821"}' } }
  return [
    {
      title: 'POST /v1/chat/completions · request 1',
      dir: 'req',
      json: { model: 'gpt-5', messages: [sys, userMsg], tools: SHOWN_TOOLS.map(toOpenAITool) },
      hl: ['"tools"', '"type": "function"', '"parameters"'],
    },
    {
      title: 'response 1',
      dir: 'res',
      json: { id: 'chatcmpl-9x1', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: [toolCall] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 790, completion_tokens: 22 } },
      hl: ['"tool_calls"', '"finish_reason"', '"arguments"'],
    },
    {
      title: 'tu código: json.loads(arguments) + buscar_pedido(...)',
      dir: 'local',
      json: RESULT,
      hl: ['"estado"', '"eta"'],
    },
    {
      title: 'POST /v1/chat/completions · request 2',
      dir: 'req',
      json: {
        model: 'gpt-5',
        messages: [sys, userMsg, { role: 'assistant', content: null, tool_calls: [toolCall] }, { role: 'tool', tool_call_id: 'call_7Qm2', content: JSON.stringify(RESULT) }],
        tools: '… (las mismas 2 herramientas)',
      },
      hl: ['"role": "tool"', '"tool_call_id"'],
      addFrom: '"role": "assistant"',
    },
    {
      title: 'response 2',
      dir: 'res',
      json: { id: 'chatcmpl-9x2', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: FINAL }, finish_reason: 'stop' }], usage: { prompt_tokens: 1012, completion_tokens: 38 } },
      hl: ['"finish_reason"', '"content": "Tu pedido'],
    },
  ]
}

const CODE_STEPS = {
  anthropic: (c: string) => [
    linesOf(c, 'client.messages.create', 'model=', 'system=SYSTEM_PROMPT', '    )'),
    linesOf(c, 'messages.append({"role": "assistant"', 'resp.stop_reason'),
    linesOf(c, 'for block in resp.content', 'block.type == "tool_use"', 'FUNCIONES[block.name]'),
    linesOf(c, 'resultados.append', '"content": json.dumps', 'messages.append({"role": "user", "content": resultados})', 'client.messages.create'),
    linesOf(c, 'break', 'print('),
  ],
  openai: (c: string) => [
    linesOf(c, 'client.chat.completions.create', 'model="gpt-5"', '    )'),
    linesOf(c, 'msg = resp.choices', 'messages.append(msg)', 'if not msg.tool_calls'),
    linesOf(c, 'for call in msg.tool_calls', 'json.loads(call.function.arguments)', 'FUNCIONES[call.function.name]'),
    linesOf(c, 'messages.append({"role": "tool"', '"content": json.dumps', 'client.chat.completions.create'),
    linesOf(c, 'break', 'print('),
  ],
}

export function NativeLab() {
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const code = provider === 'anthropic' ? ANTHROPIC_CODE : OPENAI_CODE
  const payloads = provider === 'anthropic' ? anthropicPayloads() : openaiPayloads()
  const codeSteps = CODE_STEPS[provider](code)

  const steps: StepInfo[] =
    provider === 'anthropic'
      ? [
          {
            title: 'Las herramientas viajan en el campo tools',
            body: (
              <>
                Cada herramienta es un <strong>JSON Schema</strong>: nombre, descripción e <code>input_schema</code>. Ya no hay instrucciones de
                formato en el prompt: el proveedor se encarga de presentárselas al modelo.
              </>
            ),
          },
          {
            title: 'La respuesta trae un bloque tool_use',
            body: (
              <>
                <code>stop_reason: "tool_use"</code> te avisa que el modelo quiere una herramienta. El bloque trae <code>name</code> e{' '}
                <code>input</code> ya parseado como objeto, más un <code>id</code> para enlazar la respuesta.
              </>
            ),
          },
          {
            title: 'Tu código ejecuta la función',
            body: 'Igual que antes, el modelo solo pidió. Tú buscas la función por nombre y la ejecutas con los argumentos. Sin regex, sin json.loads frágiles.',
          },
          {
            title: 'Reenvías todo + el tool_result',
            body: (
              <>
                Agregas el turno del asistente (con su <code>tool_use</code>) y un mensaje <code>user</code> con un bloque{' '}
                <code>tool_result</code> que referencia el mismo <code>tool_use_id</code>. Las líneas verdes son lo nuevo.
              </>
            ),
          },
          { title: 'end_turn: respuesta final', body: 'Con el resultado en el contexto, el modelo responde en texto y stop_reason pasa a "end_turn". El bucle termina.' },
        ]
      : [
          {
            title: 'Las herramientas viajan en el campo tools',
            body: (
              <>
                En OpenAI cada herramienta va envuelta en <code>{'{type: "function", function: {...}}'}</code> y el esquema se llama{' '}
                <code>parameters</code>. Es el mismo JSON Schema.
              </>
            ),
          },
          {
            title: 'La respuesta trae tool_calls',
            body: (
              <>
                <code>finish_reason: "tool_calls"</code>. Ojo: <code>arguments</code> llega como un <strong>string</strong> JSON, no como objeto.
              </>
            ),
          },
          { title: 'Tu código ejecuta la función', body: 'json.loads de los argumentos y llamas a la función real.' },
          {
            title: 'Reenvías todo + un mensaje role "tool"',
            body: (
              <>
                El resultado va en un mensaje con <code>role: "tool"</code> y el mismo <code>tool_call_id</code>. Las líneas verdes son lo nuevo.
              </>
            ),
          },
          { title: 'finish_reason: "stop"', body: 'El modelo responde en texto y el bucle termina.' },
        ]

  const player = usePlayer(steps.length, { interval: 3600 })
  const s = player.step
  const p = payloads[s]
  const jsonText = JSON.stringify(p.json, null, 2)
  const hl = linesOf(jsonText, ...p.hl)
  let add: number[] | undefined
  if (p.addFrom) {
    const lines = jsonText.split('\n')
    const start = lines.findIndex((l) => l.includes(p.addFrom!))
    const msgsEnd = lines.findIndex((l, i) => i > start && /^ {2}\]/.test(l))
    if (start > 0) add = Array.from({ length: (msgsEnd > 0 ? msgsEnd : lines.length - 1) - start + 1 }, (_, i) => start + i)
  }

  return (
    <Lab title="Function calling nativo: el contrato estructurado" hint="Compara proveedores en cualquier paso">
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Segmented
            value={provider}
            onChange={setProvider}
            options={[
              { value: 'anthropic', label: 'Anthropic · Messages API' },
              { value: 'openai', label: 'OpenAI · Chat Completions' },
            ]}
          />
          <div className="tools-wire" data-dir={p.dir}>
            <span className="tools-wire-node" data-tone="tool">
              <Laptop size={15} /> tu app
            </span>
            <span className="tools-wire-arrow">
              {p.dir === 'req' && <ArrowRight size={18} />}
              {p.dir === 'res' && <ArrowLeft size={18} />}
              {p.dir === 'local' && <RefreshCw size={16} />}
            </span>
            <span className="tools-wire-node" data-tone="model">
              <Cpu size={15} /> API del modelo
            </span>
          </div>
        </div>
        <div className="grid-2">
          <Code code={code} lang="python" title={provider === 'anthropic' ? 'agente_anthropic.py' : 'agente_openai.py'} highlight={codeSteps[s]} dim maxHeight={460} />
          <div key={provider + s} className="anim-fade">
            <Code code={jsonText} lang="json" title={p.title} highlight={hl} add={add} maxHeight={460} />
          </div>
        </div>
        <Narration steps={steps} step={s} />
        <PlayerBar player={player} labels={steps.map((x) => x.title)} />
      </div>
    </Lab>
  )
}
