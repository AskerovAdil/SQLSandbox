/**
 * PGlite пересылает в UI только текст ошибки PostgreSQL: поле position из воркера не приходит.
 * Поэтому место ошибки ищем по имени токена, который PostgreSQL называет в сообщении:
 *   syntax error at or near "SELEC"   → SELEC как целое слово (не часть SELECT)
 *   relation "demo2" does not exist   → demo2
 * Возвращает смещение внутри текста statement; 0, если токен не найден.
 */
export function locateErrorInStatement(message: string, statementText: string): number {
  const token = /at or near "([^"]+)"/.exec(message)?.[1] ?? /"([^"]+)"/.exec(message)?.[1]
  if (token === undefined) return 0
  const match = wholeTokenPattern(token).exec(statementText)
  return match ? match.index : 0
}

function wholeTokenPattern(token: string): RegExp {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const before = /^\w/.test(token) ? '(?<!\\w)' : ''
  const after = /\w$/.test(token) ? '(?!\\w)' : ''
  return new RegExp(`${before}${escaped}${after}`)
}
