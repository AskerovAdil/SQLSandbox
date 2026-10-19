import { buildSuggestions, type CompletionTable, parseAliases, SQL_KEYWORDS } from './completionLogic'

const tables: CompletionTable[] = [
  {
    name: 'employees',
    kindLabel: 'таблица',
    columns: [
      { name: 'id', type: 'int4' },
      { name: 'dept_id', type: 'int4' },
      { name: 'name', type: 'text' },
    ],
  },
  {
    name: 'departments',
    kindLabel: 'таблица',
    columns: [
      { name: 'id', type: 'int4' },
      { name: 'title', type: 'text' },
    ],
  },
]

describe('parseAliases', () => {
  it('maps aliases and table names to tables', () => {
    const aliases = parseAliases('SELECT * FROM employees e JOIN departments AS d ON d.id = e.dept_id')
    expect(aliases.get('e')).toBe('employees')
    expect(aliases.get('d')).toBe('departments')
    expect(aliases.get('employees')).toBe('employees')
  })

  it('does not treat keywords after a table as aliases', () => {
    const aliases = parseAliases('SELECT * FROM employees WHERE id = 1')
    expect(aliases.has('where')).toBe(false)
  })

  it('strips schema and quotes', () => {
    expect(parseAliases('SELECT * FROM public."Employees" x').get('x')).toBe('employees')
  })
})

describe('buildSuggestions', () => {
  it('suggests keywords, tables and columns in a plain position', () => {
    const items = buildSuggestions('SEL', 'SEL', tables)
    expect(items.some((item) => item.kind === 'keyword' && item.label === 'SELECT')).toBe(true)
    expect(items.some((item) => item.kind === 'table' && item.label === 'employees')).toBe(true)
    expect(items.some((item) => item.kind === 'column' && item.label === 'title')).toBe(true)
  })

  it('lists each column name once', () => {
    const ids = buildSuggestions('', '', tables).filter((item) => item.kind === 'column' && item.label === 'id')
    expect(ids).toHaveLength(1)
  })

  it('suggests only columns of the table behind an alias', () => {
    const sql = 'SELECT e. FROM employees e'
    const items = buildSuggestions('SELECT e.', sql, tables)
    expect(items.map((item) => item.label)).toEqual(['id', 'dept_id', 'name'])
    expect(items.every((item) => item.kind === 'column')).toBe(true)
  })

  it('resolves a table name used directly as qualifier', () => {
    const items = buildSuggestions('departments.', 'SELECT departments.', tables)
    expect(items.map((item) => item.label)).toEqual(['id', 'title'])
  })

  it('returns nothing for an unknown qualifier', () => {
    expect(buildSuggestions('nope.', 'SELECT nope.', tables)).toEqual([])
  })

  it('keeps the keyword list free of duplicates', () => {
    expect(new Set(SQL_KEYWORDS).size).toBe(SQL_KEYWORDS.length)
  })
})
