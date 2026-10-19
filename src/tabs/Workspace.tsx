import { Copy, PanelLeft, RotateCcw } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from '../app/ErrorBoundary'
import { StorageErrorScreen } from '../app/StorageErrorScreen'
import { type EditorError, type RunScope, SqlEditor, type SqlEditorHandle } from '../editor/SqlEditor'
import { executeScript, type StatementResult } from '../db/executeScript'
import { RESET_SQL, stageCopy } from '../db/databaseCopy'
import { useDatabase } from '../db/useDatabase'
import { ResultPanel } from '../results/ResultPanel'
import { loadSchema } from '../schema/loadSchema'
import type { SchemaRelation } from '../schema/buildSchema'
import { SchemaTree } from '../schema/SchemaTree'
import { useUiStore } from '../stores/uiStore'
import { type Tab, useTabsStore } from '../stores/tabsStore'
import type { PGliteWorker } from '@electric-sql/pglite/worker'

interface WorkspaceProps {
  tab: Tab
  dark: boolean
}

/**
 * Рабочая область одной вкладки. Вызывается с key=tab.id, поэтому каждая вкладка
 * открывает свою базу, а при переключении предыдущая база закрывается.
 */
export function Workspace({ tab, dark }: WorkspaceProps) {
  const database = useDatabase(tab.id)
  const ready: PGliteWorker | null = database.status === 'ready' ? database.db : null

  const schemaOpen = useUiStore((state) => state.schemaOpen)
  const toggleSchema = useUiStore((state) => state.toggleSchema)
  const setSql = useTabsStore((state) => state.setSql)
  const addTabFrom = useTabsStore((state) => state.addTabFrom)

  const editorRef = useRef<SqlEditorHandle>(null)
  const [results, setResults] = useState<StatementResult[]>([])
  const [running, setRunning] = useState(false)
  const [relations, setRelations] = useState<SchemaRelation[]>([])
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const refreshSchema = useCallback(async (db: PGliteWorker) => {
    try {
      setRelations(await loadSchema(db))
    } catch (error: unknown) {
      setNotice(`Не удалось загрузить схему: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSchemaLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    loadSchema(ready)
      .then((next) => {
        if (!cancelled) setRelations(next)
      })
      .catch((error: unknown) => {
        if (!cancelled) setNotice(`Не удалось загрузить схему: ${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready])

  const runScope = useCallback(
    async (scope: RunScope) => {
      if (!ready || running || !editorRef.current) return
      const request = editorRef.current.getRunRequest(scope)
      if (request.text.trim() === '') return

      setRunning(true)
      setNotice(null)
      try {
        setResults(await executeScript(ready, request.text, request.baseOffset))
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
        void refreshSchema(ready)
      }
    },
    [ready, running, refreshSchema],
  )

  const duplicate = async () => {
    if (!ready) return
    setNotice('Копируем вкладку…')
    try {
      const dump = await ready.dumpDataDir('none')
      const newId = addTabFrom(tab.id, tab.sql)
      stageCopy(newId, dump)
    } catch (error: unknown) {
      setNotice(`Не удалось скопировать вкладку: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const reset = async () => {
    if (!ready || running) return
    if (!window.confirm('Удалить все таблицы, представления и данные этой вкладки? Код в редакторе останется.')) return
    setRunning(true)
    try {
      await ready.exec(RESET_SQL)
      setResults([])
      setNotice('База вкладки очищена')
    } catch (error: unknown) {
      setNotice(`Сброс не удался: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setRunning(false)
      void refreshSchema(ready)
    }
  }

  if (database.status === 'error') return <StorageErrorScreen error={database.error} />

  const failed = results.find((result) => result.kind === 'error')
  const error: EditorError | null =
    failed?.kind === 'error' ? { offset: failed.offset, message: failed.message } : null
  const busy = !ready || running

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <IconButton label={schemaOpen ? 'Скрыть схему' : 'Показать схему'} onClick={toggleSchema} active={schemaOpen}>
          <PanelLeft size={16} />
        </IconButton>
        <span className="min-w-0 truncate text-xs text-zinc-500" aria-live="polite">
          {ready ? (notice ?? 'PostgreSQL · PGlite') : 'Открываем базу…'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton label="Дублировать вкладку вместе с данными" onClick={() => void duplicate()} disabled={busy}>
            <Copy size={15} />
          </IconButton>
          <IconButton label="Сбросить базу вкладки" onClick={() => void reset()} disabled={busy}>
            <RotateCcw size={15} />
          </IconButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void runScope('statement')
            }}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Run
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void runScope('script')
            }}
            className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Run all
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {schemaOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <span>Схема</span>
              <span className="font-normal normal-case">{relations.length} объектов</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
              <ErrorBoundary>
                <SchemaTree
                  relations={relations}
                  loading={schemaLoading}
                  onInsertSelect={(name) => {
                    editorRef.current?.insertText(`SELECT * FROM ${quoteIdentifier(name)} LIMIT 100;\n`)
                  }}
                />
              </ErrorBoundary>
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <section className="min-h-0 flex-[3]">
            <ErrorBoundary>
              <SqlEditor
                ref={editorRef}
                value={tab.sql}
                onChange={(sql) => {
                  setSql(tab.id, sql)
                }}
                onRunStatement={() => {
                  void runScope('statement')
                }}
                onRunScript={() => {
                  void runScope('script')
                }}
                error={error}
                dark={dark}
              />
            </ErrorBoundary>
          </section>
          <section className="min-h-0 flex-[2] border-t border-zinc-200 dark:border-zinc-800">
            <ErrorBoundary>
              <ResultPanel results={results} running={running} />
            </ErrorBoundary>
          </section>
        </div>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
        active ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : ''
      }`}
    >
      {children}
    </button>
  )
}

/** Имя в SELECT: простые имена как есть, остальные в двойных кавычках. */
function quoteIdentifier(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`
}
