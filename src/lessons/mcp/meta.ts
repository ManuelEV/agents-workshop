import type { LessonMeta } from '../types'

export const meta: LessonMeta = {
  slug: "mcp",
  module: "protocolos",
  order: 1,
  title: "MCP por dentro",
  short: "MCP",
  summary: "Model Context Protocol: mira los mensajes JSON-RPC reales entre host, cliente y servidor — initialize, tools/list, tools/call — y cómo terminan en el prompt.",
  minutes: 15,
  concepts: [
    "JSON-RPC",
    "host/cliente/servidor",
    "tools/list",
    "stdio",
    "Streamable HTTP"
  ]
}
