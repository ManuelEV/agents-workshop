import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

/* Resaltador de sintaxis mínimo (sin dependencias). Suficiente para Python,
   TypeScript/JS, JSON, Bash y HTTP en ejemplos didácticos. */

export type Lang = 'python' | 'ts' | 'js' | 'json' | 'bash' | 'http' | 'text'

type Rule = [cls: string, re: RegExp]

const PY_KW =
  'def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|async|await|yield|lambda|None|True|False|pass|break|continue|global|is|match|case'
const TS_KW =
  'const|let|var|function|return|if|else|for|while|of|in|new|class|extends|import|from|export|default|async|await|try|catch|finally|throw|type|interface|null|undefined|true|false|this|typeof|as|switch|case|break'

const RULES: Record<Lang, Rule[]> = {
  python: [
    ['c', /#[^\n]*/y],
    ['s', /[rfb]?("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/y],
    ['d', /@[\w.]+/y],
    ['n', /\b\d+(?:\.\d+)?\b/y],
    ['k', new RegExp(`\\b(?:${PY_KW})\\b`, 'y')],
    ['b', /\b(?:print|len|str|int|float|dict|list|json|self|range|isinstance)\b/y],
    ['f', /\b[A-Za-z_]\w*(?=\()/y],
  ],
  ts: [
    ['c', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
    ['s', /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y],
    ['d', /@[\w.]+/y],
    ['n', /\b\d+(?:\.\d+)?\b/y],
    ['k', new RegExp(`\\b(?:${TS_KW})\\b`, 'y')],
    ['f', /\b[A-Za-z_$][\w$]*(?=\()/y],
    ['p', /\b[A-Za-z_$][\w$]*(?=\s*:(?!:))/y],
  ],
  js: [],
  json: [
    ['p', /"(?:\\.|[^"\\])*"(?=\s*:)/y],
    ['s', /"(?:\\.|[^"\\])*"/y],
    ['n', /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/y],
    ['k', /\b(?:true|false|null)\b/y],
  ],
  bash: [
    ['c', /#[^\n]*/y],
    ['s', /"(?:\\.|[^"\\])*"|'[^']*'/y],
    ['k', /\b(?:export|curl|npm|npx|pip|python|uv|git|cd|echo)\b/y],
    ['p', /--?[\w-]+/y],
  ],
  http: [
    ['k', /\b(?:GET|POST|PUT|DELETE|PATCH|HTTP\/[\d.]+)\b/y],
    ['p', /^[\w-]+(?=:)/my],
    ['s', /"(?:\\.|[^"\\])*"/y],
    ['n', /\b\d{3}\b/y],
  ],
  text: [],
}
RULES.js = RULES.ts

type Seg = [cls: string, text: string]

function tokenize(code: string, lang: Lang): Seg[] {
  const rules = RULES[lang] ?? []
  if (!rules.length) return [['', code]]
  const out: Seg[] = []
  let i = 0
  let plain = ''
  const flush = () => {
    if (plain) out.push(['', plain])
    plain = ''
  }
  outer: while (i < code.length) {
    for (const [cls, re] of rules) {
      re.lastIndex = i
      const m = re.exec(code)
      if (m && m[0].length > 0) {
        // evita marcar identificadores a mitad de palabra
        const prev = code[i - 1]
        if ((cls === 'k' || cls === 'n' || cls === 'b' || cls === 'f') && prev && /[\w$]/.test(prev)) continue
        flush()
        out.push([cls, m[0]])
        i += m[0].length
        continue outer
      }
    }
    plain += code[i]
    i++
  }
  flush()
  return out
}

function toLines(segs: Seg[]): Seg[][] {
  const lines: Seg[][] = [[]]
  for (const [cls, text] of segs) {
    const parts = text.split('\n')
    parts.forEach((p, idx) => {
      if (idx > 0) lines.push([])
      if (p) lines[lines.length - 1].push([cls, p])
    })
  }
  return lines
}

export type CodeProps = {
  code: string
  lang?: Lang
  title?: ReactNode
  /** líneas (1-based) resaltadas */
  highlight?: number[]
  /** atenúa las líneas no resaltadas */
  dim?: boolean
  add?: number[]
  del?: number[]
  lineNumbers?: boolean
  maxHeight?: number
  /** desplaza el bloque para mostrar la primera línea resaltada */
  follow?: boolean
}

export function Code({ code, lang = 'text', title, highlight, dim, add, del, lineNumbers = true, maxHeight, follow = true }: CodeProps) {
  const lines = useMemo(() => toLines(tokenize(code.replace(/\n$/, ''), lang)), [code, lang])
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const hl = new Set(highlight ?? [])
  const hlKey = (highlight ?? []).join(',')

  useEffect(() => {
    if (!follow || !highlight?.length || !preRef.current) return
    const pre = preRef.current
    const el = pre.querySelector<HTMLElement>(`[data-ln="${Math.min(...highlight)}"]`)
    if (!el) return
    const top = el.offsetTop - pre.clientHeight / 3
    pre.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlKey, follow])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* sin portapapeles */
    }
  }

  return (
    <div className="code">
      {(title || lang !== 'text') && (
        <div className="code-head">
          {title && <span className="title">{title}</span>}
          <span className="lang">{lang}</span>
          <button className="code-copy" onClick={copy} aria-label="Copiar código" title="Copiar">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}
      <pre ref={preRef} style={{ maxHeight, position: 'relative' }}>
        {lines.map((segs, i) => {
          const n = i + 1
          const cls = ['ln', hl.has(n) && 'hl', dim && highlight?.length && !hl.has(n) && 'dim', add?.includes(n) && 'add', del?.includes(n) && 'del']
            .filter(Boolean)
            .join(' ')
          return (
            <span key={i} className={cls} data-ln={n}>
              {lineNumbers && <span className="ln-num">{n}</span>}
              {segs.map(([c, t], j) =>
                c ? (
                  <span key={j} className={`tk-${c}`}>
                    {t}
                  </span>
                ) : (
                  t
                ),
              )}
            </span>
          )
        })}
      </pre>
    </div>
  )
}

/** Atajo: muestra un valor como JSON formateado. */
export function Json({ value, title, highlight, maxHeight }: { value: unknown; title?: ReactNode; highlight?: number[]; maxHeight?: number }) {
  return <Code code={JSON.stringify(value, null, 2)} lang="json" title={title} highlight={highlight} maxHeight={maxHeight} />
}

/** Encuentra las líneas (1-based) de `code` que contienen `needle` — útil para `highlight`. */
export function linesOf(code: string, ...needles: string[]): number[] {
  const out: number[] = []
  code.split('\n').forEach((l, i) => {
    if (needles.some((n) => l.includes(n))) out.push(i + 1)
  })
  return out
}
