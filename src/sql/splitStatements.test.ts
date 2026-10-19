import { splitStatements, statementAt } from './splitStatements'

describe('splitStatements', () => {
  it('splits simple statements and trims them', () => {
    const result = splitStatements('  SELECT 1;\n  SELECT 2  ;')
    expect(result.map((s) => s.text)).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('keeps offsets that point into the source', () => {
    const source = 'SELECT 1;\nSELECT 2'
    for (const statement of splitStatements(source)) {
      expect(source.slice(statement.start, statement.end)).toBe(statement.text)
    }
  })

  it('ignores semicolons inside string literals', () => {
    const result = splitStatements("SELECT 'a;b'; SELECT 2")
    expect(result.map((s) => s.text)).toEqual(["SELECT 'a;b'", 'SELECT 2'])
  })

  it('handles doubled quotes inside string literals', () => {
    const result = splitStatements("SELECT 'it''s;'; SELECT 2")
    expect(result).toHaveLength(2)
    expect(result[0]?.text).toBe("SELECT 'it''s;'")
  })

  it('handles backslash escapes only in E-strings', () => {
    const escaped = splitStatements("SELECT E'it\\'s;'; SELECT 2")
    expect(escaped).toHaveLength(2)
    const plain = splitStatements("SELECT 'a\\'; SELECT 2")
    expect(plain.map((s) => s.text)).toEqual(["SELECT 'a\\'", 'SELECT 2'])
  })

  it('ignores semicolons in line and block comments', () => {
    const result = splitStatements('SELECT 1 -- a; b\n; /* c; /* nested; */ d; */ SELECT 2')
    expect(result.map((s) => s.text)).toEqual(['SELECT 1 -- a; b', '/* c; /* nested; */ d; */ SELECT 2'])
  })

  it('keeps dollar-quoted bodies together', () => {
    const script = 'CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql; SELECT f()'
    const result = splitStatements(script)
    expect(result).toHaveLength(2)
    expect(result[0]?.text.endsWith('LANGUAGE plpgsql')).toBe(true)
  })

  it('supports named dollar tags and does not treat positional params as tags', () => {
    const result = splitStatements('SELECT $tag$a;b$tag$; SELECT $1')
    expect(result.map((s) => s.text)).toEqual(['SELECT $tag$a;b$tag$', 'SELECT $1'])
  })

  it('skips segments that contain only comments or whitespace', () => {
    expect(splitStatements('  -- nothing here\n;;  /* empty */ ;')).toEqual([])
    const result = splitStatements('SELECT 1;\n-- trailing comment')
    expect(result.map((s) => s.text)).toEqual(['SELECT 1'])
  })

  it('returns an empty list for an empty script', () => {
    expect(splitStatements('')).toEqual([])
  })
})

describe('statementAt', () => {
  const statements = splitStatements('SELECT 1; SELECT 2;')

  it('returns the statement that contains the offset', () => {
    expect(statementAt(statements, 2)?.text).toBe('SELECT 1')
    expect(statementAt(statements, 12)?.text).toBe('SELECT 2')
  })

  it('falls back to the previous statement for whitespace after a semicolon', () => {
    expect(statementAt(statements, 9)?.text).toBe('SELECT 1')
  })

  it('falls back to the first statement before any statement starts', () => {
    expect(statementAt(statements, 0)?.text).toBe('SELECT 1')
  })

  it('returns undefined when there are no statements', () => {
    expect(statementAt([], 0)).toBeUndefined()
  })
})
