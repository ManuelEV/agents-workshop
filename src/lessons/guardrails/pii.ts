/* Detectores de PII con validación real:
   - RUT chileno: dígito verificador por módulo 11 (factores 2..7 desde la derecha).
   - Tarjeta: algoritmo de Luhn.
   - Email y teléfono móvil chileno (+56 9 XXXX XXXX): solo formato. */

export type PiiKind = 'rut' | 'tarjeta' | 'email' | 'telefono'

export const PII_LABEL: Record<PiiKind, string> = { rut: 'RUT', tarjeta: 'TARJETA', email: 'EMAIL', telefono: 'TELÉFONO' }

export type PiiMatch = { kind: PiiKind; start: number; end: number; text: string; valid: boolean; why: string }

/* ---------------- RUT ---------------- */

export type RutCalc = { digits: { d: number; f: number; p: number }[]; sum: number; mod: number; dv: string; given: string; valid: boolean }

export function rutCalc(raw: string): RutCalc {
  const clean = raw.replace(/[.\s]/g, '').toUpperCase()
  const [body, given = ''] = clean.split('-')
  const digits: RutCalc['digits'] = []
  let f = 2
  for (let i = body.length - 1; i >= 0; i--) {
    const d = Number(body[i])
    digits.push({ d, f, p: d * f })
    f = f === 7 ? 2 : f + 1
  }
  const sum = digits.reduce((a, x) => a + x.p, 0)
  const mod = sum % 11
  const r = 11 - mod
  const dv = r === 11 ? '0' : r === 10 ? 'K' : String(r)
  return { digits, sum, mod, dv, given, valid: dv === given }
}

/* ---------------- Luhn ---------------- */

export type LuhnCalc = { cells: { d: number; doubled: boolean; v: number }[]; sum: number; valid: boolean; brand: string }

export function luhnCalc(raw: string): LuhnCalc {
  const ds = raw.replace(/\D/g, '')
  const cells: LuhnCalc['cells'] = []
  for (let i = 0; i < ds.length; i++) {
    const d = Number(ds[i])
    const fromRight = ds.length - 1 - i
    const doubled = fromRight % 2 === 1
    const v = doubled ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d
    cells.push({ d, doubled, v })
  }
  const sum = cells.reduce((a, c) => a + c.v, 0)
  const brand = /^4/.test(ds) ? 'Visa' : /^5[1-5]/.test(ds) ? 'Mastercard' : /^3[47]/.test(ds) ? 'Amex' : 'desconocida'
  return { cells, sum, valid: ds.length >= 13 && ds.length <= 19 && sum % 10 === 0, brand }
}

/* ---------------- detección ---------------- */

const RX: { kind: PiiKind; re: RegExp }[] = [
  { kind: 'tarjeta', re: /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g },
  { kind: 'rut', re: /(?<![\d.])(?:\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[\dkK](?![\w])/g },
  { kind: 'email', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { kind: 'telefono', re: /(?<![\w+])(?:\+?56[\s-]?)?9[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g },
]

export function detectPii(text: string, kinds: PiiKind[] = ['tarjeta', 'rut', 'email', 'telefono']): PiiMatch[] {
  const found: PiiMatch[] = []
  for (const { kind, re } of RX) {
    if (!kinds.includes(kind)) continue
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const t = m[0]
      let valid = true
      let why = 'formato válido'
      if (kind === 'rut') {
        const c = rutCalc(t)
        valid = c.valid
        why = valid ? `DV ${c.dv} correcto (módulo 11)` : `DV esperado ${c.dv}, viene ${c.given}`
      } else if (kind === 'tarjeta') {
        const c = luhnCalc(t)
        valid = c.valid
        why = valid ? `Luhn ✓ · ${c.brand}` : `Luhn ✗ (suma ${c.sum}, no es múltiplo de 10)`
      }
      found.push({ kind, start: m.index, end: m.index + t.length, text: t, valid, why })
    }
  }
  // sin solapamientos: gana el que empieza antes; a igual inicio, el más largo
  found.sort((a, b) => a.start - b.start || b.end - a.end)
  const out: PiiMatch[] = []
  for (const f of found) {
    if (out.length && f.start < out[out.length - 1].end) continue
    out.push(f)
  }
  return out
}

export type MaskMode = 'etiqueta' | 'parcial' | 'seudonimo'

/** Reemplaza las coincidencias válidas. En modo seudónimo, el mismo valor recibe siempre el mismo token. */
export function maskPii(text: string, matches: PiiMatch[], mode: MaskMode): { masked: string; vault: [string, string][] } {
  let out = ''
  let i = 0
  const vault = new Map<string, [token: string, original: string]>()
  const counters: Record<PiiKind, number> = { rut: 0, tarjeta: 0, email: 0, telefono: 0 }
  for (const m of matches) {
    if (!m.valid) continue
    out += text.slice(i, m.start)
    let rep: string
    if (mode === 'etiqueta') rep = `[${PII_LABEL[m.kind]}]`
    else if (mode === 'parcial') {
      const digits = m.text.replace(/\D/g, '')
      rep =
        m.kind === 'tarjeta'
          ? `[TARJETA ••••${digits.slice(-4)}]`
          : m.kind === 'email'
            ? `${m.text[0]}•••@${m.text.split('@')[1]}`
            : m.kind === 'telefono'
              ? `+56 9 •••• ${digits.slice(-4)}`
              : `••.•••.${digits.slice(-4, -1)}-•`
    } else {
      const key = `${m.kind}:${m.text.replace(/[\s.-]/g, '').toUpperCase()}`
      if (!vault.has(key)) vault.set(key, [`[${PII_LABEL[m.kind]}_${++counters[m.kind]}]`, m.text])
      rep = vault.get(key)![0]
    }
    out += rep
    i = m.end
  }
  out += text.slice(i)
  return { masked: out, vault: [...vault.values()] }
}
