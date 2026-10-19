import { Monitor, Moon, Sun } from 'lucide-react'
import { type ThemeMode, useUiStore } from '../stores/uiStore'

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemeMode, string> = { system: 'Системная тема', light: 'Светлая тема', dark: 'Тёмная тема' }

/** Переключает тему по кругу: системная → светлая → тёмная. */
export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <button
      type="button"
      aria-label={`${LABEL[theme]}. Переключить`}
      title={`${LABEL[theme]} — нажмите, чтобы сменить`}
      onClick={() => {
        setTheme(NEXT[theme])
      }}
      className="mb-0.5 ml-auto shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <Icon size={16} />
    </button>
  )
}
