/**
 * Логика автодополнения без зависимости от Monaco: что предложить в данной позиции.
 * Монако-обвязка лежит в monacoSetup.ts.
 */

export type SuggestionKind = 'keyword' | 'table' | 'column'

export interface Suggestion {
  label: string
  kind: SuggestionKind
  detail?: string
}

export interface CompletionColumn {
  name: string
  type: string
}

export interface CompletionTable {
  name: string
  kindLabel: string
  columns: CompletionColumn[]
}

export const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'DISTINCT',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON', 'USING',
  'AS', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE', 'IS', 'NULL', 'TRUE', 'FALSE',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', 'WITH', 'RECURSIVE',
  'OVER', 'PARTITION BY', 'ROWS', 'RANGE', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT ROW',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'RETURNING', 'ON CONFLICT', 'DO NOTHING', 'DO UPDATE',
  'CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX', 'CREATE SCHEMA', 'ALTER TABLE', 'DROP TABLE', 'DROP VIEW',
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT', 'NOT NULL', 'CONSTRAINT',
  'EXPLAIN', 'ANALYZE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'COALESCE', 'NULLIF', 'CAST', 'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST', 'FETCH', 'FIRST', 'ONLY',
]

/** Слова, которые не бывают алиасом таблицы: в "FROM orders WHERE" слово WHERE алиасом не является. */
const NOT_ALIAS = new Set([
  ...SQL_KEYWORDS.flatMap((keyword) => keyword.split(' ')).map((word) => word.toLowerCase()),
  'left', 'right', 'inner', 'full', 'cross', 'natural', 'lateral', 'on', 'using',
])

/** Разбирает FROM и JOIN: алиас → имя таблицы (нижний регистр, без схемы и кавычек). */
export function parseAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>()
  const pattern = /\b(?:FROM|JOIN)\s+("?[\w$]+"?(?:\s*\.\s*"?[\w$]+"?)?)(?:\s+(?:AS\s+)?("?[A-Za-z_][\w$]*"?))?/gi
  for (const match of sql.matchAll(pattern)) {
    const table = unquote(match[1] ?? '').split('.').pop()?.toLowerCase()
    if (!table) continue
    aliases.set(table, table)
    const alias = match[2] === undefined ? undefined : unquote(match[2]).toLowerCase()
    if (alias && !NOT_ALIAS.has(alias)) {
      aliases.set(alias, table)
    }
  }
  return aliases
}

/**
 * Предложения для позиции курсора.
 * before — текст документа до курсора, fullText — весь документ.
 */
export function buildSuggestions(before: string, fullText: string, tables: CompletionTable[]): Suggestion[] {
  const qualified = /([A-Za-z_][\w$]*)\.[\w$]*$/.exec(before)
  if (qualified?.[1]) {
    const qualifier = qualified[1].toLowerCase()
    const tableName = parseAliases(fullText).get(qualifier) ?? qualifier
    const table = tables.find((item) => item.name.toLowerCase() === tableName)
    return (table?.columns ?? []).map((column) => ({ label: column.name, kind: 'column', detail: column.type }))
  }

  const suggestions: Suggestion[] = SQL_KEYWORDS.map((label) => ({ label, kind: 'keyword' }))
  for (const table of tables) {
    suggestions.push({ label: table.name, kind: 'table', detail: table.kindLabel })
  }
  const seenColumns = new Set<string>()
  for (const table of tables) {
    for (const column of table.columns) {
      if (seenColumns.has(column.name)) continue
      seenColumns.add(column.name)
      suggestions.push({ label: column.name, kind: 'column', detail: `${column.type} · ${table.name}` })
    }
  }
  return suggestions
}

function unquote(identifier: string): string {
  return identifier.replace(/"/g, '')
}
