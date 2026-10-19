import { useCallback, useRef, useState } from 'react'
import { type EditorError, type RunScope, SqlEditor, type SqlEditorHandle } from './editor/SqlEditor'
import { executeScript, type StatementResult } from './db/executeScript'
import { useDatabase } from './db/useDatabase'
import { ResultPanel } from './results/ResultPanel'
import { StorageErrorScreen } from './app/StorageErrorScreen'

/** Пока одна вкладка; на этапе 2 идентификатор станет частью состояния вкладок. */
const TAB_ID = 'default'

const INITIAL_SQL = `-- Ctrl+Enter — выполнить statement под курсором, Ctrl+Shift+Enter — весь скрипт
CREATE TABLE demo (id int PRIMARY KEY, name text, score numeric);

INSERT INTO demo VALUES (1, 'Анна', 9.5), (2, 'Борис', NULL), (3, '', 7);

SELECT id, name, score FROM demo ORDER BY id;
`

export default function App() {
  const database = useDatabase(TAB_ID)
  const editorRef = useRef<SqlEditorHandle>(null)
  const [code, setCode] = useState(INITIAL_SQL)
  const [results, setResults] = useState<StatementResult[]>([])
  const [running, setRunning] = useState(false)

  const runScope = useCallback(
    async (scope: RunScope) => {
      if (database.status !== 'ready' || running || !editorRef.current) return
      const request = editorRef.current.getRunRequest(scope)
      if (request.text.trim() === '') return

      setRunning(true)
      try {
        setResults(await executeScript(database.db, request.text, request.baseOffset))
      } catch (error: unknown) {
        setResults([
          {
            index: 0,
            sql: request.text,
            start: request.baseOffset,
            durationMs: 0,
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
            offset: request.baseOffset,
          },
        ])
      } finally {
        setRunning(false)
      }
    },
    [database, running],
  )

  if (database.status === 'error') return <StorageErrorScreen error={database.error} />

  const failed = results.find((result) => result.kind === 'error')
  const error: EditorError | null =
    failed?.kind === 'error' ? { offset: failed.offset, message: failed.message } : null
  const ready = database.status === 'ready'

  return (
    <div className="flex h-dvh flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h1 className="mr-auto text-sm font-semibold">SQL Sandbox</h1>
        <span className="text-xs text-zinc-500">{ready ? 'PostgreSQL · PGlite' : 'Открываем базу…'}</span>
        <button
          type="button"
          disabled={!ready || running}
          onClick={() => {
            void runScope('statement')
          }}
          className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Run
        </button>
        <button
          type="button"
          disabled={!ready || running}
          onClick={() => {
            void runScope('script')
          }}
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Run all
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <section className="min-h-0 flex-[3]">
          <SqlEditor
            ref={editorRef}
            value={code}
            onChange={setCode}
            onRunStatement={() => {
              void runScope('statement')
            }}
            onRunScript={() => {
              void runScope('script')
            }}
            error={error}
          />
        </section>
        <section className="min-h-0 flex-[2] border-t border-zinc-200 dark:border-zinc-800">
          <ResultPanel results={results} running={running} />
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-4 py-1 text-xs text-zinc-500 dark:border-zinc-800">
        Данные хранятся только в этом браузере на этом устройстве. Перенос между браузерами будет доступен через экспорт и импорт.
      </footer>
    </div>
  )
}
