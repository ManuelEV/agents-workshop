# Guía de autoría · Agents Workshop

Taller **visual e interactivo** que muestra cómo funcionan los agentes de IA *por dentro*. Cada lección = explicación breve + laboratorios interactivos (animaciones paso a paso, controles, mapas, diagramas) con **datos simulados pero realistas**: formatos de API reales, algoritmos reales (softmax, coseno, BM25, RRF, HNSW…), datos de un retail ficticio.

Stack: React 19 + Vite 8 + TypeScript 7 + React Router 8. **Sin librerías extra**: SVG + CSS + hooks propios. Iconos: `lucide-react`.

## Idioma y tono

- Español neutro latinoamericano, **tuteo**. Técnico, directo, sin relleno ("En esta lección veremos…" ✗).
- Explicaciones cortas (párrafos de 2–4 frases) que preparan lo que el lab muestra. El lab es el protagonista.
- Sé honesto con la simulación: si algo es didáctico/simplificado, dilo en una frase (`<Callout tone="info">`).
- No inventes APIs. Usa formatos reales (Messages API de Anthropic: `tool_use`/`tool_result`/`stop_reason`; OpenAI: `tool_calls`; MCP: JSON-RPC 2.0 `initialize`, `tools/list`, `tools/call`; A2A: Agent Card, `message/send`, estados de Task). Para hechos de frameworks/protocolos puedes consultar `../agents-learning/src/content/*.mdx` y `../agents-learning/docs/research/*.md` (verificados a oct-2026).
- Modelo de ejemplo: `claude-sonnet-5-5` (exportado como `MODEL_ID` en `src/sim/scenario.ts`).

## Archivos de una lección

```
src/lessons/<slug>/
  meta.ts     ← ya existe (título, resumen, conceptos). Puedes ajustar summary/concepts/minutes.
  index.tsx   ← export default function Lesson() { ... }  (reemplaza el stub)
  *.tsx       ← subcomponentes de la lección (opcional, recomendado si index.tsx > 500 líneas)
  data.ts     ← datos simulados propios de la lección (opcional)
  lesson.css  ← estilos propios (opcional). Prefija TODAS las clases con el slug: `.tokens-xxx`
```

La cabecera (título, resumen, chips, navegación anterior/siguiente) la genera `LessonPage`. Tu componente devuelve solo el cuerpo: una secuencia de `<Section>`.

**No edites** archivos fuera de tu carpeta (`src/components`, `src/sim`, `src/styles.css`, otras lecciones). Si necesitas algo compartido, impleméntalo localmente en tu carpeta.

## Estructura recomendada

1. `Section n={1}` — la idea en 1–3 párrafos + un lab "de intuición".
2. `Section n={2..4}` — cómo funciona por dentro: un **lab paso a paso** (`usePlayer` + `PlayerBar` + `Narration`) que anime el mecanismo con datos concretos, y labs para jugar con parámetros (sliders, segmented, inputs).
3. Una sección práctica: código real corto (10–40 líneas) con `<Code>` (puedes resaltar líneas sincronizadas con los pasos), trade-offs (tabla `.tbl`), errores comunes (`<Callout>`).
4. Cierra con `<KeyIdeas items={[...]} />`.

Mínimo **2 labs** por lección, y al menos **uno animado paso a paso**. Apunta a 3–4.

## Componentes compartidos

```tsx
import { Section, Lab, Callout, KeyIdeas, Term, Pill, Panel, Segmented, Slider, Tabs, BarRow, VectorStrip, TokenChips, Stat, toneVar, type Tone } from '../../components/ui'
import { Code, Json, linesOf } from '../../components/Code'
import { PlayerBar, Narration, type StepInfo } from '../../components/Player'
import { MessageList, type Msg, type Block } from '../../components/Messages'
import { FlowDiagram, type FlowNode, type FlowEdge } from '../../components/Flow'
import { VectorMap, mapX, mapY, type MapPoint, type MapLink } from '../../components/VectorMap'
import { usePlayer, useTypewriter, useCountUp } from '../../lib/hooks'
```

| Componente | Uso |
|---|---|
| `<Section n title id?>` | bloque numerado con `<h2>`. Dentro: `<p>`, `<h3>`, listas, labs. |
| `<Lab title hint? badge? footer?>` | panel interactivo enmarcado. `hint` = instrucción breve ("Mueve la temperatura"). |
| `<Callout tone="info\|tip\|warn\|danger\|ok" title?>` | nota destacada. |
| `<KeyIdeas items={[...]} />` | resumen final. |
| `<Term tip="definición">palabra</Term>` | glosario al pasar el mouse. |
| `<Pill tone mono?>` | etiqueta coloreada. |
| `<Panel title tone right?>` | sub-panel dentro de un lab (cabecera mono). |
| `<Segmented options value onChange />` | selector de modo/escenario. |
| `<Slider label value min max step onChange format? />` | parámetro numérico. |
| `<Tabs tabs={[{id,label,content}]} numbered? />` | etapas o variantes. |
| `<BarRow label value max display tone off pick />` | barras horizontales (probabilidades, scores). |
| `<VectorStrip values size? labels? highlight? />` | vector como tira de celdas (azul negativo → naranja positivo). |
| `<TokenChips tokens={[{text,id,tone?}]} />` | tokens como fichas. |
| `<Stat label value tone sub />` | métrica. |
| `<Code code lang title highlight dim add del maxHeight />` | código con resaltado; `highlight` (1-based) se puede animar por paso. `linesOf(code, 'texto')` encuentra líneas. |
| `<Json value title />` | JSON formateado. |
| `usePlayer(n, {interval})` + `<PlayerBar player labels />` + `<Narration steps step />` | animación por pasos (play/pausa/anterior/siguiente, timeline clicable). `interval` puede ser función del paso. |
| `<MessageList messages highlight newFrom showTokens />` | el arreglo `messages` que se envía a la API (roles coloreados, bloques `tool_use`/`tool_result`). |
| `<FlowDiagram nodes edges width height flows active dimInactive onNodeClick />` | diagrama SVG; nodos por centro (x,y); `flows={['a>b']}` anima un paquete por la arista. Usa iconos lucide en `icon`. |
| `<VectorMap points query links radius showLabels onPointClick overlay />` | mapa semántico 2D (coords 0..100). |
| `useTypewriter(text, active, {cps, by})` | texto que se "genera" (streaming). |

### Colores semánticos (`tone`) — úsalos siempre igual

`user` (azul) usuario · `model` (violeta) LLM · `tool` (naranja) herramientas · `data` (verde) datos/vectores/RAG · `memory` (rosa) memoria · `guard` (ámbar) guardrails/avisos · `system` (gris) sistema/infra · `error` · `ok` · `accent`.

En CSS: `var(--c-user)`, `var(--c-model)`, … o `data-tone="tool"` en un elemento y luego `var(--tone)`. Superficies: `--bg`, `--bg-elev`, `--bg-sunken`, `--bg-inset`; texto: `--text`, `--text-2`, `--text-3`; bordes `--border`, `--border-strong`; fuentes `--font-mono`, `--font-display`. **Nunca hardcodees colores hex**: debe funcionar en tema claro y oscuro.

### Clases utilitarias

`.row` (flex con gap y wrap), `.stack` (columna), `.grid-2`, `.grid-3`, `.split` (1.25fr/1fr, colapsa en móvil), `.label`, `.muted`, `.mono`, `.small`, `.tabular`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.input`, `.textarea`, `.select`, `.table-wrap` + `table.tbl` (`tr.is-hl`, `td.num`), `.anim-in`, `.anim-fade`, `.caret` (cursor parpadeante).

## Simulación compartida (`src/sim/`)

- `math.ts`: `rng(seed)`, `hashString`, `cosine`, `dot`, `normalize`, `softmax(logits, T)`, `topPIndices`, `sampleIndex`, `countTokens` (≈ chars/3,8), `fmt`, `fmtInt`, `fmtUsd`, `pct`, `fold` (minúsculas sin tildes).
- `embed.ts`: modelo de embeddings didáctico de 16 dims (12 conceptos interpretables + 4 "matices"). `embed(text)`, `project(text)` → `[x,y]` 0..100, `analyze(text)` (qué palabras activaron cada concepto), `CONCEPTS`, `DIM_LABELS`, `embedAll`, `searchTopK`, `cellColor`, `vecToString`.
- `corpus.ts`: base de conocimiento de **Andes Market** (retail online chileno ficticio): `KB_DOCS`, `KB_CHUNKS` (un chunk por párrafo), `KB_INDEX` (chunks con `vector` y `xy`), `SAMPLE_QUERIES`, `chunkByWords(text, size, overlap)`.
- `scenario.ts`: agente de soporte **Andi**: `SYSTEM_PROMPT`, `TOOLS` (formato Anthropic: `name`, `description`, `input_schema`), `toOpenAITool`, `ORDERS` (pedidos 4821 en_ruta, 5102 preparando, 4790 entregado; cliente Camila Rojas), `runTool(name, input)`, `PRICING`, `MODEL_ID`.

Reutiliza este escenario para que todo el taller cuente una misma historia.

## Calidad visual

- Animaciones con propósito: cada paso muestra **qué dato cambia y dónde**. Destaca el elemento activo (tono + borde), atenúa lo demás.
- Responsive: los labs deben funcionar desde ~360 px (usa `.split`, `.grid-2`, `flex-wrap`, SVG con `viewBox`). Sin scroll horizontal de página (tablas dentro de `.table-wrap`, código con su propio scroll).
- Respeta `prefers-reduced-motion` (ya global para CSS).
- No uses `alert/confirm/prompt`.
- Accesibilidad: `aria-label` en SVG (`role="img"`), botones con texto o `aria-label`.

## Validación

```bash
npx tsc --noEmit     # 0 errores en tus archivos
```

El servidor de desarrollo es `npx vite` (http://localhost:5173/leccion/<slug>).
