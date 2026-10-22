/**
 * Файл общей песочницы: код редактора и дамп базы. Лежит в репозитории по пути
 * sandboxes/<guid>.json на ветке sandboxes. Формат меняется только с номером версии.
 */
export const SANDBOX_FORMAT = 'sql-sandbox-shared'
export const SANDBOX_VERSION = 1

/** Лимит содержимого, который отдаёт Contents API без обходных путей (≈1 МБ). */
export const MAX_SANDBOX_BYTES = 900_000

export interface SharedSandbox {
  sql: string
  /** Дамп базы PGlite в base64. Пустая строка — база пустая. */
  data: string
  updatedAt: string
}

export function encodeSandbox(sandbox: SharedSandbox): string {
  const text = JSON.stringify({ format: SANDBOX_FORMAT, version: SANDBOX_VERSION, ...sandbox }, null, 2)
  if (new TextEncoder().encode(text).length > MAX_SANDBOX_BYTES) {
    throw new Error('Песочница больше 900 КБ: слишком большая база для общего хранения. Уменьшите данные или удалите лишнее.')
  }
  return text
}

/** Разбирает файл песочницы. Некорректный файл вызывает ошибку с понятным текстом. */
export function decodeSandbox(text: string): SharedSandbox {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Файл песочницы повреждён: это не JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Файл песочницы повреждён')
  const file = parsed as Record<string, unknown>
  if (file['format'] !== SANDBOX_FORMAT || file['version'] !== SANDBOX_VERSION) {
    throw new Error('Неизвестный формат песочницы или версия приложения устарела')
  }
  if (typeof file['sql'] !== 'string' || typeof file['data'] !== 'string' || typeof file['updatedAt'] !== 'string') {
    throw new Error('Файл песочницы повреждён: не хватает полей')
  }
  return { sql: file['sql'], data: file['data'], updatedAt: file['updatedAt'] }
}

/** UTF-8 строка в base64 (для Contents API, которое принимает base64). */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new TextDecoder().decode(bytes)
}
