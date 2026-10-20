import { useVirtualizer } from '@tanstack/react-virtual'
import { lazy, Suspense, useRef, useState } from 'react'
import { ErrorBoundary } from '../app/ErrorBoundary'
import type { SchemaRelation } from '../schema/buildSchema'
import { type SessionMode, useUiStore } from '../stores/uiStore'
import { TableCard } from './TableCard'
import type { SessionTable } from './sessionView'

const DiagramView = lazy(() => import('../diagram/DiagramView').then((module) => ({ default: module.DiagramView })))

export interface SessionFailure {
  index: number
  message: string
}

interface SessionPanelProps {
  tabId: string
  tables: SessionTable[]
  relations: SchemaRelation[]
  freshNames: ReadonlySet<string>
  failure: SessionFailure | null
}

export function SessionPanel({ tabId, tables, relations, freshNames, failure }: SessionPanelProps) {
  const mode = useUiStore((state) => state.sessionMode)
  const setMode = useUiStore((state) => state.setSessionMode)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Таблицы сессии</h2>
        <div role="group" aria-label="Режим панели" className="ml-auto flex rounded-md bg-zinc-200/70 p-0.5 text-xs dark:bg-zinc-800">
          <ModeButton mode="data" current={mode} onSelect={setMode}>
            Данные
          </ModeButton>
          <ModeButton mode="diagram" current={mode} onSelect={setMode}>
            Диаграмма
          </ModeButton>
        </div>
      </div>

      {failure && (
        <div role="alert" className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          Скрипт выполнен частично, ошибка в statement {String(failure.index + 1)}: {failure.message}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ErrorBoundary>
          {mode === 'data' ? (
            <DataList tables={tables} freshNames={freshNames} />
          ) : (
            <Suspense fallback={<p className="p-3 text-xs text-zinc-500">Загружаем диаграмму…</p>}>
              <DiagramView key={tabId} tabId={tabId} relations={relations} freshNames={freshNames} />
            </Suspense>
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

function ModeButton({
  mode,
  current,
  onSelect,
  children,
}: {
  mode: SessionMode
  current: SessionMode
  onSelect: (mode: SessionMode) => void
  children: string
}) {
  const active = mode === current
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        onSelect(mode)
      }}
      className={`rounded px-2 py-0.5 ${active ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-600 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}`}
    >
      {children}
    </button>
  )
}

function DataList({ tables, freshNames }: { tables: SessionTable[]; freshNames: ReadonlySet<string> }) {
  const [filter, setFilter] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const visible = tables.filter((table) => table.name.toLowerCase().includes(filter.trim().toLowerCase()))

  // React Compiler пропускает этот компонент: библиотека виртуализации с ним несовместима. На работу не влияет.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 180,
    overscan: 4,
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <input
          type="search"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value)
          }}
          placeholder="Фильтр по имени таблицы"
          aria-label="Фильтр по имени таблицы"
          className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-zinc-700"
        />
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {tables.length === 0 && (
          <div className="px-1 py-6 text-center text-xs text-zinc-500">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">Таблиц пока нет</p>
            <p className="mt-1">Создайте таблицу или выберите шаблон — и здесь появятся её строки.</p>
          </div>
        )}
        {visible.length === 0 && tables.length > 0 && <p className="px-1 py-4 text-xs text-zinc-500">Ничего не найдено</p>}
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const table = visible[item.index]
            if (!table) return null
            return (
              <div
                key={`${table.id}-${table.status}`}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full pb-2"
                style={{ transform: `translateY(${String(item.start)}px)` }}
              >
                <TableCard table={table} fresh={freshNames.has(table.name)} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


