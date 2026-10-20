import type { QueryDb } from '../transfer/sqlDump'
import { buildSchema, type ColumnRow, type IndexRow, type KeyRow, type SchemaRelation } from './buildSchema'

const COLUMNS_SQL = `
SELECT t.table_schema, t.table_name, t.table_type,
       c.column_name, c.udt_name, c.is_nullable, c.ordinal_position
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
  ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND t.table_schema NOT LIKE 'pg_toast%'
ORDER BY t.table_schema, t.table_name, c.ordinal_position`

const KEYS_SQL = `
SELECT kcu.table_schema, kcu.table_name, kcu.column_name, tc.constraint_type,
       ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema AND kcu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY kcu.table_schema, kcu.table_name, kcu.ordinal_position`

const INDEXES_SQL = `
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND schemaname NOT LIKE 'pg_toast%'
ORDER BY schemaname, tablename, indexname`

/** Метаданные пользовательских объектов базы: три запроса, а не запрос на каждую таблицу. */
export async function loadSchema(db: QueryDb): Promise<SchemaRelation[]> {
  const [columns, keys, indexes] = await Promise.all([
    db.query<ColumnRow>(COLUMNS_SQL),
    db.query<KeyRow>(KEYS_SQL),
    db.query<IndexRow>(INDEXES_SQL),
  ])
  return buildSchema(columns.rows, keys.rows, indexes.rows)
}
