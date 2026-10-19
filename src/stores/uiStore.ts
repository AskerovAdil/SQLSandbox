import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'

interface UiState {
  theme: ThemeMode
  schemaOpen: boolean
  setTheme: (theme: ThemeMode) => void
  toggleSchema: () => void
}

/** Настройки интерфейса; при недоступном localStorage работают в памяти. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      schemaOpen: true,
      setTheme: (theme) => {
        set({ theme })
      },
      toggleSchema: () => {
        set((state) => ({ schemaOpen: !state.schemaOpen }))
      },
    }),
    {
      name: 'sql-sandbox:ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, schemaOpen: state.schemaOpen }),
    },
  ),
)

/** Тема применяется классом dark на <html>; system — берём системную. */
export function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
