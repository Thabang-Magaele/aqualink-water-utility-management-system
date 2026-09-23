/**
 * Static checks for firestore.rules that run without the emulator:
 *   1. Brackets balance and every statement ends with a semicolon.
 *   2. Every function called is defined in the same block or an enclosing one.
 *   3. The value lists in the rules (areas, statuses, types…) match src/types/models.ts.
 *
 *   npm run check:rules
 *
 * This is NOT a substitute for `npm run test:rules`, which runs the real rules engine.
 */
import { readFileSync } from 'node:fs'
import {
  AREAS,
  ASSET_STATUSES,
  ASSET_TYPES,
  ACCOUNT_STATUSES,
  METER_STATUSES,
  OUTAGE_STATUSES,
  PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  WATER_QUALITY_PARAMETERS,
  WATER_QUALITY_STATUSES,
} from '../src/types/models'
import { ROLES } from '../src/types/user'

const source = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const errors: string[] = []

// Strip comments and string contents (keep quotes) so brackets inside them don't count.
function strip(text: string): string {
  return text
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/'[^'\n]*'/g, (m) => `'${' '.repeat(m.length - 2)}'`)
}
const code = strip(source)
const lineOf = (index: number) => code.slice(0, index).split('\n').length

// 1. Brackets
const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
const stack: { ch: string; at: number }[] = []
for (let i = 0; i < code.length; i++) {
  const ch = code[i]
  if ('([{'.includes(ch)) stack.push({ ch, at: i })
  else if (ch in pairs) {
    const open = stack.pop()
    if (!open || open.ch !== pairs[ch]) errors.push(`Unbalanced '${ch}' at line ${lineOf(i)}`)
  }
}
for (const open of stack) errors.push(`Unclosed '${open.ch}' from line ${lineOf(open.at)}`)

// Statements: every `allow …` and `return …` must end with ';' before the next statement
for (const m of code.matchAll(
  /\b(allow|return)\b[\s\S]*?(?=;|\ballow\b|\bfunction\b|\bmatch\b|})/g,
)) {
  const end = (m.index ?? 0) + m[0].length
  if (code[end] !== ';')
    errors.push(`Missing ';' after '${m[1]}' starting at line ${lineOf(m.index ?? 0)}`)
}

// 2. Function definitions and calls, with block scoping
interface Block {
  start: number
  end: number
  parent: Block | null
  functions: Set<string>
}
const root: Block = { start: 0, end: code.length, parent: null, functions: new Set() }
const blocks: Block[] = [root]
{
  const opens: { at: number; block: Block | null }[] = []
  let current = root
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') {
      // Only `match …{` and `service …{` open a scope for function definitions
      const before = code.slice(Math.max(0, code.lastIndexOf('\n', i - 1)), i)
      if (/\b(match|service)\b/.test(before)) {
        const block: Block = { start: i, end: code.length, parent: current, functions: new Set() }
        blocks.push(block)
        opens.push({ at: i, block: current })
        current = block
      } else opens.push({ at: i, block: null })
    } else if (code[i] === '}') {
      const open = opens.pop()
      if (open?.block) {
        current.end = i
        current = open.block
      }
    }
  }
}
const innermost = (index: number) =>
  blocks.filter((b) => b.start <= index && index <= b.end).sort((a, b) => b.start - a.start)[0] ??
  root

for (const m of code.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) {
  const block = innermost(m.index ?? 0)
  if (block.functions.has(m[1]))
    errors.push(`Function '${m[1]}' defined twice in one block (line ${lineOf(m.index ?? 0)})`)
  block.functions.add(m[1])
}
const BUILTINS = new Set([
  'get',
  'getAfter',
  'exists',
  'existsAfter',
  'path',
  'function',
  'match',
  'if',
  'return',
])
for (const m of code.matchAll(/(?<![.\w])([A-Za-z_]\w*)\s*\(/g)) {
  const name = m[1]
  if (BUILTINS.has(name)) continue
  if (/\bfunction\s+$/.test(code.slice(Math.max(0, (m.index ?? 0) - 12), m.index))) continue
  let block: Block | null = innermost(m.index ?? 0)
  let found = false
  while (block) {
    if (block.functions.has(name)) found = true
    block = block.parent
  }
  if (!found)
    errors.push(
      `Call to undefined (or out-of-scope) function '${name}' at line ${lineOf(m.index ?? 0)}`,
    )
}

// 3. Value lists must match the TypeScript model
function listIn(fnName: string): string[] | null {
  const m = new RegExp(`function\\s+${fnName}\\s*\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\]`).exec(
    source,
  )
  return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : null
}
function literalListAfter(marker: string): string[] | null {
  const i = source.indexOf(marker)
  if (i < 0) return null
  const m = /\[([^\]]*)\]/.exec(source.slice(i))
  return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : null
}
const same = (a: readonly string[], b: readonly string[] | null) =>
  !!b && a.length === b.length && a.every((x) => b.includes(x))
const lists: [string, readonly string[], string[] | null][] = [
  ['areas()', AREAS, listIn('areas')],
  ['priorities()', PRIORITIES, listIn('priorities')],
  ['ticketStatuses()', TICKET_STATUSES, listIn('ticketStatuses')],
  ['ticketTypes()', TICKET_TYPES, listIn('ticketTypes')],
  ['account status', ACCOUNT_STATUSES, literalListAfter("d.status in ['ACTIVE', 'SUSPENDED'")],
  ['meter status', METER_STATUSES, literalListAfter("d.status in ['ACTIVE', 'FAULTY'")],
  ['asset type', ASSET_TYPES, literalListAfter("d.type in ['RESERVOIR'")],
  ['asset status', ASSET_STATUSES, literalListAfter("d.status in ['ACTIVE', 'MAINTENANCE'")],
  ['water parameter', Object.keys(WATER_QUALITY_PARAMETERS), literalListAfter('d.parameter in')],
  ['water status', WATER_QUALITY_STATUSES, literalListAfter("d.status in ['NORMAL'")],
  ['outage status', OUTAGE_STATUSES, literalListAfter("d.status in ['SCHEDULED'")],
  ['staff roles', ROLES.filter((r) => r !== 'customer'), literalListAfter('function isStaff()')],
]
for (const [name, expected, actual] of lists) {
  if (!same(expected, actual))
    errors.push(
      `Rules list '${name}' ${JSON.stringify(actual)} ≠ models.ts ${JSON.stringify(expected)}`,
    )
}

const functionCount = blocks.reduce((n, b) => n + b.functions.size, 0)
if (errors.length) {
  console.error(`✖ firestore.rules: ${errors.length} problem(s)\n  - ${errors.join('\n  - ')}`)
  process.exit(1)
}
console.log(
  `✔ firestore.rules: brackets balanced, ${functionCount} functions resolved, ${lists.length} value lists match models.ts`,
)
