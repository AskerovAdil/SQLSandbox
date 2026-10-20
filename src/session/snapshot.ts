import { formatCell } from '../results/formatCell'
import type { SchemaRelation } from '../schema/buildSchema'

/** Потолок на число строк в снимке одной таблицы: большие таблицы не выгружаем целиком. */
export const SNAPSHOT_ROW_LIMIT = 5000

export type CellValue = string | null

export interface SnapshotRow {
  /** Стабильный ключ строки: значения PK, а без PK — ctid (меняется при UPDATE). */
  key: string
  cells: Record<string, CellValue>
}

export interface TableSnapshot {
  /** schema.name */
  id: string
  /** true, если строки связаны по PK; false — по ctid или по номеру строки (для представлений). */
  keyedByPrimaryKey: boolean
  rows: SnapshotRow[]
  truncated: boolean
}

export type RowStatus = 'same' | 'added' | 'changed' | 'removed'

export interface RowDiff {
  key: string
  status: RowStatus
  cells: Record<string, CellValue>
  /** Имена колонок, у которых значение изменилось (только для changed). */
  changedColumns: string[]
}

export function relationId(relation: Pick<SchemaRelation, 'schema' | 'name'>): string {
  return `${relation.schema}.${relation.name}`
}

/** Экранирование идентификатора для SQL: "name" с удвоенными кавычками внутри. */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** Запрос снимка: ключ строки и все колонки. Для представлений ключ — номер строки. */
export function buildSnapshotSql(relation: SchemaRelation, limit = SNAPSHOT_ROW_LIMIT): string {
  const qualified = `${quoteIdentifier(relation.schema)}.${quoteIdentifier(relation.name)}`
  const primaryKey = relation.columns.filter((column) => column.primaryKey).map((column) => column)
  const isTable = relation.kind === 'table' || relation.kind === 'temp-table'

  let keyExpression: string
  if (primaryKey.length > 0) {
    keyExpression = `concat_ws('|', ${primaryKey.map((column) => `${quoteIdentifier(column.name)}::text`).join(', ')})`
  } else if (isTable) {
    keyExpression = 'ctid::text'
  } else {
    keyExpression = 'row_number() OVER ()::text'
  }
  return `SELECT ${keyExpression} AS "__key", * FROM ${qualified} LIMIT ${String(limit)}`
}

/** Строка результата запроса снимка -> ячейки по именам колонок отношения. */
export function toSnapshotRow(raw: Record<string, unknown>, columns: string[]): SnapshotRow {
  const cells: Record<string, CellValue> = {}
  for (const column of columns) {
    const value = raw[column]
    cells[column] = value === null || value === undefined ? null : formatCell(value)
  }
  return { key: String(raw['__key']), cells }
}

/**
 * Сравнивает снимки до и после выполнения. Порядок: строки after (added/changed/same),
 * затем удалённые строки из before. Удалённые показываются до следующего запуска.
 */
export function diffRows(before: TableSnapshot | undefined, after: TableSnapshot): RowDiff[] {
  const previous = new Map((before?.rows ?? []).map((row) => [row.key, row]))
  const result: RowDiff[] = []
  const seen = new Set<string>()

  for (const row of after.rows) {
    seen.add(row.key)
    const old = previous.get(row.key)
    if (!old) {
      result.push({ key: row.key, status: 'added', cells: row.cells, changedColumns: [] })
      continue
    }
    const changedColumns = Object.keys(row.cells).filter((column) => row.cells[column] !== old.cells[column])
    result.push({
      key: row.key,
      status: changedColumns.length > 0 ? 'changed' : 'same',
      cells: row.cells,
      changedColumns,
    })
  }

  for (const row of before?.rows ?? []) {
    if (!seen.has(row.key)) {
      result.push({ key: row.key, status: 'removed', cells: row.cells, changedColumns: [] })
    }
  }
  return result
}
