/** Файл со всеми вкладками: код и база каждой вкладки (дамп PGlite, base64). Переносится между браузерами. */
export const BUNDLE_FORMAT = 'sql-sandbox-bundle'
export const BUNDLE_VERSION = 1

export interface BundleTab {
  name: string
  sql: string
  /** Дамп данных PGlite (tar, base64). Пустая строка — база пустая. */
  data: string
}

export function buildBundle(tabs: BundleTab[]): string {
  return JSON.stringify({ format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: new Date().toISOString(), tabs })
}

/** Разбирает файл пакета. Возвращает null, если файл не похож на пакет SQL Sandbox. */
export function parseBundle(text: string): BundleTab[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const bundle = parsed as { format?: unknown; version?: unknown; tabs?: unknown }
  if (bundle.format !== BUNDLE_FORMAT || bundle.version !== BUNDLE_VERSION || !Array.isArray(bundle.tabs)) return null

  const tabs: BundleTab[] = []
  for (const item of bundle.tabs as unknown[]) {
    if (typeof item !== 'object' || item === null) return null
    const tab = item as Partial<BundleTab>
    if (typeof tab.name !== 'string' || typeof tab.sql !== 'string' || typeof tab.data !== 'string') return null
    tabs.push({ name: tab.name, sql: tab.sql, data: tab.data })
  }
  return tabs
}
