import { buildBundle, parseBundle } from './bundle'

describe('bundle', () => {
  it('round-trips tabs', () => {
    const tabs = [{ name: 'Тест', sql: 'SELECT 1;', data: 'aGVsbG8=' }]
    expect(parseBundle(buildBundle(tabs))).toEqual(tabs)
  })

  it('rejects files that are not a SQL Sandbox bundle', () => {
    expect(parseBundle('not json')).toBeNull()
    expect(parseBundle(JSON.stringify({ format: 'other', version: 1, tabs: [] }))).toBeNull()
    expect(parseBundle(JSON.stringify({ format: 'sql-sandbox-bundle', version: 1, tabs: [{ name: 1 }] }))).toBeNull()
  })
})
