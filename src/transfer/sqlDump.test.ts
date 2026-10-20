import type { SchemaRelation } from '../schema/buildSchema'
import { buildTabFile, columnTypeSql, createTableSql, EDITOR_MARKER, foreignKeySql } from './sqlDump'

const column = (name: string, extra: Partial<SchemaRelation['columns'][number]> = {}) => ({
  name,
  type: 'int4',
  nullable: true,
  primaryKey: false,
  references: null,
  ...extra,
})

const employees: SchemaRelation = {
  schema: 'public',
  name: 'employees',
  kind: 'table',
  indexes: [],
  columns: [
    column('id', { primaryKey: true, nullable: false }),
    column('dept_id', { references: 'departments.id' }),
    column('tags', { type: '_text' }),
    column('name', { type: 'text' }),
  ],
}

const departments: SchemaRelation = {
  schema: 'public',
  name: 'departments',
  kind: 'table',
  indexes: [],
  columns: [column('id', { primaryKey: true, nullable: false })],
}

describe('createTableSql', () => {
  it('writes columns, NOT NULL and the primary key', () => {
    const sql = createTableSql(employees)
    expect(sql).toContain('"id" int4 NOT NULL')
    expect(sql).toContain('"name" text')
    expect(sql).toContain('PRIMARY KEY ("id")')
    expect(sql.startsWith('CREATE TABLE "employees" (')).toBe(true)
  })

  it('does not write foreign keys inline', () => {
    expect(createTableSql(employees)).not.toContain('REFERENCES')
  })
})

describe('foreignKeySql', () => {
  it('adds foreign keys only for tables present in the export', () => {
    expect(foreignKeySql([employees, departments])).toEqual([
      'ALTER TABLE "employees" ADD FOREIGN KEY ("dept_id") REFERENCES "departments" ("id");',
    ])
    expect(foreignKeySql([employees])).toEqual([])
  })
})

describe('columnTypeSql', () => {
  it('turns array udt names into SQL array types', () => {
    expect(columnTypeSql('_int4')).toBe('int4[]')
    expect(columnTypeSql('numeric')).toBe('numeric')
  })
})

describe('buildTabFile', () => {
  it('puts the editor code after the marker', () => {
    const file = buildTabFile('CREATE TABLE a (x int4);', 'SELECT 1;')
    const [data, editor] = file.split(`\n${EDITOR_MARKER}\n`)
    expect(data).toContain('CREATE TABLE a')
    expect(editor).toBe('SELECT 1;')
  })
})
