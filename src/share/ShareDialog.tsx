import type { PGliteWorker } from '@electric-sql/pglite/worker'
import { X } from 'lucide-react'
import { useState } from 'react'
import { clearToken, getToken, saveToken, SANDBOX_REPO } from './githubStore'
import { sandboxLink, shareTab } from './sandboxSync'

interface ShareDialogProps {
  tabId: string
  sandboxId: string | undefined
  db: PGliteWorker
  onClose: () => void
}

/** Диалог общей песочницы: токен GitHub и ссылка. Токен хранится только в этом браузере. */
export function ShareDialog({ tabId, sandboxId, db, onClose }: ShareDialogProps) {
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(() => getToken() !== null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const link = sandboxId ? sandboxLink(sandboxId) : created ? sandboxLink(created) : null

  const onSaveToken = () => {
    try {
      saveToken(token)
      setToken('')
      setHasToken(true)
      setError(null)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const onShare = async () => {
    setError(null)
    try {
      setCreated(await shareTab(tabId, db))
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const onCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError('Не удалось скопировать. Выделите ссылку и скопируйте вручную.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Общая песочница" className="w-full max-w-lg space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Общая песочница</h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>

        {link ? (
          <section className="space-y-2">
            <p className="text-zinc-600 dark:text-zinc-300">
              Любой, кто откроет эту ссылку, увидит текущие таблицы и код. Редактировать могут только участники репозитория с токеном.
            </p>
            <div className="flex gap-2">
              <input readOnly value={link} aria-label="Ссылка на песочницу" className="min-w-0 flex-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800" />
              <button type="button" onClick={() => void onCopy()} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-2">
            <p className="text-zinc-600 dark:text-zinc-300">
              Создаёт GUID, сохраняет текущий код и данные в репозиторий и выдаёт ссылку.
            </p>
            <button type="button" onClick={() => void onShare()} disabled={!hasToken} className="rounded bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
              Создать общую песочницу
            </button>
          </section>
        )}

        <section className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h3 className="font-medium">Токен GitHub</h3>
          <p className="text-xs text-zinc-500">
            Нужен только чтобы сохранять. Создайте fine-grained токен: <b>Only select repositories</b> → {SANDBOX_REPO.owner}/{SANDBOX_REPO.repo},
            права <b>Contents: Read and write</b>. Вам должны выдать доступ на запись в репозиторий. Токен остаётся в этом браузере.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(event) => {
                setToken(event.target.value)
              }}
              placeholder={hasToken ? 'Токен сохранён. Введите новый, чтобы заменить' : 'github_pat_…'}
              aria-label="Токен GitHub"
              autoComplete="off"
              className="min-w-0 flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-zinc-700"
            />
            <button type="button" onClick={onSaveToken} disabled={token.trim() === ''} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Сохранить
            </button>
            {hasToken && (
              <button
                type="button"
                onClick={() => {
                  clearToken()
                  setHasToken(false)
                }}
                className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Удалить
              </button>
            )}
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded bg-red-50 px-2 py-1 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
