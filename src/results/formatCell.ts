/** Текст ячейки для таблицы результата. NULL отличается от пустой строки на уровне отображения. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'bigint') return value.toString()
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? item.toString() : item))
}
