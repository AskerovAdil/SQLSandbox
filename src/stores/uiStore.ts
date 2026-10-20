import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'
export type SessionMode = 'data' | 'diagram'

export const SESSION_WIDTH_MIN = 280
export const SESSION_WIDTH_MAX = 720

interface UiState {
  theme: ThemeMode
  schemaOpen: boolean
  sessionOpen: boolean
  sessionWidth: number
  sessionMode: SessionMode
  setTheme: (theme: ThemeMode) => void
  toggleSchema: () => void
  toggleSession: () => void
  setSessionWidth: (width: number) => void
  setSessionMode: (mode: SessionMode) => void
}

function defaultWidth(): number {
  return typeof window === 'undefined' ? 1280 : window.innerWidth
}

/** Настройки интерфейса; при недоступном localStorage работают в памяти. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      // На узком экране при первом открытии боковые панели свёрнуты, чтобы редактор не сжимался.
      schemaOpen: defaultWidth() >= 1100,
      sessionOpen: defaultWidth() >= 1000,
      sessionWidth: 380,
      sessionMode: 'data',
      setTheme: (theme) => {
        set({ theme })
      },
      toggleSchema: () => {
        set((state) => ({ schemaOpen: !state.schemaOpen }))
      },
      toggleSession: () => {
        set((state) => ({ sessionOpen: !state.sessionOpen }))
      },
      setSessionWidth: (width) => {
        set({ sessionWidth: Math.min(SESSION_WIDTH_MAX, Math.max(SESSION_WIDTH_MIN, Math.round(width))) })
      },
      setSessionMode: (mode) => {
        set({ sessionMode: mode })
      },
    }),
    {
      name: 'sql-sandbox:ui',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        schemaOpen: state.schemaOpen,
        sessionOpen: state.sessionOpen,
        sessionWidth: state.sessionWidth,
        sessionMode: state.sessionMode,
      }),
    },
  ),
)

/** Тема применяется классом dark на <html>; system — берём системную. */
export function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
