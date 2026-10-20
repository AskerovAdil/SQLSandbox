import { CheckCircle2, Trash2, XCircle } from 'lucide-react'
import { useHistoryStore } from '../stores/historyStore'

interface HistoryListProps {
  tabId: string
  onInsert: (sql: string) => void
}

/** История запросов вкладки: новые сверху. Клик вставляет запрос в редактор. */
export function HistoryList({ tabId, onInsert }: HistoryListProps) {
  const entries = useHistoryStore((state) => state.byTab[tabId] ?? [])
  const clear = useHistoryStore((state) => state.clear)

  if (entries.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-zinc-500">
        <p className="font-medium text-zinc-700 dark:text-zinc-300">История пуста</p>
        <p className="mt-1">Выполненные запросы появятся здесь. Клик по записи вставит её в редактор.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-zinc-500">
        <span>{entries.length} записей</span>
        <button
          type="button"
          onClick={() => {
            clear(tabId)
          }}
          className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Trash2 size={12} aria-hidden="true" />
          Очистить
        </button>
      </div>
      <ul className="space-y-px pb-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              title={entry.message}
              onClick={() => {
                onInsert(entry.sql)
              }}
              className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70"
            >
              {entry.status === 'ok' ? (
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" aria-label="успешно" />
              ) : (
                <XCircle size={13} className="mt-0.5 shrink-0 text-red-600" aria-label="ошибка" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs text-zinc-800 dark:text-zinc-200">{entry.sql}</span>
                <span className="block text-[10px] text-zinc-500">
                  {formatTime(entry.at)} · {entry.durationMs.toFixed(1)} ms · {entry.message}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
