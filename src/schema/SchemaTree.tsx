import { ChevronDown, ChevronRight, Key, KeyRound, Link, Table2, Eye, Timer } from 'lucide-react'
import { useState } from 'react'
import type { RelationKind, SchemaRelation } from './buildSchema'

interface SchemaTreeProps {
  relations: SchemaRelation[]
  loading: boolean
  onInsertSelect: (name: string) => void
}

const KIND_LABEL: Record<RelationKind, string> = {
  table: 'таблица',
  view: 'представление',
  'temp-table': 'временная таблица',
  'temp-view': 'временное представление',
}

export function SchemaTree({ relations, loading, onInsertSelect }: SchemaTreeProps) {
  if (loading && relations.length === 0) {
    return <p className="px-3 py-2 text-xs text-zinc-500">Загружаем схему…</p>
  }
  if (relations.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-zinc-500">
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Пока нет объектов</p>
        <p className="mt-1">Создайте таблицу в редакторе, и она появится здесь.</p>
      </div>
    )
  }
  return (
    <ul className="space-y-px py-1">
      {relations.map((relation) => (
        <RelationItem key={`${relation.schema}.${relation.name}`} relation={relation} onInsertSelect={onInsertSelect} />
      ))}
    </ul>
  )
}

function RelationItem({
  relation,
  onInsertSelect,
}: {
  relation: SchemaRelation
  onInsertSelect: (name: string) => void
}) {
  const [open, setOpen] = useState(true)
  const isView = relation.kind === 'view' || relation.kind === 'temp-view'
  const isTemp = relation.kind === 'temp-table' || relation.kind === 'temp-view'
  const Icon = isView ? Eye : Table2
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <li>
      <div className="group flex items-center gap-1 rounded px-1 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70">
        <button
          type="button"
          aria-label={open ? 'Свернуть' : 'Развернуть'}
          onClick={() => {
            setOpen((value) => !value)
          }}
          className="rounded p-0.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <Chevron size={14} />
        </button>
        <button
          type="button"
          title={`${KIND_LABEL[relation.kind]}: ${relation.name} — вставить SELECT в редактор`}
          onClick={() => {
            onInsertSelect(relation.name)
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-sm"
        >
          <Icon size={14} className="shrink-0 text-zinc-500" />
          <span className="truncate font-medium">{relation.name}</span>
          {isTemp && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              <Timer size={10} />
              temp
            </span>
          )}
          {isView && (
            <span className="shrink-0 rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
              view
            </span>
          )}
        </button>
        <span className="shrink-0 pr-1 text-[10px] text-zinc-400">{relation.columns.length}</span>
      </div>

      {open && (
        <ul className="ml-5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          {relation.columns.map((column) => (
            <li
              key={column.name}
              className="flex items-center gap-1.5 py-0.5 font-mono text-xs"
              title={column.references ? `→ ${column.references}` : undefined}
            >
              <span className="w-3.5 shrink-0">
                {column.primaryKey && <KeyRound size={12} className="text-amber-600 dark:text-amber-400" aria-label="первичный ключ" />}
                {!column.primaryKey && column.references && (
                  <Link size={12} className="text-sky-600 dark:text-sky-400" aria-label="внешний ключ" />
                )}
              </span>
              <span className="truncate text-zinc-800 dark:text-zinc-200">{column.name}</span>
              <span className="ml-auto shrink-0 text-zinc-500">{column.type}</span>
              {!column.nullable && <span className="shrink-0 text-[10px] text-zinc-400">NN</span>}
            </li>
          ))}
          {relation.indexes.length > 0 && (
            <li className="mt-1 space-y-0.5 pb-1">
              {relation.indexes.map((index) => (
                <div key={index.name} className="flex items-center gap-1 text-[11px] text-zinc-500" title={index.definition}>
                  <Key size={10} className="shrink-0" />
                  <span className="truncate">{index.name}</span>
                </div>
              ))}
            </li>
          )}
        </ul>
      )}
    </li>
  )
}
