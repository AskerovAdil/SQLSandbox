import { useEffect, useRef, useState } from 'react'
import { setPendingSeed } from './db/pendingSeed'
import { stageCopy } from './db/databaseCopy'
import { useUiStore, resolveDark } from './stores/uiStore'
import { useTabsStore } from './stores/tabsStore'
import { ThemeToggle } from './app/ThemeToggle'
import { ShortcutsDialog } from './app/ShortcutsDialog'
import { closeTabWithConfirm, EXPORT_TAB_EVENT, isEditableTarget } from './app/hotkeys'
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
  const renameTab = useTabsStore((state) => state.renameTab)
  const setActive = useTabsStore((state) => state.setActive)
  const moveTab = useTabsStore((state) => state.moveTab)
  const importRef = useRef<HTMLInputElement>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const theme = useUiStore((state) => state.theme)
  const dark = useDarkMode(theme)

  // Горячие клавиши. Ctrl+T и Ctrl+W браузеры могут перехватить раньше страницы.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const modifier = event.ctrlKey || event.metaKey
      // Shift и Alt не входят в комбинации: Ctrl+Shift+T и Ctrl+Shift+S — чужие сочетания.
      const plain = modifier && !event.altKey && !event.shiftKey
      if (plain && key === 't') {
        event.preventDefault()
        useTabsStore.getState().addTab()
      } else if (plain && key === 'w') {
        event.preventDefault()
        const active = useTabsStore.getState().activeId
        closeTabWithConfirm(active)
      } else if (plain && key === 's') {
        event.preventDefault()
        window.dispatchEvent(new Event(EXPORT_TAB_EVENT))
      } else if (event.key === '?' && !modifier && !isEditableTarget(event.target)) {
        event.preventDefault()
        setShortcutsOpen(true)
      } else if (event.key === 'Escape') {
        setShortcutsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  if (!activeTab) return null

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
    // Файл без маркера целиком попадает в редактор и не выполняется.
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
        onClose={closeTabWithConfirm}
        onRename={renameTab}
        onMove={moveTab}
      >
        <ThemeToggle />
      </TabBar>
      <Workspace key={activeTab.id} tab={activeTab} dark={dark} />
      <footer className="flex items-center gap-3 border-t border-zinc-200 px-4 py-1 text-xs text-zinc-500 dark:border-zinc-800">
        <span className="min-w-0 truncate">
          Данные хранятся только в этом браузере на этом устройстве. Для переноса используйте экспорт и импорт.
        </span>
        <button
          type="button"
          onClick={() => {
            setShortcutsOpen(true)
          }}
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Горячие клавиши (?)
        </button>
      </footer>
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => {
          setShortcutsOpen(false)
        }}
      />
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
