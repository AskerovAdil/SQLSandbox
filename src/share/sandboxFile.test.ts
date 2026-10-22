import { base64ToUtf8, decodeSandbox, encodeSandbox, MAX_SANDBOX_BYTES, utf8ToBase64 } from './sandboxFile'
import { parseSandboxId } from './route'

describe('sandbox file', () => {
  it('round-trips code and data', () => {
    const text = encodeSandbox({ sql: 'SELECT 1;', data: 'abc', updatedAt: '2026-10-22T10:00:00.000Z' })
    expect(decodeSandbox(text)).toEqual({ sql: 'SELECT 1;', data: 'abc', updatedAt: '2026-10-22T10:00:00.000Z' })
  })

  it('rejects broken JSON, foreign formats and missing fields', () => {
    expect(() => decodeSandbox('не json')).toThrow('повреждён')
    expect(() => decodeSandbox(JSON.stringify({ format: 'other', version: 1 }))).toThrow('Неизвестный формат')
    expect(() => decodeSandbox(JSON.stringify({ format: 'sql-sandbox-shared', version: 1, sql: 'x' }))).toThrow('не хватает полей')
  })

  it('refuses to encode files above the content limit', () => {
    const big = 'x'.repeat(MAX_SANDBOX_BYTES + 1)
    expect(() => encodeSandbox({ sql: big, data: '', updatedAt: 'now' })).toThrow('больше 900 КБ')
  })

  it('keeps Unicode through base64 conversion', () => {
    const text = 'SELECT \'Анна\' -- 日本語 🙂'
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text)
  })
})

describe('parseSandboxId', () => {
  const base = '/SQLSandbox/'

  it('reads a GUID from the path', () => {
    expect(parseSandboxId('/SQLSandbox/3F2504E0-4F89-41D3-9A0C-0305E82C3301', base)).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
  })

  it('ignores the base path itself and other paths', () => {
    expect(parseSandboxId('/SQLSandbox/', base)).toBeNull()
    expect(parseSandboxId('/SQLSandbox/not-a-guid', base)).toBeNull()
    expect(parseSandboxId('/other/3f2504e0-4f89-41d3-9a0c-0305e82c3301', base)).toBeNull()
  })
})
