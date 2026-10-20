/** Узел плана EXPLAIN (FORMAT JSON) с вычисленным временем собственной работы. */
export interface PlanNode {
  nodeType: string
  relation: string | null
  index: string | null
  /** Оценка стоимости из планировщика. */
  totalCost: number
  /** Фактическое время узла с учётом повторов (loops), мс. */
  totalMs: number
  /** Время самого узла без дочерних, мс. */
  exclusiveMs: number
  actualRows: number
  planRows: number
  loops: number
  children: PlanNode[]
}

export interface PlanDocument {
  root: PlanNode
  executionMs: number | null
  planningMs: number | null
}

type RawPlan = Record<string, unknown>

/** Разбирает результат EXPLAIN (ANALYZE, FORMAT JSON). Возвращает null, если формат неожиданный. */
export function parsePlanDocument(value: unknown): PlanDocument | null {
  const document: unknown = typeof value === 'string' ? safeJson(value) : value
  const first: unknown = Array.isArray(document) ? (document as unknown[])[0] : null
  if (!isRecord(first) || !isRecord(first['Plan'])) return null

  const root = toNode(first['Plan'])
  return {
    root,
    executionMs: numberOrNull(first['Execution Time']),
    planningMs: numberOrNull(first['Planning Time']),
  }
}

/** Узлы с наибольшим собственным временем: их подсвечиваем как дорогие. */
export function hottestNodes(root: PlanNode, count = 2): Set<PlanNode> {
  const all = flatten(root).filter((node) => node.exclusiveMs > 0)
  all.sort((a, b) => b.exclusiveMs - a.exclusiveMs)
  return new Set(all.slice(0, count))
}

export function flatten(root: PlanNode): PlanNode[] {
  return [root, ...root.children.flatMap((child) => flatten(child))]
}

function toNode(raw: RawPlan): PlanNode {
  const loops = numberOrNull(raw['Actual Loops']) ?? 1
  const totalMs = (numberOrNull(raw['Actual Total Time']) ?? 0) * loops
  const children = Array.isArray(raw['Plans']) ? raw['Plans'].filter(isRecord).map(toNode) : []
  const childrenMs = children.reduce((sum, child) => sum + child.totalMs, 0)
  return {
    nodeType: typeof raw['Node Type'] === 'string' ? raw['Node Type'] : 'Node',
    relation: typeof raw['Relation Name'] === 'string' ? raw['Relation Name'] : null,
    index: typeof raw['Index Name'] === 'string' ? raw['Index Name'] : null,
    totalCost: numberOrNull(raw['Total Cost']) ?? 0,
    totalMs,
    exclusiveMs: Math.max(0, totalMs - childrenMs),
    actualRows: numberOrNull(raw['Actual Rows']) ?? 0,
    planRows: numberOrNull(raw['Plan Rows']) ?? 0,
    loops,
    children,
  }
}

function isRecord(value: unknown): value is RawPlan {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}
