import { flatten, hottestNodes, type PlanDocument, type PlanNode } from './planModel'

interface ExplainViewProps {
  plan: PlanDocument
}

/** Дерево плана: тип узла, объект, стоимость, фактическое время и строки. Дорогие узлы подсвечены. */
export function ExplainView({ plan }: ExplainViewProps) {
  const hot = hottestNodes(plan.root)
  const maxExclusive = Math.max(...flatten(plan.root).map((node) => node.exclusiveMs), 0.000001)
  const total = plan.executionMs ?? plan.root.totalMs

  return (
    <div className="h-full overflow-auto p-3 font-mono text-xs">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400">
        <span>Выполнение: {formatMs(plan.executionMs)}</span>
        <span>Планирование: {formatMs(plan.planningMs)}</span>
        <span>Подсвечены самые дорогие узлы по собственному времени</span>
      </div>
      <ul className="space-y-1">
        <PlanRow node={plan.root} depth={0} hot={hot} maxExclusive={maxExclusive} total={total} />
      </ul>
    </div>
  )
}

function PlanRow({
  node,
  depth,
  hot,
  maxExclusive,
  total,
}: {
  node: PlanNode
  depth: number
  hot: Set<PlanNode>
  maxExclusive: number
  total: number
}) {
  const isHot = hot.has(node)
  const share = total > 0 ? Math.round((node.exclusiveMs / total) * 100) : 0
  const barWidth = Math.max(2, Math.round((node.exclusiveMs / maxExclusive) * 100))

  return (
    <li>
      <div
        className={`rounded border px-2 py-1 ${
          isHot
            ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40'
            : 'border-zinc-200 dark:border-zinc-800'
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-semibold">{node.nodeType}</span>
          {node.relation && <span className="text-zinc-600 dark:text-zinc-400">on {node.relation}</span>}
          {node.index && <span className="text-zinc-500">using {node.index}</span>}
          <span className="ml-auto text-zinc-500">cost {node.totalCost.toFixed(2)}</span>
          <span className={isHot ? 'font-semibold text-red-700 dark:text-red-300' : ''}>
            {formatMs(node.totalMs)} ({share}%)
          </span>
          <span className="text-zinc-500">
            rows {node.actualRows} / ~{node.planRows}
            {node.loops > 1 ? ` × ${String(node.loops)}` : ''}
          </span>
        </div>
        <div className="mt-1 h-1 rounded bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
          <div
            className={`h-1 rounded ${isHot ? 'bg-red-500' : 'bg-blue-500/70'}`}
            style={{ width: `${String(barWidth)}%` }}
          />
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-1 space-y-1">
          {node.children.map((child, index) => (
            <PlanRow key={index} node={child} depth={depth + 1} hot={hot} maxExclusive={maxExclusive} total={total} />
          ))}
        </ul>
      )}
    </li>
  )
}

function formatMs(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(3)} ms`
}
