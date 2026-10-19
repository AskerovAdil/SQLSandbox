/** Русское склонение слова «строка» по числу: 1 строка, 2 строки, 5 строк. */
export function rowsLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${String(count)} строка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${String(count)} строки`
  return `${String(count)} строк`
}
