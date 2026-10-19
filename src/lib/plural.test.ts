import { rowsLabel } from './plural'

describe('rowsLabel', () => {
  it('picks the right Russian plural form', () => {
    expect(rowsLabel(1)).toBe('1 строка')
    expect(rowsLabel(2)).toBe('2 строки')
    expect(rowsLabel(4)).toBe('4 строки')
    expect(rowsLabel(5)).toBe('5 строк')
    expect(rowsLabel(11)).toBe('11 строк')
    expect(rowsLabel(12)).toBe('12 строк')
    expect(rowsLabel(21)).toBe('21 строка')
    expect(rowsLabel(22)).toBe('22 строки')
  })
})
