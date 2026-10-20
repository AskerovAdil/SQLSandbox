import { buildSnapshotSql, diffRows, quoteIdentifier, type TableSnapshot, toSnapshotRow } from './snapshot'
import type { SchemaRelation } from '../schema/buildSchema'

const snap = (keys: [string, Record<string, string | null>][], keyed = true): TableSnapshot => ({
  id: 'public.t',
  keyedByPrimaryKey: keyed,
  truncated: false,
  rows: keys.map(([key, cells]) => ({ key, cells })),
})

describe('diffRows', () => {
  it('marks added, changed, same and removed rows', () => {
    const before = snap([
      ['1', { id: '1', name: 'Анна' }],
      ['2', { id: '2', name: 'Борис' }],
      ['3', { id: '3', name: 'Вера' }],
    ])
    const after = snap([
      ['1', { id: '1', name: 'Анна' }],
      ['2', { id: '2', name: 'Борис Б.' }],
      ['4', { id: '4', name: 'Гена' }],
    ])
    const diff = diffRows(before, after)
    expect(diff.find((row) => row.key === '1')?.status).toBe('same')
    expect(diff.find((row) => row.key === '2')).toMatchObject({ status: 'changed', changedColumns: ['name'] })
    expect(diff.find((row) => row.key === '4')?.status).toBe('added')
    expect(diff.find((row) => row.key === '3')).toMatchObject({ status: 'removed', cells: { id: '3', name: 'Вера' } })
  })

  it('treats NULL and empty string as different values', () => {
    const before = snap([['1', { v: null }]])
    const after = snap([['1', { v: '' }]])
    expect(diffRows(before, after)[0]).toMatchObject({ status: 'changed', changedColumns: ['v'] })
  })

  it('reports everything as added when there is no previous snapshot', () => {
    const diff = diffRows(undefined, snap([['1', { id: '1' }]]))
    expect(diff).toEqual([{ key: '1', status: 'added', cells: { id: '1' }, changedColumns: [] }])
  })
})

describe('buildSnapshotSql', () => {
  const base: Omit<SchemaRelation, 'kind' | 'columns'> = { schema: 'public', name: 'emp', indexes: [] }

  it('keys a table by its primary key', () => {
    const sql = buildSnapshotSql({
      ...base,
      kind: 'table',
      columns: [
        { name: 'dept', type: 'int4', nullable: true, primaryKey: true, references: null },
        { name: 'id', type: 'int4', nullable: false, primaryKey: true, references: null },
      ],
    })
    expect(sql).toContain(`concat_ws('|', "dept"::text, "id"::text) AS "__key"`)
    expect(sql).toContain('FROM "public"."emp" LIMIT 5000')
  })

  it('falls back to ctid for tables without a primary key', () => {
    const sql = buildSnapshotSql({ ...base, kind: 'table', columns: [] })
    expect(sql).toContain('ctid::text AS "__key"')
  })

  it('uses row numbers for views', () => {
    const sql = buildSnapshotSql({ ...base, kind: 'view', columns: [] })
    expect(sql).toContain('row_number() OVER ()')
  })

  it('escapes identifiers', () => {
    expect(quoteIdentifier('we"ird')).toBe('"we""ird"')
  })
})

describe('toSnapshotRow', () => {
  it('keeps NULL as null and converts other values to text', () => {
    const row = toSnapshotRow({ __key: 7, id: 7, score: null, name: '', ok: true }, ['id', 'score', 'name', 'ok'])
    expect(row).toEqual({ key: '7', cells: { id: '7', score: null, name: '', ok: 'true' } })
  })
})
