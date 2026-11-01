# agents-workshop

Taller **visual e interactivo** (en español) para entender cómo funcionan los agentes de IA **por dentro**. Cada lección tiene una explicación breve y varios laboratorios: animaciones paso a paso, mapas de vectores, diagramas de flujo con mensajes viajando, payloads JSON reales y controles para jugar con los parámetros.

Los datos son **simulados pero realistas**: un retail ficticio (*Andes Market*) y su agente de soporte (*Andi*). Los **formatos de API y los algoritmos son los reales**: softmax con temperatura, BPE, similitud coseno, BM25, RRF, HNSW, bloques `tool_use`/`tool_result`, JSON-RPC de MCP, tareas de A2A, convenciones GenAI de OpenTelemetry.

Complementa a [`agents-learning`](../agents-learning) (la guía conceptual): aquí el foco es *ver el mecanismo*.

## Contenido

| Módulo | Lecciones |
|---|---|
| 1 · El modelo por dentro | Tokens · Predicción del siguiente token · Ventana de contexto |
| 2 · RAG | Embeddings · Ingesta e indexación · Índice HNSW · Consulta RAG de punta a punta · Búsqueda híbrida y reranking |
| 3 · Agentes | El ciclo del agente · Herramientas (a mano, nativo, frameworks) · Cómo "decide" el LLM · Memoria · Patrones multi-agente |
| 4 · Protocolos | MCP por dentro · A2A |
| 5 · Producción | Guardrails y prompt injection · Trazas, costos y evaluación |

## Stack

React 19 · React Router 8 · Vite 8 · TypeScript 7 · `lucide-react`. Sin librerías de gráficos ni animación: SVG + CSS + hooks propios.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build a dist/
npm run preview
```

## Estructura

```
src/
  components/      ui (Section, Lab, Callout, Slider, BarRow, VectorStrip…), Code (resaltador),
                   Player (animaciones por pasos), Messages (arreglo messages), Flow (diagramas SVG),
                   VectorMap (mapa semántico 2D), Layout
  sim/             simulación compartida: math (softmax, coseno…), embed (embeddings didácticos
                   de 16 dims), corpus (base de conocimiento de Andes Market), scenario (agente Andi,
                   herramientas, pedidos)
  lessons/<slug>/  meta.ts + index.tsx (+ subcomponentes y lesson.css). Se registran solas por glob.
  pages/           Home (mapa del taller), LessonPage, 404
docs/AUTHORING.md  convenciones para escribir lecciones
```

Para agregar una lección: crea `src/lessons/<slug>/meta.ts` y `src/lessons/<slug>/index.tsx`. Ver [`docs/AUTHORING.md`](docs/AUTHORING.md).

## Despliegue (Cloudflare Workers, solo assets)

`wrangler.toml` publica `dist/` como SPA (`not_found_handling = "single-page-application"`).

```bash
npx wrangler login
npm run deploy
```
