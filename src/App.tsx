import { useEffect, useState } from 'react'
import { deleteIndexedDb, tabDatabaseName } from './db/resetLocalData'
import { resolveDark, useUiStore } from './stores/uiStore'
import { useTabsStore } from './stores/tabsStore'
import { ThemeToggle } from './app/ThemeToggle'
import { TabBar } from './tabs/TabBar'
import { Workspace } from './tabs/Workspace'

export default function App() {
  const tabs = useTabsStore((state) => state.tabs)
  const activeId = useTabsStore((state) => state.activeId)
  const addTab = useTabsStore((state) => state.addTab)
  const closeTab = useTabsStore((state) => state.closeTab)
  const renameTab = useTabsStore((state) => state.renameTab)
  const setActive = useTabsStore((state) => state.setActive)
  const moveTab = useTabsStore((state) => state.moveTab)

  const theme = useUiStore((state) => state.theme)
  const dark = useDarkMode(theme)

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  if (!activeTab) return null

  const handleClose = (id: string) => {
    const tab = tabs.find((item) => item.id === id)
    if (!tab) return
    if (!window.confirm(`Закрыть вкладку «${tab.name}»? Её база данных будет удалена.`)) return
    closeTab(id)
    // Если вкладка открыта, её соединение закроется при размонтировании; удаление дождётся этого.
    void deleteIndexedDb(tabDatabaseName(id))
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <TabBar
        tabs={tabs}
        activeId={activeTab.id}
        onSelect={setActive}
        onAdd={() => {
          addTab()
        }}
        onClose={handleClose}
        onRename={renameTab}
        onMove={moveTab}
      >
        <ThemeToggle />
      </TabBar>
      <Workspace key={activeTab.id} tab={activeTab} dark={dark} />
      <footer className="border-t border-zinc-200 px-4 py-1 text-xs text-zinc-500 dark:border-zinc-800">
        Данные хранятся только в этом браузере на этом устройстве. Перенос между браузерами будет доступен через экспорт и импорт.
      </footer>
    </div>
  )
}

/** Тема: класс dark на <html>. В режиме system следим за системной настройкой. */
function useDarkMode(theme: 'system' | 'light' | 'dark'): boolean {
  const [systemDark, setSystemDark] = useState(() => resolveDark('system'))

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setSystemDark(media.matches)
    }
    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [])

  const dark = theme === 'system' ? systemDark : theme === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  return dark
}
