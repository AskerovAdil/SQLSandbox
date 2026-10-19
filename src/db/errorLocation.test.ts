import { locateErrorInStatement } from './errorLocation'

describe('locateErrorInStatement', () => {
  it('finds the token named by a syntax error as a whole word', () => {
    expect(locateErrorInStatement('syntax error at or near "SELEC"', 'SELECT 1;\nSELEC 2')).toBe(10)
  })

  it('finds the quoted identifier of a missing relation', () => {
    expect(locateErrorInStatement('relation "demo2" does not exist', 'SELECT * FROM demo2')).toBe(14)
  })

  it('handles tokens with punctuation', () => {
    expect(locateErrorInStatement('syntax error at or near ";"', 'SELECT 1 +;')).toBe(10)
  })

  it('falls back to the statement start when the token is unknown', () => {
    expect(locateErrorInStatement('division by zero', 'SELECT 1/0')).toBe(0)
    expect(locateErrorInStatement('syntax error at or near "XYZ"', 'SELECT 1')).toBe(0)
  })
})
