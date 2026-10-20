import { ChevronDown, ChevronRight, KeyRound, Link, Table2, Eye } from 'lucide-react'
import { useState } from 'react'
import { rowsLabel } from '../lib/plural'
import type { RowDiff } from './snapshot'
import type { SessionTable } from './sessionView'

/** Строк на одной «странице» карточки; дальше — кнопка «показать ещё». */
export const ROWS_PAGE = 50

interface TableCardProps {
  table: SessionTable
  fresh: boolean
}

export function TableCard({ table, fresh }: TableCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [shown, setShown] = useState(ROWS_PAGE)
  const Icon = table.kind === 'view' || table.kind === 'temp-view' ? Eye : Table2
  const isTemp = table.kind === 'temp-table' || table.kind === 'temp-view'
  const dropped = table.status === 'dropped'
  const changed = table.rows.some((row) => row.status !== 'same')

  return (
    <article
      className={`overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${
        dropped ? 'animate-leave' : ''
      } ${fresh ? 'ring-2 ring-blue-500/70' : ''}`}
      aria-label={`Таблица ${table.name}`}
    >
      <header className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
          onClick={() => {
            setCollapsed((value) => !value)
          }}
          className="rounded p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Icon size={14} className="shrink-0 text-zinc-500" aria-hidden="true" />
        <span className={`min-w-0 truncate font-mono text-sm font-semibold ${dropped ? 'line-through' : ''}`}>{table.name}</span>
        {table.status === 'new' && <Badge tone="blue">new</Badge>}
        {dropped && <Badge tone="red">удалена</Badge>}
        {isTemp && <Badge tone="amber">temp</Badge>}
        <span className="ml-auto shrink-0 text-xs text-zinc-500">{dropped ? '' : rowsLabel(table.rowCount)}</span>
      </header>

      {!collapsed && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full border-collapse font-mono text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  {table.columns.map((column) => (
                    <th key={column.name} className="border-b border-zinc-200 px-2 py-1 text-left font-normal dark:border-zinc-800">
                      <div className="flex items-center gap-1">
                        {column.primaryKey && <KeyRound size={11} className="text-amber-600" aria-label="первичный ключ" />}
                        {!column.primaryKey && column.references && (
                          <Link size={11} className="text-sky-600" aria-label={`внешний ключ → ${column.references}`} />
                        )}
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{column.name}</span>
                        {!column.nullable && <span className="text-[9px] text-zinc-400">NN</span>}
                      </div>
                      <div className="text-[10px] text-zinc-500">{column.type}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, shown).map((row, index) => (
                  <DataRow key={`${row.status}-${row.key}-${String(index)}`} row={row} columns={table.columns.map((c) => c.name)} />
                ))}
              </tbody>
            </table>
          </div>

          {table.rows.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-zinc-500">Строк нет</p>
          )}
          {table.rows.length > shown && (
            <button
              type="button"
              onClick={() => {
                setShown((value) => value + ROWS_PAGE)
              }}
              className="w-full border-t border-zinc-200 py-1 text-xs text-blue-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-blue-400 dark:hover:bg-zinc-900"
            >
              Показать ещё ({table.rows.length - shown})
            </button>
          )}
          {table.truncated && (
            <p className="border-t border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-800">
              Показаны первые строки: в таблице больше, чем лимит снимка
            </p>
          )}
          {changed && !table.keyedByPrimaryKey && table.kind === 'table' && (
            <p className="border-t border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-800">
              Без первичного ключа строки сопоставляются по ctid: UPDATE может выглядеть как удаление и вставка.
            </p>
          )}
        </div>
      )}
    </article>
  )
}

function DataRow({ row, columns }: { row: RowDiff; columns: string[] }) {
  const rowClass =
    row.status === 'added'
      ? 'bg-emerald-100/70 dark:bg-emerald-900/30'
      : row.status === 'removed'
        ? 'text-zinc-500 line-through opacity-60'
        : ''
  return (
    <tr className={`${rowClass} border-b border-zinc-100 last:border-0 dark:border-zinc-900`}>
      {columns.map((column) => {
        const value = row.cells[column]
        const changedCell = row.status === 'changed' && row.changedColumns.includes(column)
        return (
          <td
            key={column}
            title={value ?? 'NULL'}
            className={`max-w-48 truncate px-2 py-0.5 ${changedCell ? 'bg-amber-200/80 dark:bg-amber-700/40' : ''}`}
          >
            {value === null ? <span className="italic text-zinc-400">NULL</span> : value === '' ? <span className="text-zinc-400">''</span> : value}
          </td>
        )
      })}
    </tr>
  )
}

function Badge({ tone, children }: { tone: 'blue' | 'red' | 'amber'; children: string }) {
  const classes = {
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  }[tone]
  return <span className={`shrink-0 rounded px-1 text-[10px] font-medium ${classes}`}>{children}</span>
}
