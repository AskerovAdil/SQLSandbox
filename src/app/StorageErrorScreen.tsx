import { useState } from 'react'
import { resetLocalData } from '../db/resetLocalData'

interface StorageErrorScreenProps {
  error: unknown
}

/** Экран вместо белой страницы, если PGlite или IndexedDB не поднялись. */
export function StorageErrorScreen({ error }: StorageErrorScreenProps) {
  const [resetting, setResetting] = useState(false)
  const message = error instanceof Error ? error.message : String(error)

  const handleReset = async () => {
    if (!window.confirm('Удалить все сохранённые базы в этом браузере? Это действие необратимо.')) return
    setResetting(true)
    await resetLocalData()
    window.location.reload()
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Не удалось открыть базу данных</h1>
      <p className="max-w-lg text-sm text-zinc-600 dark:text-zinc-400">
        Браузер не смог инициализировать локальное хранилище (IndexedDB или PGlite). Попробуйте перезагрузить страницу.
        Если ошибка повторяется, сбросьте сохранённые данные.
      </p>
      <p className="max-w-lg font-mono text-xs text-zinc-500">{message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            window.location.reload()
          }}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Перезагрузить
        </button>
        <button
          type="button"
          disabled={resetting}
          onClick={() => {
            void handleReset()
          }}
          className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          Сбросить сохранённые данные
        </button>
      </div>
    </div>
  )
}
