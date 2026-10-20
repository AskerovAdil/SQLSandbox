import { useEffect, useRef, useState } from 'react'
import { deleteIndexedDb, tabDatabaseName } from './db/resetLocalData'
import { setPendingSeed } from './db/pendingSeed'
import { stageCopy } from './db/databaseCopy'
import { useHistoryStore } from './stores/historyStore'
import { resolveDark, useUiStore } from './stores/uiStore'
import { useTabsStore } from './stores/tabsStore'
import { ThemeToggle } from './app/ThemeToggle'
import { TabBar } from './tabs/TabBar'
import { Workspace } from './tabs/Workspace'
import { TEMPLATES } from './templates'
import { splitAtMarker } from './lib/splitAtMarker'
import { EDITOR_MARKER } from './transfer/sqlDump'
import { base64ToBlob, readFileText } from './transfer/files'
import { parseBundle } from './transfer/bundle'

export default function App() {
  const tabs = useTabsStore((state) => state.tabs)
  const activeId = useTabsStore((state) => state.activeId)
  const addTab = useTabsStore((state) => state.addTab)
  const closeTab = useTabsStore((state) => state.closeTab)
  const renameTab = useTabsStore((state) => state.renameTab)
  const setActive = useTabsStore((state) => state.setActive)
  const moveTab = useTabsStore((state) => state.moveTab)
  const removeHistory = useHistoryStore((state) => state.remove)
  const importRef = useRef<HTMLInputElement>(null)

  const theme = useUiStore((state) => state.theme)
  const dark = useDarkMode(theme)

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  if (!activeTab) return null

  const handleClose = (id: string) => {
    const tab = tabs.find((item) => item.id === id)
    if (!tab) return
    if (!window.confirm(`Закрыть вкладку «${tab.name}»? Её база данных будет удалена.`)) return
    closeTab(id)
    removeHistory(id)
    // Если вкладка открыта, её соединение закроется при размонтировании; удаление дождётся этого.
    void deleteIndexedDb(tabDatabaseName(id))
  }

  const handleAddTemplate = (templateId: string | null) => {
    const template = TEMPLATES.find((item) => item.id === templateId)
    if (!template) {
      addTab()
      return
    }
    const id = addTab({ name: template.title, sql: template.queries })
    setPendingSeed(id, template.seed)
  }

  const handleImport = async (file: File) => {
    const text = await readFileText(file)
    const bundle = parseBundle(text)
    if (bundle) {
      for (const tab of bundle) {
        const id = addTab({ name: tab.name, sql: tab.sql })
        if (tab.data) stageCopy(id, base64ToBlob(tab.data))
      }
      return
    }
    // Файл одной вкладки: данные до маркера выполняются, после — код редактора.
    // Файл без маркера целиком попадает в редактор и не выполняется сам.
    const name = file.name.replace(/\.sql$/i, '') || 'Импорт'
    const { before, after } = splitAtMarker(text, EDITOR_MARKER)
    const id = addTab({ name, sql: after ?? text })
    if (after !== null && before.trim() !== '') setPendingSeed(id, before)
  }

  return (
    <div className="flex h-dvh flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <input
        ref={importRef}
        type="file"
        accept=".sql,.json,application/json,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          handleImport(file).catch((error: unknown) => {
            window.alert(`Не удалось импортировать файл: ${error instanceof Error ? error.message : String(error)}`)
          })
        }}
      />
      <TabBar
        tabs={tabs}
        activeId={activeTab.id}
        onSelect={setActive}
        onAddTemplate={handleAddTemplate}
        onImport={() => {
          importRef.current?.click()
        }}
        onClose={handleClose}
        onRename={renameTab}
        onMove={moveTab}
      >
        <ThemeToggle />
      </TabBar>
      <Workspace key={activeTab.id} tab={activeTab} dark={dark} />
      <footer className="border-t border-zinc-200 px-4 py-1 text-xs text-zinc-500 dark:border-zinc-800">
        Данные хранятся только в этом браузере на этом устройстве. Для переноса используйте экспорт и импорт.
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
