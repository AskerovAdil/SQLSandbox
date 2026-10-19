export interface SqlStatement {
  /** Текст statement без завершающей точки с запятой, обрезанный по краям. */
  text: string
  /** Смещение первого значимого символа в исходной строке. */
  start: number
  /** Смещение сразу после последнего значимого символа. */
  end: number
}

const DOLLAR_TAG = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/y
const IDENT_CHAR = /[A-Za-z0-9_$]/

/**
 * Делит SQL-скрипт на statements по `;`.
 * Учитывает строки '...', идентификаторы "...", E'...' с backslash-экранированием,
 * комментарии -- и /* *\/ (с вложенностью, как в PostgreSQL) и $tag$...$tag$ блоки.
 * Сегменты без значимого кода (только пробелы и комментарии) пропускаются.
 */
export function splitStatements(source: string): SqlStatement[] {
  const statements: SqlStatement[] = []
  const n = source.length
  let segmentStart = 0
  let hasCode = false
  let i = 0

  const flush = (segmentEnd: number): void => {
    if (hasCode) {
      const raw = source.slice(segmentStart, segmentEnd)
      const start = segmentStart + (raw.length - raw.trimStart().length)
      const text = raw.trim()
      statements.push({ text, start, end: start + text.length })
    }
    hasCode = false
  }

  while (i < n) {
    const ch = source.charAt(i)
    const next = source.charAt(i + 1)

    if (ch === '-' && next === '-') {
      const eol = source.indexOf('\n', i)
      i = eol === -1 ? n : eol + 1
      continue
    }
    if (ch === '/' && next === '*') {
      i = skipBlockComment(source, i)
      continue
    }
    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === ';') {
      flush(i)
      segmentStart = i + 1
      i++
      continue
    }

    hasCode = true

    if (ch === "'") {
      const prev = source.charAt(i - 1)
      const beforePrev = source.charAt(i - 2)
      const isEString = (prev === 'E' || prev === 'e') && !IDENT_CHAR.test(beforePrev)
      i = skipQuoted(source, i, "'", isEString)
      continue
    }
    if (ch === '"') {
      i = skipQuoted(source, i, '"', false)
      continue
    }
    if (ch === '$') {
      const tag = matchDollarTag(source, i)
      if (tag !== null) {
        i = skipDollarQuoted(source, i, tag)
        continue
      }
      i++
      continue
    }
    i++
  }

  flush(n)
  return statements
}

/** Statement, в котором находится смещение offset (или ближайший предыдущий). */
export function statementAt(statements: readonly SqlStatement[], offset: number): SqlStatement | undefined {
  let found: SqlStatement | undefined
  for (const statement of statements) {
    if (statement.start > offset) break
    found = statement
  }
  return found ?? statements[0]
}

function skipBlockComment(source: string, from: number): number {
  let depth = 0
  let i = from
  while (i < source.length) {
    if (source.startsWith('/*', i)) {
      depth++
      i += 2
    } else if (source.startsWith('*/', i)) {
      depth--
      i += 2
      if (depth === 0) return i
    } else {
      i++
    }
  }
  return source.length
}

function skipQuoted(source: string, from: number, quote: string, backslashEscapes: boolean): number {
  let i = from + 1
  while (i < source.length) {
    const ch = source.charAt(i)
    if (backslashEscapes && ch === '\\') {
      i += 2
      continue
    }
    if (ch === quote) {
      if (source.charAt(i + 1) === quote) {
        i += 2
        continue
      }
      return i + 1
    }
    i++
  }
  return source.length
}

function matchDollarTag(source: string, i: number): string | null {
  if (i > 0 && IDENT_CHAR.test(source.charAt(i - 1))) return null
  DOLLAR_TAG.lastIndex = i
  const match = DOLLAR_TAG.exec(source)
  return match ? match[0] : null
}

function skipDollarQuoted(source: string, from: number, tag: string): number {
  const closeIndex = source.indexOf(tag, from + tag.length)
  return closeIndex === -1 ? source.length : closeIndex + tag.length
}
