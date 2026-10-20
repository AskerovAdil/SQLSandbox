import type { PGlite } from '@electric-sql/pglite'
/** Минимальный интерфейс: подходит и PGliteWorker в браузере, и PGlite в тестах. */
export type QueryDb = Pick<PGlite, 'query'>

import type { SchemaColumn, SchemaRelation } from '../schema/buildSchema'
import { quoteIdentifier } from '../session/snapshot'

/** Разделитель между данными вкладки и кодом редактора в экспортированном файле. */
export const EDITOR_MARKER = '-- @@editor'

/** Тип колонки в DDL. udt_name массивов начинается с подчёркивания: _int4 -> int4[]. */
export function columnTypeSql(type: string): string {
  return type.startsWith('_') ? `${type.slice(1)}[]` : type
}

/** CREATE TABLE для одной таблицы: колонки, NOT NULL и первичный ключ. Внешние ключи — отдельно. */
export function createTableSql(relation: SchemaRelation): string {
  const lines = relation.columns.map((column) => {
    const nullable = column.nullable ? '' : ' NOT NULL'
    return `  ${quoteIdentifier(column.name)} ${columnTypeSql(column.type)}${nullable}`
  })
  const primary = relation.columns.filter((column) => column.primaryKey).map((column) => quoteIdentifier(column.name))
  if (primary.length > 0) lines.push(`  PRIMARY KEY (${primary.join(', ')})`)
  return `CREATE TABLE ${quoteIdentifier(relation.name)} (\n${lines.join(',\n')}\n);`
}

/** ALTER TABLE ... ADD FOREIGN KEY для связей, ссылающихся на таблицы из той же схемы. */
export function foreignKeySql(relations: SchemaRelation[]): string[] {
  const names = new Set(relations.map((relation) => relation.name))
  const statements: string[] = []
  for (const relation of relations) {
    for (const column of relation.columns) {
      const target = parseReference(column)
      if (!target || !names.has(target.table)) continue
      statements.push(
        `ALTER TABLE ${quoteIdentifier(relation.name)} ADD FOREIGN KEY (${quoteIdentifier(column.name)}) REFERENCES ${quoteIdentifier(target.table)} (${quoteIdentifier(target.column)});`,
      )
    }
  }
  return statements
}

function parseReference(column: SchemaColumn): { table: string; column: string } | null {
  if (!column.references) return null
  const separator = column.references.lastIndexOf('.')
  if (separator <= 0) return null
  return { table: column.references.slice(0, separator), column: column.references.slice(separator + 1) }
}

/** INSERT-ы для таблицы: каждое значение превращается в литерал на стороне PostgreSQL. */
async function insertSql(db: QueryDb, relation: SchemaRelation): Promise<string[]> {
  if (relation.columns.length === 0) return []
  const table = quoteIdentifier(relation.name)
  const values = relation.columns
    .map((column) => `quote_nullable(${quoteIdentifier(column.name)}::text)`)
    .join(` || ', ' || `)
  const response = await db.query<{ stmt: string }>(
    `SELECT concat('INSERT INTO ${table} VALUES (', ${values}, ');') AS stmt FROM ${table}`,
  )
  return response.rows.map((row) => row.stmt)
}

/**
 * Полный SQL-дамп базы: таблицы, данные, внешние ключи, представления.
 * Не экспортируются: значения по умолчанию, последовательности, индексы кроме первичного ключа, временные объекты.
 */
export async function dumpDatabaseSql(db: QueryDb, relations: SchemaRelation[]): Promise<string> {
  const tables = relations.filter((relation) => relation.kind === 'table')
  const parts: string[] = []

  for (const table of tables) parts.push(createTableSql(table))
  for (const table of tables) parts.push(...(await insertSql(db, table)))
  parts.push(...foreignKeySql(tables))

  const views = await db.query<{ viewname: string; definition: string }>(
    `SELECT viewname, definition FROM pg_views WHERE schemaname = 'public' ORDER BY viewname`,
  )
  for (const view of views.rows) {
    parts.push(`CREATE VIEW ${quoteIdentifier(view.viewname)} AS\n${view.definition.trim().replace(/;$/, '')};`)
  }
  return parts.join('\n\n')
}

/** Файл вкладки: данные (выполняются при импорте), маркер, код редактора. */
export function buildTabFile(dataSql: string, editorSql: string): string {
  const header = `-- SQL Sandbox: экспорт вкладки от ${new Date().toISOString()}\n-- Значения по умолчанию и последовательности не экспортируются.\n`
  return `${header}\n${dataSql}\n\n${EDITOR_MARKER}\n${editorSql}`
}
