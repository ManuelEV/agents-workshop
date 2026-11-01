import { useMemo, useState, type MouseEvent } from 'react'
import { Lab, Panel, Pill, Segmented } from '../../components/ui'
import { Code } from '../../components/Code'

type PartId = 'server' | 'model' | 'decorator' | 'name' | 'params' | 'default' | 'return' | 'doc' | 'body' | 'run'

const PARTS: Record<PartId, { label: string; explain: string }> = {
  server: {
    label: 'MCPServer("andes-pedidos")',
    explain: 'El nombre del servidor no aparece en tools/list: viaja como serverInfo.name en initialize (o server/discover). En el SDK v2, FastMCP pasó a llamarse MCPServer.',
  },
  model: {
    label: 'class EstadoPedido',
    explain: 'Un modelo Pydantic describe la forma del resultado. Al usarlo como tipo de retorno, el SDK genera el outputSchema y devuelve structuredContent además del texto.',
  },
  decorator: {
    label: '@mcp.tool()',
    explain: 'El decorador registra la función como herramienta: desde ahora aparece como un elemento de tools[] y el servidor la ejecuta cuando llega un tools/call con su nombre.',
  },
  name: {
    label: 'def buscar_pedido',
    explain: 'El nombre de la función es el name de la tool. Es lo que el modelo escribirá en tool_use y lo que viaja en tools/call. Elige nombres claros: el modelo decide en parte por ellos.',
  },
  params: {
    label: 'pedido_id: str',
    explain: 'Cada parámetro con type hint se vuelve una propiedad del inputSchema (str → string, int → integer). Sin valor por defecto, va en required. Con Annotated + Field agregas descripción y restricciones que el modelo sí ve.',
  },
  default: {
    label: 'incluir_items: bool = False',
    explain: 'Un valor por defecto hace el parámetro opcional: queda fuera de required y aparece "default": false en el esquema.',
  },
  return: {
    label: '-> EstadoPedido',
    explain: 'El tipo de retorno se convierte en outputSchema. El cliente puede validar structuredContent contra él antes de usarlo.',
  },
  doc: {
    label: 'docstring',
    explain: 'El docstring es la description: el texto que el modelo lee para decidir cuándo usar la herramienta. Escríbelo para el modelo, no para otro programador.',
  },
  body: {
    label: 'cuerpo de la función',
    explain: 'El cuerpo nunca se publica: el modelo solo ve el contrato (nombre, descripción, esquemas). Lo que retornas llega al cliente como content + structuredContent en la respuesta de tools/call.',
  },
  run: {
    label: 'mcp.run(transport="stdio")',
    explain: 'Elige el transporte. "stdio" para que un host lo lance como subproceso; "streamable-http" para servirlo en /mcp como servicio remoto.',
  },
}

type L = { t: string; p?: PartId }

function pyLines(o: { type: 'str' | 'int'; field: boolean; items: boolean; doc: boolean }): L[] {
  const hint = o.field
    ? o.type === 'str'
      ? 'Annotated[str, Field(description="Número de pedido de 4 dígitos", pattern=r"^\\d{4}$")]'
      : 'Annotated[int, Field(description="Número de pedido de 4 dígitos", ge=1000, le=9999)]'
    : o.type
  const lines: L[] = [
    { t: '# pip install "mcp[cli]"   (SDK v2)' },
    ...(o.field ? [{ t: 'from typing import Annotated' }] : []),
    { t: o.field ? 'from pydantic import BaseModel, Field' : 'from pydantic import BaseModel' },
    { t: 'from mcp.server import MCPServer' },
    { t: '' },
    { t: 'mcp = MCPServer("andes-pedidos")', p: 'server' },
    { t: 'PEDIDOS = {"4821": {"estado": "en_ruta", "eta": "2026-11-04"}}' },
    { t: '' },
    { t: 'class EstadoPedido(BaseModel):', p: 'model' },
    { t: '    pedido_id: str', p: 'model' },
    { t: '    estado: str', p: 'model' },
    { t: '    eta: str | None', p: 'model' },
    { t: '' },
    { t: '@mcp.tool()', p: 'decorator' },
    { t: 'def buscar_pedido(', p: 'name' },
    { t: `    pedido_id: ${hint},`, p: 'params' },
    ...(o.items ? [{ t: '    incluir_items: bool = False,', p: 'default' as PartId }] : []),
    { t: ') -> EstadoPedido:', p: 'return' },
    ...(o.doc ? [{ t: '    """Obtiene estado y fecha estimada de un pedido de Andes Market."""', p: 'doc' as PartId }] : []),
    { t: `    datos = PEDIDOS[${o.type === 'int' ? 'str(pedido_id)' : 'pedido_id'}]`, p: 'body' },
    { t: `    return EstadoPedido(pedido_id=${o.type === 'int' ? 'str(pedido_id)' : 'pedido_id'}, **datos)`, p: 'body' },
    { t: '' },
    { t: 'if __name__ == "__main__":' },
    { t: '    mcp.run(transport="stdio")', p: 'run' },
  ]
  return lines
}

function toolJson(o: { type: 'str' | 'int'; field: boolean; items: boolean; doc: boolean }) {
  const pid: Record<string, unknown> = {}
  if (o.field) pid.description = 'Número de pedido de 4 dígitos'
  if (o.field && o.type === 'str') pid.pattern = '^\\d{4}$'
  if (o.field && o.type === 'int') {
    pid.maximum = 9999
    pid.minimum = 1000
  }
  pid.title = 'Pedido Id'
  pid.type = o.type === 'str' ? 'string' : 'integer'
  const props: Record<string, unknown> = { pedido_id: pid }
  if (o.items) props.incluir_items = { default: false, title: 'Incluir Items', type: 'boolean' }
  const tool: Record<string, unknown> = { name: 'buscar_pedido' }
  if (o.doc) tool.description = 'Obtiene estado y fecha estimada de un pedido de Andes Market.'
  tool.inputSchema = { type: 'object', properties: props, required: ['pedido_id'], title: 'buscar_pedidoArguments' }
  tool.outputSchema = {
    type: 'object',
    properties: {
      pedido_id: { title: 'Pedido Id', type: 'string' },
      estado: { title: 'Estado', type: 'string' },
      eta: { anyOf: [{ type: 'string' }, { type: 'null' }], title: 'Eta' },
    },
    required: ['pedido_id', 'estado', 'eta'],
    title: 'EstadoPedido',
  }
  return JSON.stringify({ tools: [tool] }, null, 2)
}

/** Líneas (1-based) del bloque que abre la clave `key` (a partir de `from`). */
function block(json: string, key: string, from = 0): number[] {
  const ls = json.split('\n')
  const i = ls.findIndex((l, idx) => idx >= from && l.includes(`"${key}":`))
  if (i < 0) return []
  const line = ls[i]
  if (!/[[{]$/.test(line.trimEnd())) return [i + 1]
  const indent = line.length - line.trimStart().length
  for (let j = i + 1; j < ls.length; j++) {
    const ind = ls[j].length - ls[j].trimStart().length
    if (ind === indent && /^[\]}]/.test(ls[j].trimStart())) return Array.from({ length: j - i + 1 }, (_, k) => i + k + 1)
  }
  return [i + 1]
}

function jsonLinesFor(part: PartId, json: string): number[] {
  const ls = json.split('\n')
  const lineOf = (s: string) => {
    const i = ls.findIndex((l) => l.includes(s))
    return i < 0 ? [] : [i + 1]
  }
  const inputAt = ls.findIndex((l) => l.includes('"inputSchema"'))
  switch (part) {
    case 'decorator':
      return [...lineOf('"tools"'), ...lineOf('"name": "buscar_pedido"')]
    case 'name':
      return lineOf('"name": "buscar_pedido"')
    case 'doc':
      return lineOf('"description": "Obtiene')
    case 'params':
      return [...block(json, 'pedido_id', inputAt), ...block(json, 'required', inputAt)]
    case 'default':
      return [...block(json, 'incluir_items', inputAt), ...block(json, 'required', inputAt)]
    case 'return':
    case 'model':
      return block(json, 'outputSchema')
    default:
      return []
  }
}

export function ServerLab() {
  const [type, setType] = useState<'str' | 'int'>('str')
  const [field, setField] = useState(false)
  const [items, setItems] = useState(true)
  const [doc, setDoc] = useState(true)
  const [part, setPart] = useState<PartId>('doc')
  const opts = { type, field, items, doc }

  const py = useMemo(() => pyLines(opts), [type, field, items, doc]) // eslint-disable-line react-hooks/exhaustive-deps
  const json = useMemo(() => toolJson(opts), [type, field, items, doc]) // eslint-disable-line react-hooks/exhaustive-deps
  const pyCode = py.map((l) => l.t).join('\n')
  const pyHl = py.flatMap((l, i) => (l.p === part ? [i + 1] : []))
  const jsonHl = jsonLinesFor(part, json)

  const onCodeClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest('[data-ln]')
    if (!el) return
    const n = Number(el.getAttribute('data-ln'))
    const p = py[n - 1]?.p
    if (p) setPart(p)
  }

  const available = (Object.keys(PARTS) as PartId[]).filter((p) => py.some((l) => l.p === p))

  return (
    <Lab
      title="Construye tu servidor: del código al tools/list"
      hint="Haz clic en una línea del código"
      footer={
        <span className="small muted">
          Esquemas como los genera Pydantic (incluye los <code>title</code> automáticos). Los detalles exactos pueden variar entre versiones del SDK.
        </span>
      }
    >
      <div className="row" style={{ marginBottom: 12, gap: 14 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="label">pedido_id</span>
          <Segmented
            options={[
              { value: 'str', label: 'str' },
              { value: 'int', label: 'int' },
            ]}
            value={type}
            onChange={setType}
          />
        </div>
        <label className="mcp-check">
          <input type="checkbox" checked={field} onChange={(e) => setField(e.target.checked)} /> Annotated + Field
        </label>
        <label className="mcp-check">
          <input type="checkbox" checked={items} onChange={(e) => setItems(e.target.checked)} /> parámetro opcional
        </label>
        <label className="mcp-check">
          <input type="checkbox" checked={doc} onChange={(e) => setDoc(e.target.checked)} /> docstring
        </label>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        {available.map((p) => (
          <button key={p} className={`mcp-part-chip${p === part ? ' is-on' : ''}`} onClick={() => setPart(p)}>
            {PARTS[p].label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div className="mcp-clickcode" onClick={onCodeClick}>
          <Code code={pyCode} lang="python" title="server.py" highlight={pyHl} maxHeight={460} follow={false} />
        </div>
        <Code code={json} lang="json" title="result de tools/list (lo que ve el host)" highlight={jsonHl} maxHeight={460} />
      </div>
      <div style={{ marginTop: 12 }} className="anim-fade" key={part}>
        <Panel title={PARTS[part].label} tone="tool" right={jsonHl.length ? <Pill tone="ok">aparece en tools/list</Pill> : <Pill>no aparece en tools/list</Pill>}>
          <div className="small" style={{ color: 'var(--text-2)' }}>
            {part === 'doc' && !doc ? 'Sin docstring no hay description: el modelo solo ve el nombre y el esquema.' : PARTS[part].explain}
          </div>
        </Panel>
      </div>
    </Lab>
  )
}
