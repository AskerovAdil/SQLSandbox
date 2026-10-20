import { deleteIndexedDb, tabDatabaseName } from '../db/resetLocalData'
import { useHistoryStore } from '../stores/historyStore'
import { useTabsStore } from '../stores/tabsStore'

/** Событие для рабочей области: экспорт текущей вкладки в .sql (Ctrl+S). */
export const EXPORT_TAB_EVENT = 'sql-sandbox:export-tab'

export interface ShortcutInfo {
  keys: string
  action: string
}

export const SHORTCUTS: ShortcutInfo[] = [
  { keys: 'Ctrl+Enter', action: 'Выполнить выделение или statement под курсором' },
  { keys: 'Ctrl+Shift+Enter', action: 'Выполнить весь скрипт' },
  { keys: 'Ctrl+/', action: 'Закомментировать строку или блок' },
  { keys: 'Ctrl+T', action: 'Новая пустая вкладка (в некоторых браузерах зарезервировано самим браузером)' },
  { keys: 'Ctrl+W', action: 'Закрыть текущую вкладку (в некоторых браузерах зарезервировано самим браузером)' },
  { keys: 'Ctrl+S', action: 'Экспорт текущей вкладки в .sql' },
  { keys: '?', action: 'Показать эту справку' },
  { keys: 'Esc', action: 'Закрыть справку' },
]

/** Клавиши, набранные в поле ввода или в редакторе, не должны срабатывать как команды. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

/** Закрывает вкладку после подтверждения и удаляет её базу и историю. */
export function closeTabWithConfirm(id: string): void {
  const state = useTabsStore.getState()
  const tab = state.tabs.find((item) => item.id === id)
  if (!tab || state.tabs.length <= 1) return
  if (!window.confirm(`Закрыть вкладку «${tab.name}»? Её база данных будет удалена.`)) return
  state.closeTab(id)
  useHistoryStore.getState().remove(id)
  // Если вкладка открыта, её соединение закроется при размонтировании; удаление дождётся этого.
  void deleteIndexedDb(tabDatabaseName(id))
}
