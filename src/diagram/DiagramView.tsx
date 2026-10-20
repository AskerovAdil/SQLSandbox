import '@xyflow/react/dist/style.css'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type OnNodeDrag,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import { Download, Maximize2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { SchemaRelation } from '../schema/buildSchema'
import { collectEdges, type DiagramEdge, type DiagramTable, layoutPositions, NODE_WIDTH, nodeHeight, type Point } from './layout'
import { loadPositions, savePositions } from './positions'
import { useUiStore } from '../stores/uiStore'

/** Сколько миллисекунд подсвечивать новые таблицы и связи после выполнения DDL. */
const FRESH_MS = 2500

interface DiagramViewProps {
  tabId: string
  relations: SchemaRelation[]
  freshNames: ReadonlySet<string>
}

interface TableNodeData extends Record<string, unknown> {
  table: DiagramTable
  fresh: boolean
}

export function DiagramView({ tabId, relations, freshNames }: DiagramViewProps) {
  const tables = useMemo<DiagramTable[]>(
    () =>
      relations
        .filter((relation) => relation.kind === 'table' || relation.kind === 'temp-table')
        .map((relation) => ({
          name: relation.name,
          columns: relation.columns.map((column) => ({
            name: column.name,
            type: column.type,
            primaryKey: column.primaryKey,
            references: column.references,
          })),
        })),
    [relations],
  )

  if (tables.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-zinc-500">
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Диаграмма пуста</p>
        <p className="mt-1">Создайте таблицы с внешними ключами — связи появятся автоматически.</p>
      </div>
    )
  }

  // Ключ по структуре: при изменении таблиц или связей канвас пересоздаётся с сохранёнными позициями.
  const signature = JSON.stringify(tables)
  return (
    <ReactFlowProvider>
      <DiagramCanvas key={signature} tabId={tabId} tables={tables} freshNames={freshNames} />
    </ReactFlowProvider>
  )
}

function DiagramCanvas({
  tabId,
  tables,
  freshNames,
}: {
  tabId: string
  tables: DiagramTable[]
  freshNames: ReadonlySet<string>
}) {
  const theme = useUiStore((state) => state.theme)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const edges = useMemo(() => collectEdges(tables), [tables])
  const hasFresh = freshNames.size > 0

  const initialNodes = useMemo<Node<TableNodeData>[]>(() => {
    const saved = loadPositions(tabId)
    const automatic = layoutPositions(tables, edges)
    return tables.map((table) => {
      const position: Point = saved[table.name] ?? automatic[table.name] ?? { x: 0, y: 0 }
      return {
        id: table.name,
        type: 'table',
        position,
        data: { table, fresh: freshNames.has(table.name) },
      }
    })
    // Узлы считаются один раз при монтировании: при изменении структуры канвас пересоздаётся (см. key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(initialNodes)

  // Подсветка новых объектов гаснет через FRESH_MS.
  useEffect(() => {
    if (!hasFresh) return
    const timer = window.setTimeout(() => {
      setNodes((current) => current.map((node) => (node.data.fresh ? { ...node, data: { ...node.data, fresh: false } } : node)))
    }, FRESH_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [hasFresh, setNodes])

  const flowEdges = useMemo<Edge[]>(
    () => edges.map((edge) => toFlowEdge(edge, freshNames)),
    [edges, freshNames],
  )

  const handleDragStop: OnNodeDrag<Node<TableNodeData>> = (_event, _node, allNodes) => {
    const positions: Record<string, Point> = {}
    for (const node of allNodes) positions[node.id] = node.position
    savePositions(tabId, positions)
  }

  const dark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <ReactFlow<Node<TableNodeData>>
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDragStop={handleDragStop}
        colorMode={dark ? 'dark' : 'light'}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <DiagramToolbar wrapperRef={wrapperRef} />
      </ReactFlow>
    </div>
  )
}

function DiagramToolbar({ wrapperRef }: { wrapperRef: React.RefObject<HTMLDivElement | null> }) {
  const { fitView } = useReactFlow()

  const exportPng = async () => {
    const element = wrapperRef.current
    if (!element) return
    const dark = document.documentElement.classList.contains('dark')
    const dataUrl = await toPng(element, {
      backgroundColor: dark ? '#09090b' : '#ffffff',
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains('react-flow__controls')),
    })
    const link = document.createElement('a')
    link.download = 'diagram.png'
    link.href = dataUrl
    link.click()
  }

  return (
    <Panel position="top-right" className="flex gap-1">
      <button
        type="button"
        onClick={() => {
          void fitView({ padding: 0.2, duration: 300 })
        }}
        className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <Maximize2 size={12} aria-hidden="true" />
        Уместить
      </button>
      <button
        type="button"
        onClick={() => {
          void exportPng()
        }}
        className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <Download size={12} aria-hidden="true" />
        PNG
      </button>
    </Panel>
  )
}

function TableNode({ data }: NodeProps<Node<TableNodeData>>) {
  const { table, fresh } = data
  return (
    <div
      style={{ width: NODE_WIDTH, height: nodeHeight(table) }}
      className={`relative rounded-md border bg-white font-mono text-xs shadow-sm dark:bg-zinc-950 ${
        fresh ? 'border-blue-500 ring-2 ring-blue-500/60' : 'border-zinc-300 dark:border-zinc-700'
      }`}
    >
      <div className="rounded-t-md border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900">
        {table.name}
      </div>
      <ul className="py-1">
        {table.columns.map((column, index) => (
          <li
            key={column.name}
            className="relative flex h-[22px] items-center gap-2 px-2 text-[11px]"
            style={{ height: 22 }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`t-${column.name}`}
              style={{ top: 32 + index * 22 + 11, background: '#71717a' }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`s-${column.name}`}
              style={{ top: 32 + index * 22 + 11, background: '#71717a' }}
            />
            <span className="w-3 shrink-0 text-amber-600">{column.primaryKey ? '🔑' : ''}</span>
            <span className="truncate">{column.name}</span>
            <span className="ml-auto shrink-0 text-zinc-500">{column.type}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const NODE_TYPES = { table: TableNode }

function toFlowEdge(edge: DiagramEdge, freshNames: ReadonlySet<string>): Edge {
  const fresh = freshNames.has(edge.fromTable) || freshNames.has(edge.toTable)
  return {
    id: edge.id,
    source: edge.fromTable,
    sourceHandle: `s-${edge.fromColumn}`,
    target: edge.toTable,
    targetHandle: `t-${edge.toColumn}`,
    type: 'smoothstep',
    label: 'N : 1',
    labelStyle: { fontSize: 10, fill: '#71717a' },
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    className: fresh ? 'diagram-edge-fresh' : undefined,
    animated: fresh,
  }
}
