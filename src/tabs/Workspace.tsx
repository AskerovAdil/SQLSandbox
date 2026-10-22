import type { PGliteWorker } from '@electric-sql/pglite/worker'
import { Activity, Copy, FileDown, PanelLeft, PanelRight, Package, RotateCcw, Share2 } from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from '../app/ErrorBoundary'
import { StorageErrorScreen } from '../app/StorageErrorScreen'
import { setCompletionTables } from '../editor/monacoSetup'
import { type EditorError, type RunScope, SqlEditor, type SqlEditorHandle } from '../editor/SqlEditor'
import { executeScript, type StatementResult } from '../db/executeScript'
import { locateErrorInStatement } from '../db/errorLocation'
import { RESET_SQL, stageCopy } from '../db/databaseCopy'
import { openDatabase } from '../db/openDatabase'
import { takePendingSeed } from '../db/pendingSeed'
import { useDatabase } from '../db/useDatabase'
import { parsePlanDocument, type PlanDocument } from '../explain/planModel'
import { rowsLabel } from '../lib/plural'
import { ResultPanel } from '../results/ResultPanel'
import { loadSchema } from '../schema/loadSchema'
import { type SchemaRelation, relationKindLabel } from '../schema/buildSchema'
import { HistoryList } from '../schema/HistoryList'
import { SchemaTree } from '../schema/SchemaTree'
import { SessionPanel, type SessionFailure } from '../session/SessionPanel'
import { buildSessionTables, freshRelationNames, type SessionTable, takeSnapshots } from '../session/sessionView'
import type { TableSnapshot } from '../session/snapshot'
import { type HistoryEntry, useHistoryStore } from '../stores/historyStore'
import { SESSION_WIDTH_MAX, SESSION_WIDTH_MIN, useUiStore } from '../stores/uiStore'
import { type Tab, useTabsStore } from '../stores/tabsStore'
import { EXPORT_TAB_EVENT } from '../app/hotkeys'
import { type BundleTab, buildBundle } from '../transfer/bundle'
import { dumpDatabaseSql, buildTabFile } from '../transfer/sqlDump'
import { blobToBase64, downloadFile, safeFileName } from '../transfer/files'
import { loadSandbox, saveSandbox, useSandboxStatus, useSandboxStore } from '../share/sandboxSync'
import { SandboxStatusLine } from '../share/SandboxStatusLine'
import { ShareDialog } from '../share/ShareDialog'

interface WorkspaceProps {
  tab: Tab
  dark: boolean
}

/** Результат чтения схемы и данных после выполнения или сброса. */
interface ChangeResult {
  relations: SchemaRelation[]
  tables: SessionTable[]
  fresh: Set<string>
  hadBefore: boolean
}

/** Состояние схемы и данных на момент, с которым сравниваем следующее изменение. */
interface Captured {
  relations: SchemaRelation[]
  snapshots: Map<string, TableSnapshot>
}

/** Сколько подсвечивать новые объекты и через сколько убрать удалённые таблицы. */
const FRESH_MS = 2500
const DROPPED_MS = 1500
/** Пауза после последнего изменения текста, после которой общая песочница сохраняется. */
const SAVE_DELAY_MS = 1500

type SidebarMode = 'schema' | 'history'

/**
 * Вкладка общей песочницы сначала загружает версию с GitHub и только потом открывает базу.
 * Обычная вкладка сразу показывает рабочую область.
 */
export function Workspace({ tab, dark }: WorkspaceProps) {
  const sandboxId = tab.sandboxId
  const status = useSandboxStatus(sandboxId)

  useEffect(() => {
    if (sandboxId && !useSandboxStore.getState().byId[sandboxId]) void loadSandbox(tab.id, sandboxId)
  }, [sandboxId, tab.id])

  if (sandboxId && status?.loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
        <p className="font-medium">Не удалось загрузить общую песочницу</p>
        <p className="max-w-lg text-zinc-600 dark:text-zinc-400">{status.loadError}</p>
        <button
          type="button"
          onClick={() => {
            void loadSandbox(tab.id, sandboxId)
          }}
          className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Повторить
        </button>
      </div>
    )
  }
  if (sandboxId && (status === undefined || status.loading)) {
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Загружаем общую песочницу…</div>
  }
  return <WorkspaceBody tab={tab} dark={dark} />
}

function WorkspaceBody({ tab, dark }: WorkspaceProps) {
  const database = useDatabase(tab.id)
  const ready: PGliteWorker | null = database.status === 'ready' ? database.db : null

  const schemaOpen = useUiStore((state) => state.schemaOpen)
  const toggleSchema = useUiStore((state) => state.toggleSchema)
  const sessionOpen = useUiStore((state) => state.sessionOpen)
  const toggleSession = useUiStore((state) => state.toggleSession)
  const sessionWidth = useUiStore((state) => state.sessionWidth)
  const setSql = useTabsStore((state) => state.setSql)
  const addTabFrom = useTabsStore((state) => state.addTabFrom)
  const recordHistory = useHistoryStore((state) => state.record)

  const editorRef = useRef<SqlEditorHandle>(null)
  const cancelRef = useRef(false)
  const initRef = useRef<{ db: PGliteWorker; promise: Promise<ChangeResult> } | null>(null)

  const [results, setResults] = useState<StatementResult[]>([])
  const [running, setRunning] = useState(false)
  // Отмена поддерживается только для выполнения скрипта: EXPLAIN и сброс — одна операция.
  const [cancellable, setCancellable] = useState(false)
  const [relations, setRelations] = useState<SchemaRelation[]>([])
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [sessionTables, setSessionTables] = useState<SessionTable[]>([])
  const [freshNames, setFreshNames] = useState<Set<string>>(() => new Set())
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('schema')
  const [shareOpen, setShareOpen] = useState(false)

  // Общая песочница: сохраняем после паузы в наборе текста. Пока конфликт, автосохранение стоит.
  const lastSavedSql = useRef(tab.sql)
  useEffect(() => {
    const sandboxId = tab.sandboxId
    if (!sandboxId || !ready || tab.sql === lastSavedSql.current) return
    const timer = window.setTimeout(() => {
      if (useSandboxStore.getState().byId[sandboxId]?.saveState === 'conflict') return
      lastSavedSql.current = tab.sql
      void saveSandbox(tab.id, sandboxId, ready)
    }, SAVE_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [tab.id, tab.sandboxId, tab.sql, ready])

  // Автодополнение берёт таблицы из схемы этой вкладки; при уходе со вкладки список очищается.
  useEffect(() => {
    setCompletionTables(
      relations.map((relation) => ({
        name: relation.name,
        kindLabel: relationKindLabel(relation.kind),
        columns: relation.columns.map((column) => ({ name: column.name, type: column.type })),
      })),
    )
  }, [relations])

  useEffect(() => () => {
    setCompletionTables([])
  }, [])

  /** Читает схему и данные после изменения. Состояние не трогает: это делает commitChange. */
  const computeChange = useCallback(async (db: PGliteWorker, before: Captured | null): Promise<ChangeResult> => {
    const nextRelations = await loadSchema(db)
    const snapshots = await takeSnapshots(db, nextRelations)
    return {
      relations: nextRelations,
      tables: buildSessionTables({
        before: before ? { relations: before.relations, snapshots: before.snapshots } : null,
        after: { relations: nextRelations, snapshots },
      }),
      fresh: before ? freshRelationNames(before.relations, nextRelations) : new Set<string>(),
      hadBefore: before !== null,
    }
  }, [])

  const commitChange = useCallback((change: ChangeResult) => {
    setRelations(change.relations)
    setSessionTables(change.tables)
    setFreshNames(change.fresh)
    if (change.hadBefore) {
      window.setTimeout(() => {
        setFreshNames(new Set())
      }, FRESH_MS)
      window.setTimeout(() => {
        setSessionTables((current) => current.filter((table) => table.status !== 'dropped'))
      }, DROPPED_MS)
    }
  }, [])

  // Первое открытие: сначала данные шаблона или импорта (один раз), затем схема.
  // Промис общий на одну базу: повторный запуск эффекта в StrictMode не выполнит скрипт дважды.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    if (initRef.current?.db !== ready) {
      const seed = takePendingSeed(tab.id)
      const prepared = seed ? ready.exec(seed).then(() => undefined) : Promise.resolve()
      initRef.current = { db: ready, promise: prepared.then(() => computeChange(ready, null)) }
    }
    initRef.current.promise
      .then((change) => {
        if (!cancelled) commitChange(change)
      })
      .catch((error: unknown) => {
        if (!cancelled) setNotice(`Не удалось загрузить схему или данные шаблона: ${errorText(error)}`)
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ready, tab.id, computeChange, commitChange])

  const runScope = useCallback(
    async (scope: RunScope) => {
      if (!ready || running || !editorRef.current) return
      const request = editorRef.current.getRunRequest(scope)
      if (request.text.trim() === '') return

      // Флаг отмены сбрасывается до любого await: нажатие «Отмена» во время снимков уже учитывается.
      cancelRef.current = false
      setCancellable(true)
      setRunning(true)
      setNotice(null)
      const isCancelled = (): boolean => cancelRef.current
      try {
        const before: Captured = { relations, snapshots: await takeSnapshots(ready, relations) }
        const outcome = await executeScript(ready, request.text, request.baseOffset, isCancelled)
        setResults(outcome)
        if (isCancelled()) setNotice('Выполнение остановлено после текущего запроса')
        recordHistory(tab.id, outcome.map(historyEntry))
        commitChange(await computeChange(ready, before))
        // После выполнения данные могли измениться: сохраняем и их, не только текст.
        if (tab.sandboxId) void saveSandbox(tab.id, tab.sandboxId, ready)
      } catch (error: unknown) {
        const failed: StatementResult = {
          index: 0,
          sql: request.text,
          start: request.baseOffset,
          durationMs: 0,
          kind: 'error',
          message: errorText(error),
          offset: request.baseOffset,
        }
        setResults([failed])
        recordHistory(tab.id, [historyEntry(failed)])
      } finally {
        setRunning(false)
        setCancellable(false)
      }
    },
    [ready, running, relations, tab.id, tab.sandboxId, computeChange, commitChange, recordHistory],
  )

  /**
   * EXPLAIN ANALYZE выполняет запрос на самом деле, поэтому внутри транзакции с откатом:
   * данные DML не меняются, а план и фактическое время остаются.
   */
  const runExplain = async () => {
    if (!ready || running || !editorRef.current) return
    const request = editorRef.current.getRunRequest('statement')
    if (request.text.trim() === '') return

    setRunning(true)
    setNotice(null)
    const startedAt = performance.now()
    try {
      await ready.exec('BEGIN')
      let plan: PlanDocument | null = null
      try {
        const response = await ready.query<{ 'QUERY PLAN': unknown }>(`EXPLAIN (ANALYZE, FORMAT JSON) ${request.text}`)
        plan = parsePlanDocument(response.rows[0]?.['QUERY PLAN'])
      } finally {
        await ready.exec('ROLLBACK')
      }
      if (!plan) throw new Error('Не удалось разобрать план выполнения')
      const planResult: StatementResult = {
        kind: 'plan',
        index: 0,
        sql: request.text,
        start: request.baseOffset,
        durationMs: performance.now() - startedAt,
        plan,
      }
      setResults([planResult])
      recordHistory(tab.id, [historyEntry(planResult)])
    } catch (error: unknown) {
      const message = errorText(error)
      const failed: StatementResult = {
        kind: 'error',
        index: 0,
        sql: request.text,
        start: request.baseOffset,
        durationMs: performance.now() - startedAt,
        message,
        offset: request.baseOffset + locateErrorInStatement(message, request.text),
      }
      setResults([failed])
      recordHistory(tab.id, [historyEntry(failed)])
    } finally {
      setRunning(false)
    }
  }

  const duplicate = async () => {
    if (!ready) return
    setNotice('Копируем вкладку…')
    try {
      const dump = await ready.dumpDataDir('none')
      const newId = addTabFrom(tab.id, tab.sql)
      stageCopy(newId, dump)
    } catch (error: unknown) {
      setNotice(`Не удалось скопировать вкладку: ${errorText(error)}`)
    }
  }

  const reset = async () => {
    if (!ready || running) return
    if (!window.confirm('Удалить все таблицы, представления и данные этой вкладки? Код в редакторе останется.')) return
    setRunning(true)
    try {
      const before: Captured = { relations, snapshots: await takeSnapshots(ready, relations) }
      await ready.exec(RESET_SQL)
      setResults([])
      setNotice('База вкладки очищена')
      commitChange(await computeChange(ready, before))
    } catch (error: unknown) {
      setNotice(`Сброс не удался: ${errorText(error)}`)
    } finally {
      setRunning(false)
    }
  }

  /** Экспорт текущей вкладки: данные и код редактора в один .sql. */
  const exportTab = useCallback(async () => {
    if (!ready) return
    try {
      const current = await loadSchema(ready)
      const dataSql = await dumpDatabaseSql(ready, current)
      downloadFile(`${safeFileName(tab.name)}.sql`, buildTabFile(dataSql, tab.sql))
      setNotice('Вкладка экспортирована')
    } catch (error: unknown) {
      setNotice(`Экспорт не удался: ${errorText(error)}`)
    }
  }, [ready, tab.name, tab.sql])

  /**
   * Экспорт всех вкладок в один .json. Активная база уже открыта, остальные открываются
   * по очереди и сразу закрываются: одновременно открыта только одна база на чтение.
   */
  const exportAll = async () => {
    if (!ready) return
    setNotice('Готовим файл со всеми вкладками…')
    try {
      const items: BundleTab[] = []
      for (const item of useTabsStore.getState().tabs) {
        const isActive = item.id === tab.id
        const db = isActive ? ready : await openDatabase(item.id)
        try {
          const blob = await db.dumpDataDir('none')
          items.push({ name: item.name, sql: item.sql, data: await blobToBase64(blob) })
        } finally {
          if (!isActive) await db.close()
        }
      }
      downloadFile('sql-sandbox-backup.json', buildBundle(items))
      setNotice(`Экспортировано вкладок: ${String(items.length)}`)
    } catch (error: unknown) {
      setNotice(`Экспорт не удался: ${errorText(error)}`)
    }
  }

  // Ctrl+S обрабатывает приложение, но сам файл собирает рабочая область активной вкладки.
  useEffect(() => {
    const onExport = () => {
      void exportTab()
    }
    window.addEventListener(EXPORT_TAB_EVENT, onExport)
    return () => {
      window.removeEventListener(EXPORT_TAB_EVENT, onExport)
    }
  }, [exportTab])

  if (database.status === 'error') return <StorageErrorScreen error={database.error} />

  const failed = results.find((result) => result.kind === 'error')
  const error: EditorError | null =
    failed?.kind === 'error' ? { offset: failed.offset, message: failed.message } : null
  const failure: SessionFailure | null =
    failed?.kind === 'error' && results.length > 1 ? { index: failed.index, message: failed.message } : null
  const busy = !ready || running

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {shareOpen && ready && (
        <ShareDialog tabId={tab.id} sandboxId={tab.sandboxId} db={ready} onClose={() => { setShareOpen(false) }} />
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <IconButton label={schemaOpen ? 'Скрыть схему' : 'Показать схему'} onClick={toggleSchema} active={schemaOpen}>
          <PanelLeft size={16} />
        </IconButton>
        {running ? (
          <RunStatus
            onCancel={
              cancellable
                ? () => {
                    cancelRef.current = true
                  }
                : undefined
            }
          />
        ) : tab.sandboxId ? (
          <SandboxStatusLine
            tabId={tab.id}
            sandboxId={tab.sandboxId}
            onOpenShare={() => {
              setShareOpen(true)
            }}
          />
        ) : (
          <span className="min-w-0 truncate text-xs text-zinc-500" aria-live="polite">
            {ready ? (notice ?? 'PostgreSQL · PGlite') : 'Открываем базу…'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton label="Поделиться песочницей" onClick={() => { setShareOpen(true) }} disabled={!ready}>
            <Share2 size={15} />
          </IconButton>
          <IconButton label="Дублировать вкладку вместе с данными" onClick={() => void duplicate()} disabled={busy}>
            <Copy size={15} />
          </IconButton>
          <IconButton label="Сбросить базу вкладки" onClick={() => void reset()} disabled={busy}>
            <RotateCcw size={15} />
          </IconButton>
          <IconButton label="Экспорт вкладки в .sql" onClick={() => void exportTab()} disabled={busy}>
            <FileDown size={15} />
          </IconButton>
          <IconButton label="Экспорт всех вкладок в .json" onClick={() => void exportAll()} disabled={busy}>
            <Package size={15} />
          </IconButton>
          <IconButton label={sessionOpen ? 'Скрыть таблицы сессии' : 'Показать таблицы сессии'} onClick={toggleSession} active={sessionOpen}>
            <PanelRight size={16} />
          </IconButton>
          <button
            type="button"
            disabled={busy}
            title="EXPLAIN ANALYZE текущего statement. Запрос выполняется в транзакции и откатывается."
            onClick={() => {
              void runExplain()
            }}
            className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Activity size={14} aria-hidden="true" />
            Explain
          </button>
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
            <div className="flex items-center gap-1 px-2 py-1.5 text-xs">
              <SidebarTabButton active={sidebarMode === 'schema'} onClick={() => { setSidebarMode('schema') }}>
                Схема
              </SidebarTabButton>
              <SidebarTabButton active={sidebarMode === 'history'} onClick={() => { setSidebarMode('history') }}>
                История
              </SidebarTabButton>
              <span className="ml-auto pr-1 text-zinc-500">{sidebarMode === 'schema' ? `${String(relations.length)} объектов` : ''}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
              <ErrorBoundary>
                {sidebarMode === 'schema' ? (
                  <SchemaTree
                    relations={relations}
                    loading={schemaLoading}
                    onInsertSelect={(name) => {
                      editorRef.current?.insertText(`SELECT * FROM ${quoteIdentifier(name)} LIMIT 100;\n`)
                    }}
                  />
                ) : (
                  <HistoryList
                    tabId={tab.id}
                    onInsert={(sql) => {
                      editorRef.current?.insertText(`${sql};\n`)
                    }}
                  />
                )}
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

        {sessionOpen && (
          <>
            <SplitHandle />
            <aside style={{ width: sessionWidth }} className="flex shrink-0 flex-col bg-white dark:bg-zinc-950">
              <SessionPanel
                tabId={tab.id}
                tables={sessionTables}
                relations={relations}
                freshNames={freshNames}
                failure={failure}
              />
            </aside>
          </>
        )}
      </div>
    </div>
  )
}

/** Строка истории по результату statement. */
function historyEntry(result: StatementResult): Omit<HistoryEntry, 'id'> {
  const message =
    result.kind === 'rows'
      ? rowsLabel(result.rows.length)
      : result.kind === 'plan'
        ? 'EXPLAIN ANALYZE'
        : result.message
  return {
    sql: result.sql,
    status: result.kind === 'error' ? 'error' : 'ok',
    message,
    durationMs: result.durationMs,
    at: Date.now(),
  }
}

function SidebarTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-2 py-0.5 font-medium ${
        active ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

/** Перетаскивание границы между редактором и панелью «Таблицы сессии». */
function SplitHandle() {
  const setWidth = useUiStore((state) => state.setSessionWidth)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: event.clientX, startWidth: useUiStore.getState().sessionWidth }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setWidth(drag.startWidth - (event.clientX - drag.startX))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Ширина панели таблиц сессии"
      aria-valuemin={SESSION_WIDTH_MIN}
      aria-valuemax={SESSION_WIDTH_MAX}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="w-1 shrink-0 cursor-col-resize bg-zinc-200 hover:bg-blue-500/60 dark:bg-zinc-800"
    />
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

/** Индикатор выполнения: сколько секунд идёт запрос и кнопка остановки. */
function RunStatus({ onCancel }: { onCancel?: () => void }) {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 250)
    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300" role="status">
      <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-500" aria-hidden="true" />
      <span className="tabular-nums">Выполняется… {((now - startedAt) / 1000).toFixed(1)} с</span>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-red-300 px-2 py-0.5 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
        >
          Отмена
        </button>
      )}
    </div>
  )
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Имя в SELECT: простые имена как есть, остальные в двойных кавычках. */
function quoteIdentifier(name: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`
}
