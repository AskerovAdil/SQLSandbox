import { useSandboxStatus, loadSandbox } from './sandboxSync'

interface SandboxStatusLineProps {
  tabId: string
  sandboxId: string
  onOpenShare: () => void
}

/** Строка статуса общей песочницы в тулбаре: сохранено, только чтение, конфликт или ошибка. */
export function SandboxStatusLine({ tabId, sandboxId, onOpenShare }: SandboxStatusLineProps) {
  const status = useSandboxStatus(sandboxId)
  if (!status) return null

  if (status.saveState === 'readonly') {
    return (
      <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-500">
        Только чтение: изменения здесь не сохраняются.
        <button type="button" onClick={onOpenShare} className="rounded border border-zinc-300 px-2 py-0.5 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Указать токен
        </button>
      </span>
    )
  }
  if (status.saveState === 'conflict') {
    return (
      <span className="flex min-w-0 items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
        Песочницу изменили с другого устройства, сохранение остановлено.
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Загрузить последнюю версию? Несохранённые изменения этой вкладки будут потеряны.')) {
              void loadSandbox(tabId, sandboxId)
            }
          }}
          className="rounded border border-amber-400 px-2 py-0.5 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-950/50"
        >
          Обновить
        </button>
      </span>
    )
  }
  if (status.saveState === 'error') {
    return <span className="min-w-0 truncate text-xs text-red-700 dark:text-red-300">Не сохранено: {status.saveError}</span>
  }
  if (status.saveState === 'saving') {
    return <span className="text-xs text-zinc-500">Сохраняем…</span>
  }
  const time = status.savedAt ? new Date(status.savedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null
  return <span className="min-w-0 truncate text-xs text-zinc-500">Общая песочница{time ? ` · сохранено в ${time}` : ''}</span>
}
