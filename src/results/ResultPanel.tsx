import { useState } from 'react'
import type { StatementResult } from '../db/executeScript'
import { ExplainView } from '../explain/ExplainView'
import { rowsLabel } from '../lib/plural'
import { ResultGrid } from './ResultGrid'

interface ResultPanelProps {
  results: StatementResult[]
  running: boolean
}

export function ResultPanel({ results, running }: ResultPanelProps) {
  const [selected, setSelected] = useState(0)
  const current = results[Math.min(selected, results.length - 1)]

  if (results.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {running ? 'Выполняется…' : 'Выполните запрос: Ctrl+Enter — statement под курсором, Ctrl+Shift+Enter — весь скрипт'}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 px-2 py-1 dark:border-zinc-800">
        {results.map((result, index) => (
          <button
            key={result.index}
            type="button"
            onClick={() => {
              setSelected(index)
            }}
            className={`rounded px-2 py-0.5 font-mono text-xs ${
              index === selected ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            } ${result.kind === 'error' ? 'text-red-600 dark:text-red-400' : ''}`}
          >
            #{String(result.index + 1)} {resultTabLabel(result)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{current && <ResultBody result={current} />}</div>
      {current && (
        <div className="border-t border-zinc-200 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800">
          {current.durationMs.toFixed(1)} ms
          {current.kind === 'rows' && ` · ${rowsLabel(current.rows.length)}`}
          {current.kind === 'error' && results.length > 1 && ` · скрипт остановлен на statement ${String(current.index + 1)}`}
        </div>
      )}
    </div>
  )
}

function ResultBody({ result }: { result: StatementResult }) {
  switch (result.kind) {
    case 'rows':
      return <ResultGrid columns={result.columns} rows={result.rows} />
    case 'command':
      return <div className="p-3 font-mono text-sm">{result.message}</div>
    case 'error':
      return (
        <div className="p-3">
          <div className="font-mono text-sm text-red-600 dark:text-red-400">{result.message}</div>
          <pre className="mt-2 overflow-auto font-mono text-xs text-zinc-500">{result.sql}</pre>
        </div>
      )
    case 'plan':
      return <ExplainView plan={result.plan} />
  }
}

function resultTabLabel(result: StatementResult): string {
  switch (result.kind) {
    case 'error':
      return 'ошибка'
    case 'rows':
      return rowsLabel(result.rows.length)
    case 'plan':
      return 'план'
    case 'command':
      return 'ок'
  }
}
