import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface Tab {
  id: string
  name: string
  sql: string
}

interface TabsState {
  tabs: Tab[]
  activeId: string
  /** Создаёт вкладку (пустую или с именем и кодом) и делает её активной. Возвращает её id. */
  addTab: (options?: { name?: string; sql?: string }) => string
  /** Копия кода; данные копирует рабочая область через stageCopy. */
  addTabFrom: (sourceId: string, sql: string) => string
  closeTab: (id: string) => void
  renameTab: (id: string, name: string) => void
  setActive: (id: string) => void
  setSql: (id: string, sql: string) => void
  moveTab: (fromIndex: number, toIndex: number) => void
}

export const STATE_VERSION = 1
export const STATE_KEY = 'sql-sandbox:state'

export const INITIAL_SQL = `-- Ctrl+Enter — выполнить statement под курсором, Ctrl+Shift+Enter — весь скрипт
CREATE TABLE demo (id int PRIMARY KEY, name text, score numeric);

INSERT INTO demo VALUES (1, 'Анна', 9.5), (2, 'Борис', NULL), (3, '', 7);

SELECT id, name, score FROM demo ORDER BY id;
`

export function createTab(name: string, sql = ''): Tab {
  return { id: crypto.randomUUID(), name, sql }
}

function nextTabName(tabs: Tab[]): string {
  const taken = new Set(tabs.map((tab) => tab.name))
  let index = tabs.length + 1
  while (taken.has(`Песочница ${String(index)}`)) index++
  return `Песочница ${String(index)}`
}

/** localStorage может быть недоступен (приватный режим, заблокированные данные сайта). */
const safeLocalStorage: Storage = {
  get length() {
    try {
      return localStorage.length
    } catch {
      return 0
    }
  },
  clear() {
    try {
      localStorage.clear()
    } catch {
      // данные недоступны — ничего не делаем
    }
  },
  getItem(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  key(index) {
    try {
      return localStorage.key(index)
    } catch {
      return null
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      // см. выше
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // см. выше
    }
  },
}

const initialTab = createTab('Песочница 1', INITIAL_SQL)

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [initialTab],
      activeId: initialTab.id,

      addTab: (options) => {
        const tab = createTab(options?.name?.trim() || nextTabName(get().tabs), options?.sql ?? '')
        set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }))
        return tab.id
      },

      addTabFrom: (sourceId, sql) => {
        const source = get().tabs.find((tab) => tab.id === sourceId)
        const tab = createTab(`${source?.name ?? 'Песочница'} (копия)`, sql)
        set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }))
        return tab.id
      },

      closeTab: (id) => {
        set((state) => {
          if (state.tabs.length <= 1) return state
          const index = state.tabs.findIndex((tab) => tab.id === id)
          const tabs = state.tabs.filter((tab) => tab.id !== id)
          if (state.activeId !== id) return { tabs }
          const neighbour = tabs[Math.min(index, tabs.length - 1)]
          return { tabs, activeId: neighbour?.id ?? state.activeId }
        })
      },

      renameTab: (id, name) => {
        const trimmed = name.trim()
        if (trimmed === '') return
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, name: trimmed } : tab)),
        }))
      },

      setActive: (id) => {
        set({ activeId: id })
      },

      setSql: (id, sql) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, sql } : tab)),
        }))
      },

      moveTab: (fromIndex, toIndex) => {
        set((state) => {
          if (fromIndex === toIndex) return state
          const tabs = [...state.tabs]
          const [moved] = tabs.splice(fromIndex, 1)
          if (!moved) return state
          tabs.splice(toIndex, 0, moved)
          return { tabs }
        })
      },
    }),
    {
      name: STATE_KEY,
      version: STATE_VERSION,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ tabs: state.tabs, activeId: state.activeId }),
      // Несовместимая версия или повреждённые данные: начинаем с одной вкладки, а не падаем.
      migrate: (persisted, version) => {
        if (version !== STATE_VERSION) return fallbackState()
        return sanitize(persisted) ?? fallbackState()
      },
      merge: (persisted, current) => ({ ...current, ...(sanitize(persisted) ?? {}) }),
    },
  ),
)

function fallbackState(): Pick<TabsState, 'tabs' | 'activeId'> {
  const tab = createTab('Песочница 1', INITIAL_SQL)
  return { tabs: [tab], activeId: tab.id }
}

/** Проверяет форму сохранённого состояния. Некорректное состояние возвращает null. */
export function sanitize(value: unknown): Pick<TabsState, 'tabs' | 'activeId'> | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as { tabs?: unknown; activeId?: unknown }
  if (!Array.isArray(candidate.tabs) || typeof candidate.activeId !== 'string') return null

  const tabs: Tab[] = []
  for (const item of candidate.tabs as unknown[]) {
    if (typeof item !== 'object' || item === null) return null
    const tab = item as Partial<Tab>
    if (typeof tab.id !== 'string' || typeof tab.name !== 'string' || typeof tab.sql !== 'string') return null
    tabs.push({ id: tab.id, name: tab.name, sql: tab.sql })
  }
  if (tabs.length === 0) return null

  const activeId = tabs.some((tab) => tab.id === candidate.activeId) ? candidate.activeId : (tabs[0]?.id ?? '')
  return { tabs, activeId }
}
