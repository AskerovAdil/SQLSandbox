import { buildSchema, type ColumnRow, type IndexRow, type KeyRow } from './buildSchema'

const columns: ColumnRow[] = [
  { table_schema: 'public', table_name: 'departments', table_type: 'BASE TABLE', column_name: 'id', udt_name: 'int4', is_nullable: 'NO', ordinal_position: 1 },
  { table_schema: 'public', table_name: 'departments', table_type: 'BASE TABLE', column_name: 'title', udt_name: 'text', is_nullable: 'YES', ordinal_position: 2 },
  { table_schema: 'public', table_name: 'employees', table_type: 'BASE TABLE', column_name: 'id', udt_name: 'int4', is_nullable: 'NO', ordinal_position: 1 },
  { table_schema: 'public', table_name: 'employees', table_type: 'BASE TABLE', column_name: 'dept_id', udt_name: 'int4', is_nullable: 'YES', ordinal_position: 2 },
  { table_schema: 'public', table_name: 'v_names', table_type: 'VIEW', column_name: 'title', udt_name: 'text', is_nullable: 'YES', ordinal_position: 1 },
  { table_schema: 'pg_temp_3', table_name: 'scratch', table_type: 'LOCAL TEMPORARY', column_name: 'x', udt_name: 'int8', is_nullable: 'YES', ordinal_position: 1 },
  { table_schema: 'public', table_name: 'empty', table_type: 'BASE TABLE', column_name: null, udt_name: null, is_nullable: null, ordinal_position: null },
]

const keys: KeyRow[] = [
  { table_schema: 'public', table_name: 'departments', column_name: 'id', constraint_type: 'PRIMARY KEY', ref_table: null, ref_column: null },
  { table_schema: 'public', table_name: 'employees', column_name: 'id', constraint_type: 'PRIMARY KEY', ref_table: null, ref_column: null },
  { table_schema: 'public', table_name: 'employees', column_name: 'dept_id', constraint_type: 'FOREIGN KEY', ref_table: 'departments', ref_column: 'id' },
]

const indexes: IndexRow[] = [
  { schemaname: 'public', tablename: 'employees', indexname: 'employees_pkey', indexdef: 'CREATE UNIQUE INDEX employees_pkey ON public.employees USING btree (id)' },
]

describe('buildSchema', () => {
  const relations = buildSchema(columns, keys, indexes)
  const byName = (name: string) => relations.find((relation) => relation.name === name)

  it('groups columns by relation and marks relation kinds', () => {
    expect(byName('departments')?.kind).toBe('table')
    expect(byName('v_names')?.kind).toBe('view')
    expect(byName('scratch')?.kind).toBe('temp-table')
    expect(byName('departments')?.columns.map((column) => column.name)).toEqual(['id', 'title'])
  })

  it('marks primary and foreign keys and nullability', () => {
    const employees = byName('employees')
    expect(employees?.columns.find((column) => column.name === 'id')).toMatchObject({ primaryKey: true, nullable: false })
    expect(employees?.columns.find((column) => column.name === 'dept_id')).toMatchObject({
      primaryKey: false,
      nullable: true,
      references: 'departments.id',
    })
  })

  it('attaches indexes to their relation', () => {
    expect(byName('employees')?.indexes.map((index) => index.name)).toEqual(['employees_pkey'])
    expect(byName('departments')?.indexes).toEqual([])
  })

  it('keeps tables without columns', () => {
    expect(byName('empty')?.columns).toEqual([])
  })
})
