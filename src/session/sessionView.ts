import type { PGliteWorker } from '@electric-sql/pglite/worker'
import type { RelationKind, SchemaColumn, SchemaRelation } from '../schema/buildSchema'
import {
  buildSnapshotSql,
  diffRows,
  relationId,
  RowDiff,
  SNAPSHOT_ROW_LIMIT,
  type TableSnapshot,
  toSnapshotRow,
} from './snapshot'

export type TableStatus = 'normal' | 'new' | 'dropped'

export interface SessionTable {
  id: string
  name: string
  schema: string
  kind: RelationKind
  columns: SchemaColumn[]
  rows: RowDiff[]
  /** Число живых строк (без удалённых). */
  rowCount: number
  truncated: boolean
  keyedByPrimaryKey: boolean
  status: TableStatus
}

/** Снимки всех таблиц и представлений. Ошибка одной таблицы не отменяет остальные. */
export async function takeSnapshots(
  db: PGliteWorker,
  relations: SchemaRelation[],
): Promise<Map<string, TableSnapshot>> {
  const snapshots = new Map<string, TableSnapshot>()
  const results = await Promise.all(
    relations.map(async (relation) => {
      try {
        const response = await db.query<Record<string, unknown>>(buildSnapshotSql(relation))
        const columns = relation.columns.map((column) => column.name)
        const rows = response.rows.map((row) => toSnapshotRow(row, columns))
        return {
          id: relationId(relation),
          keyedByPrimaryKey: relation.columns.some((column) => column.primaryKey),
          truncated: rows.length >= SNAPSHOT_ROW_LIMIT,
          rows,
        }
      } catch {
        return null
      }
    }),
  )
  for (const snapshot of results) {
    if (snapshot) snapshots.set(snapshot.id, snapshot)
  }
  return snapshots
}

interface BuildParams {
  /** Null при первой загрузке: тогда ничего не подсвечиваем. */
  before: { relations: SchemaRelation[]; snapshots: Map<string, TableSnapshot> } | null
  after: { relations: SchemaRelation[]; snapshots: Map<string, TableSnapshot> }
}

/** Модель панели «Таблицы сессии» после выполнения: подсветка и удалённые таблицы. */
export function buildSessionTables({ before, after }: BuildParams): SessionTable[] {
  const beforeById = new Map((before?.relations ?? []).map((relation) => [relationId(relation), relation]))
  const tables: SessionTable[] = []

  for (const relation of after.relations) {
    const id = relationId(relation)
    const afterSnapshot = after.snapshots.get(id)
    const rows = afterSnapshot
      ? before
        ? diffRows(before.snapshots.get(id), afterSnapshot)
        : afterSnapshot.rows.map((row) => ({ key: row.key, status: 'same' as const, cells: row.cells, changedColumns: [] }))
      : []
    const isNew = before !== null && !beforeById.has(id)
    tables.push({
      id,
      name: relation.name,
      schema: relation.schema,
      kind: relation.kind,
      columns: relation.columns,
      rows,
      rowCount: rows.filter((row) => row.status !== 'removed').length,
      truncated: afterSnapshot?.truncated ?? false,
      keyedByPrimaryKey: afterSnapshot?.keyedByPrimaryKey ?? false,
      status: isNew ? 'new' : 'normal',
    })
  }

  // Удалённые объекты: видны одну вкладку-анимацию, пока Workspace не уберёт их.
  if (before) {
    const afterIds = new Set(after.relations.map(relationId))
    for (const relation of before.relations) {
      const id = relationId(relation)
      if (afterIds.has(id)) continue
      const rows = diffRows(before.snapshots.get(id), { id, keyedByPrimaryKey: false, rows: [], truncated: false })
      tables.push({
        id,
        name: relation.name,
        schema: relation.schema,
        kind: relation.kind,
        columns: relation.columns,
        rows,
        rowCount: 0,
        truncated: false,
        keyedByPrimaryKey: false,
        status: 'dropped',
      })
    }
  }
  return tables
}

/**
 * Имена объектов, которые стоит подсветить после изменения структуры: новые таблицы
 * и таблицы, у которых изменились внешние ключи (диаграмма).
 */
export function freshRelationNames(before: SchemaRelation[], after: SchemaRelation[]): Set<string> {
  const previous = new Map(before.map((relation) => [relationId(relation), relation]))
  const fresh = new Set<string>()
  for (const relation of after) {
    const old = previous.get(relationId(relation))
    if (!old) {
      fresh.add(relation.name)
      continue
    }
    const signature = (item: SchemaRelation) =>
      item.columns.map((column) => `${column.name}:${column.primaryKey ? 'pk' : ''}:${column.references ?? ''}`).join(',')
    if (signature(old) !== signature(relation)) fresh.add(relation.name)
  }
  return fresh
}
