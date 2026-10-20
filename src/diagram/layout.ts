import * as dagre from '@dagrejs/dagre'

export interface DiagramColumn {
  name: string
  type: string
  primaryKey: boolean
  references: string | null
}

export interface DiagramTable {
  name: string
  columns: DiagramColumn[]
}

export interface DiagramEdge {
  id: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export interface Point {
  x: number
  y: number
}

/**
 * Размеры узла. Эти же константы использует отрисовка (DiagramView), поэтому раскладка
 * и фактическая высота не расходятся: высота заголовка задаётся явно, а не текстом.
 */
export const NODE_WIDTH = 240
/** Рамка узла сверху и снизу (1 px each). */
export const NODE_BORDER = 2
/** Заголовок включая свою нижнюю границу. */
export const HEADER_HEIGHT = 33
/** Вертикальные отступы списка колонок (py-1). */
export const LIST_PADDING = 8
export const ROW_HEIGHT = 22

export function nodeHeight(table: DiagramTable): number {
  return NODE_BORDER + HEADER_HEIGHT + LIST_PADDING + Math.max(table.columns.length, 1) * ROW_HEIGHT
}

/**
 * Связи из внешних ключей: колонка referencing → колонка, на которую она ссылается.
 * Ссылки на таблицы, которых нет в списке (например, представления), пропускаются.
 */
export function collectEdges(tables: DiagramTable[]): DiagramEdge[] {
  const names = new Set(tables.map((table) => table.name))
  const edges: DiagramEdge[] = []
  for (const table of tables) {
    for (const column of table.columns) {
      if (!column.references) continue
      const separator = column.references.lastIndexOf('.')
      if (separator <= 0) continue
      const toTable = column.references.slice(0, separator)
      const toColumn = column.references.slice(separator + 1)
      if (!names.has(toTable) || toTable === table.name && toColumn === column.name) continue
      edges.push({
        id: `${table.name}.${column.name}->${toTable}.${toColumn}`,
        fromTable: table.name,
        fromColumn: column.name,
        toTable,
        toColumn,
      })
    }
  }
  return edges
}

/** Автоматическая раскладка слева направо. Возвращает левый верхний угол каждого узла. */
export function layoutPositions(tables: DiagramTable[], edges: DiagramEdge[]): Record<string, Point> {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, marginx: 20, marginy: 20 })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const table of tables) {
    graph.setNode(table.name, { width: NODE_WIDTH, height: nodeHeight(table) })
  }
  for (const edge of edges) {
    graph.setEdge(edge.fromTable, edge.toTable)
  }
  dagre.layout(graph)

  const positions: Record<string, Point> = {}
  for (const table of tables) {
    const node = graph.node(table.name) as { x: number; y: number; width: number; height: number } | undefined
    if (!node) continue
    positions[table.name] = { x: node.x - node.width / 2, y: node.y - node.height / 2 }
  }
  return positions
}
