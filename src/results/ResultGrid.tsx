import type { ResultColumn } from '../db/executeScript'
import { typeName } from '../db/pgTypes'
import { formatCell } from './formatCell'

/** Ограничение на число отрисованных строк; виртуализация появится на этапе 2–4. */
const MAX_RENDERED_ROWS = 1000

interface ResultGridProps {
  columns: ResultColumn[]
  rows: Record<string, unknown>[]
}

export function ResultGrid({ columns, rows }: ResultGridProps) {
  const visible = rows.slice(0, MAX_RENDERED_ROWS)

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
            <tr>
              {columns.map((column) => (
                <th key={column.name} className="border-b border-zinc-300 px-3 py-1.5 text-left font-semibold dark:border-zinc-700">
                  <div>{column.name}</div>
                  <div className="font-normal text-zinc-500">{typeName(column.typeId)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-950 dark:even:bg-zinc-900/50">
                {columns.map((column) => {
                  const value = row[column.name]
                  const isNull = value === null || value === undefined
                  return (
                    <td
                      key={column.name}
                      className={`max-w-96 truncate border-b border-zinc-200 px-3 py-1 dark:border-zinc-800 ${isNull ? 'italic text-zinc-400' : ''}`}
                      title={formatCell(value)}
                    >
                      {isNull ? 'NULL' : formatCell(value) === '' ? <span className="text-zinc-400">''</span> : formatCell(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_RENDERED_ROWS && (
        <div className="border-t border-zinc-200 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800">
          Показаны первые {MAX_RENDERED_ROWS} из {rows.length} строк
        </div>
      )}
    </div>
  )
}
