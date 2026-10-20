import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface HistoryEntry {
  id: string
  sql: string
  status: 'ok' | 'error'
  message: string
  durationMs: number
  /** Время выполнения, миллисекунды Unix. */
  at: number
}

/** Сколько записей храним на вкладку: старые вытесняются. */
export const HISTORY_LIMIT = 200

interface HistoryState {
  byTab: Record<string, HistoryEntry[]>
  record: (tabId: string, entries: Omit<HistoryEntry, 'id'>[]) => void
  clear: (tabId: string) => void
  remove: (tabId: string) => void
}

/** История запросов по вкладкам. Сохраняется между перезапусками. */
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      byTab: {},
      record: (tabId, entries) => {
        if (entries.length === 0) return
        set((state) => {
          const created = entries.map((entry) => ({ ...entry, id: crypto.randomUUID() }))
          const next = [...created.reverse(), ...(state.byTab[tabId] ?? [])].slice(0, HISTORY_LIMIT)
          return { byTab: { ...state.byTab, [tabId]: next } }
        })
      },
      clear: (tabId) => {
        set((state) => ({ byTab: { ...state.byTab, [tabId]: [] } }))
      },
      remove: (tabId) => {
        set((state) => {
          const rest = Object.fromEntries(Object.entries(state.byTab).filter(([key]) => key !== tabId))
          return { byTab: rest }
        })
      },
    }),
    {
      name: 'sql-sandbox:history',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
