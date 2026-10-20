import { splitAtMarker } from './splitAtMarker'

describe('splitAtMarker', () => {
  it('splits on the marker line', () => {
    expect(splitAtMarker('CREATE TABLE a (x int);\n-- @@queries\nSELECT 1;', '-- @@queries')).toEqual({
      before: 'CREATE TABLE a (x int);',
      after: 'SELECT 1;',
    })
  })

  it('returns null after when the marker is absent', () => {
    expect(splitAtMarker('SELECT 1;', '-- @@queries')).toEqual({ before: 'SELECT 1;', after: null })
  })

  it('matches the marker ignoring surrounding spaces', () => {
    expect(splitAtMarker('a\n  -- @@queries  \nb', '-- @@queries').after).toBe('b')
  })
})
