/**
 * Делит текст по строке-маркеру. before — всё до маркера (то, что выполняется как данные),
 * after — всё после (то, что попадает в редактор). Без маркера after = null.
 */
export function splitAtMarker(source: string, marker: string): { before: string; after: string | null } {
  const lines = source.split('\n')
  const index = lines.findIndex((line) => line.trim() === marker)
  if (index === -1) return { before: source, after: null }
  return {
    before: lines.slice(0, index).join('\n'),
    after: lines.slice(index + 1).join('\n').replace(/^\n/, ''),
  }
}
