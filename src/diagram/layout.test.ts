import { collectEdges, type DiagramTable, layoutPositions, nodeHeight } from './layout'

const tables: DiagramTable[] = [
  {
    name: 'employees',
    columns: [
      { name: 'id', type: 'int4', primaryKey: true, references: null },
      { name: 'dept_id', type: 'int4', primaryKey: false, references: 'departments.id' },
      { name: 'manager_id', type: 'int4', primaryKey: false, references: 'employees.id' },
    ],
  },
  {
    name: 'departments',
    columns: [{ name: 'id', type: 'int4', primaryKey: true, references: null }],
  },
  {
    name: 'orphan',
    columns: [{ name: 'ref', type: 'int4', primaryKey: false, references: 'missing.id' }],
  },
]

describe('collectEdges', () => {
  it('builds column-to-column edges from foreign keys', () => {
    const edges = collectEdges(tables)
    expect(edges.map((edge) => edge.id)).toEqual([
      'employees.dept_id->departments.id',
      'employees.manager_id->employees.id',
    ])
  })

  it('skips references to tables that are not shown', () => {
    expect(collectEdges(tables).some((edge) => edge.fromTable === 'orphan')).toBe(false)
  })
})

describe('layoutPositions', () => {
  it('places referenced tables to the right of the referencing table', () => {
    const positions = layoutPositions(tables, collectEdges(tables))
    expect(positions['departments']?.x).toBeGreaterThan(positions['employees']?.x ?? Number.POSITIVE_INFINITY)
  })

  it('returns a finite position for every table', () => {
    const positions = layoutPositions(tables, collectEdges(tables))
    for (const table of tables) {
      expect(Number.isFinite(positions[table.name]?.x)).toBe(true)
      expect(Number.isFinite(positions[table.name]?.y)).toBe(true)
    }
  })

  it('grows node height with the number of columns', () => {
    const [employees, departments] = [tables[0], tables[1]]
    expect(nodeHeight(employees ?? { name: '', columns: [] })).toBeGreaterThan(nodeHeight(departments ?? { name: '', columns: [] }))
  })
})
