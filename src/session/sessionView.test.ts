import type { SchemaRelation } from '../schema/buildSchema'
import { buildSessionTables, freshRelationNames } from './sessionView'
import type { TableSnapshot } from './snapshot'

const column = (name: string, extra: Partial<SchemaRelation['columns'][number]> = {}) => ({
  name,
  type: 'text',
  nullable: true,
  primaryKey: false,
  references: null,
  ...extra,
})

const relation = (name: string, columns: SchemaRelation['columns'], kind: SchemaRelation['kind'] = 'table'): SchemaRelation => ({
  schema: 'public',
  name,
  kind,
  columns,
  indexes: [],
})

const snapshot = (name: string, rows: [string, Record<string, string | null>][]): [string, TableSnapshot] => [
  `public.${name}`,
  { id: `public.${name}`, keyedByPrimaryKey: true, truncated: false, rows: rows.map(([key, cells]) => ({ key, cells })) },
]

describe('buildSessionTables', () => {
  it('shows plain data without highlights on the first load', () => {
    const demo = relation('demo', [column('id', { primaryKey: true })])
    const tables = buildSessionTables({
      before: null,
      after: { relations: [demo], snapshots: new Map([snapshot('demo', [['1', { id: '1' }]])]) },
    })
    expect(tables).toHaveLength(1)
    expect(tables[0]).toMatchObject({ name: 'demo', status: 'normal', rowCount: 1 })
    expect(tables[0]?.rows.map((row) => row.status)).toEqual(['same'])
  })

  it('marks a table created by the last run as new and highlights its rows', () => {
    const demo = relation('demo', [column('id', { primaryKey: true })])
    const fresh = relation('fresh', [column('id', { primaryKey: true })])
    const tables = buildSessionTables({
      before: { relations: [demo], snapshots: new Map([snapshot('demo', [['1', { id: '1' }]])]) },
      after: {
        relations: [demo, fresh],
        snapshots: new Map([snapshot('demo', [['1', { id: '1' }]]), snapshot('fresh', [['5', { id: '5' }]])]),
      },
    })
    expect(tables.find((item) => item.name === 'fresh')).toMatchObject({ status: 'new' })
    expect(tables.find((item) => item.name === 'fresh')?.rows[0]?.status).toBe('added')
  })

  it('keeps dropped tables with their removed rows until the next run', () => {
    const old = relation('old', [column('id', { primaryKey: true })])
    const tables = buildSessionTables({
      before: { relations: [old], snapshots: new Map([snapshot('old', [['1', { id: '1' }]])]) },
      after: { relations: [], snapshots: new Map() },
    })
    expect(tables).toHaveLength(1)
    expect(tables[0]).toMatchObject({ name: 'old', status: 'dropped', rowCount: 0 })
    expect(tables[0]?.rows[0]?.status).toBe('removed')
  })
})

describe('freshRelationNames', () => {
  it('returns new tables and tables whose foreign keys changed', () => {
    const before = [
      relation('a', [column('id', { primaryKey: true })]),
      relation('b', [column('a_id', { references: 'a.id' })]),
    ]
    const after = [
      relation('a', [column('id', { primaryKey: true })]),
      relation('b', [column('a_id', { references: null })]),
      relation('c', [column('id', { primaryKey: true })]),
    ]
    expect([...freshRelationNames(before, after)].sort()).toEqual(['b', 'c'])
  })

  it('returns nothing when the structure is unchanged', () => {
    const same = [relation('a', [column('id', { primaryKey: true })])]
    expect(freshRelationNames(same, same).size).toBe(0)
  })
})
