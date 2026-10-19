/** Строки метаданных из information_schema и pg_catalog (три запроса на всю базу, а не на таблицу). */
export interface ColumnRow {
  table_schema: string
  table_name: string
  table_type: string
  column_name: string | null
  udt_name: string | null
  is_nullable: string | null
  ordinal_position: number | null
}

export interface KeyRow {
  table_schema: string
  table_name: string
  column_name: string
  constraint_type: 'PRIMARY KEY' | 'FOREIGN KEY'
  ref_table: string | null
  ref_column: string | null
}

export interface IndexRow {
  schemaname: string
  tablename: string
  indexname: string
  indexdef: string
}

export type RelationKind = 'table' | 'view' | 'temp-table' | 'temp-view'

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  /** Например, "departments.id". Null, если колонка не внешний ключ. */
  references: string | null
}

export interface SchemaRelation {
  schema: string
  name: string
  kind: RelationKind
  columns: SchemaColumn[]
  indexes: { name: string; definition: string }[]
}

/** Объединяет строки каталога в дерево объектов. Порядок — как в запросах (уже отсортированы). */
export function buildSchema(columns: ColumnRow[], keys: KeyRow[], indexes: IndexRow[]): SchemaRelation[] {
  const relations = new Map<string, SchemaRelation>()

  for (const row of columns) {
    const id = `${row.table_schema}.${row.table_name}`
    let relation = relations.get(id)
    if (!relation) {
      relation = {
        schema: row.table_schema,
        name: row.table_name,
        kind: relationKind(row.table_schema, row.table_type),
        columns: [],
        indexes: [],
      }
      relations.set(id, relation)
    }
    if (row.column_name !== null) {
      relation.columns.push({
        name: row.column_name,
        type: row.udt_name ?? 'unknown',
        nullable: row.is_nullable === 'YES',
        primaryKey: false,
        references: null,
      })
    }
  }

  for (const key of keys) {
    const column = relations
      .get(`${key.table_schema}.${key.table_name}`)
      ?.columns.find((item) => item.name === key.column_name)
    if (!column) continue
    if (key.constraint_type === 'PRIMARY KEY') {
      column.primaryKey = true
    } else if (key.ref_table !== null && key.ref_column !== null) {
      column.references = `${key.ref_table}.${key.ref_column}`
    }
  }

  for (const index of indexes) {
    relations.get(`${index.schemaname}.${index.tablename}`)?.indexes.push({
      name: index.indexname,
      definition: index.indexdef,
    })
  }

  return [...relations.values()]
}

function relationKind(schema: string, tableType: string): RelationKind {
  const temporary = schema.startsWith('pg_temp')
  const isView = tableType === 'VIEW'
  if (temporary) return isView ? 'temp-view' : 'temp-table'
  return isView ? 'view' : 'table'
}

/** Подпись вида объекта на русском: используется в дереве схемы и в автодополнении. */
export function relationKindLabel(kind: RelationKind): string {
  switch (kind) {
    case 'table':
      return 'таблица'
    case 'view':
      return 'представление'
    case 'temp-table':
      return 'временная таблица'
    case 'temp-view':
      return 'временное представление'
  }
}
