import { Monitor, Moon, Sun } from 'lucide-react'
import { type ThemeMode, useUiStore } from '../stores/uiStore'

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'system', label: 'Системная', Icon: Monitor },
  { mode: 'light', label: 'Светлая', Icon: Sun },
  { mode: 'dark', label: 'Тёмная', Icon: Moon },
]

/** Явный выбор темы: системная, светлая или тёмная. Выбор сохраняется. */
export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)

  return (
    <div
      role="group"
      aria-label="Тема оформления"
      className="mb-1 ml-auto flex shrink-0 items-center gap-0.5 self-center rounded-md bg-zinc-200/70 p-0.5 dark:bg-zinc-800"
    >
      {OPTIONS.map(({ mode, label, Icon }) => {
        const active = theme === mode
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            title={`${label} тема`}
            onClick={() => {
              setTheme(mode)
            }}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-600 dark:text-zinc-50'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            <Icon size={13} aria-hidden="true" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
