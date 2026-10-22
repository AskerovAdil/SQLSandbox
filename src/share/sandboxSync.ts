import type { PGliteWorker } from '@electric-sql/pglite/worker'
import { deleteIndexedDb, tabDatabaseName } from '../db/resetLocalData'
import { stageCopy } from '../db/databaseCopy'
import { blobToBase64, base64ToBlob } from '../transfer/files'
import { useTabsStore } from '../stores/tabsStore'
import { create } from 'zustand'
import { getToken, readSandbox, ShareError, writeSandbox } from './githubStore'

/** Состояние общей песочницы в памяти страницы. После перезагрузки загружается заново. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'readonly' | 'conflict' | 'error'

export interface SandboxStatus {
  loading: boolean
  loadError: string | null
  /** Версия файла в Git, по которой мы последний раз читали или писали. */
  sha: string | null
  saveState: SaveState
  saveError: string | null
  savedAt: number | null
}

interface SandboxStore {
  byId: Record<string, SandboxStatus>
  patch: (sandboxId: string, change: Partial<SandboxStatus>) => void
}

const EMPTY: SandboxStatus = {
  loading: false,
  loadError: null,
  sha: null,
  saveState: 'idle',
  saveError: null,
  savedAt: null,
}

export const useSandboxStore = create<SandboxStore>()((set) => ({
  byId: {},
  patch: (sandboxId, change) => {
    set((state) => ({
      byId: { ...state.byId, [sandboxId]: { ...(state.byId[sandboxId] ?? EMPTY), ...change } },
    }))
  },
}))

export function useSandboxStatus(sandboxId: string | undefined): SandboxStatus | undefined {
  return useSandboxStore((state) => (sandboxId ? state.byId[sandboxId] : undefined))
}

/** Сообщение для пользователя из любой ошибки. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Загружает песочницу с GitHub в локальную базу вкладки. Локальная база — кэш: перед загрузкой
 * она заменяется серверной версией. Несохранённые изменения этой вкладки при этом теряются.
 */
export async function loadSandbox(tabId: string, sandboxId: string): Promise<void> {
  const { patch, byId } = useSandboxStore.getState()
  if (byId[sandboxId]?.loading) return
  patch(sandboxId, { loading: true, loadError: null })
  try {
    const remote = await readSandbox(sandboxId)
    const tab = useTabsStore.getState().tabs.find((item) => item.id === tabId)
    await deleteIndexedDb(tabDatabaseName(tabId))
    if (remote?.sandbox.data) stageCopy(tabId, base64ToBlob(remote.sandbox.data))
    useTabsStore.getState().setSql(tabId, remote?.sandbox.sql ?? tab?.sql ?? '')
    patch(sandboxId, {
      loading: false,
      sha: remote?.sha ?? null,
      saveState: getToken() ? 'idle' : 'readonly',
      saveError: null,
    })
  } catch (error: unknown) {
    patch(sandboxId, { loading: false, loadError: messageOf(error) })
  }
}

// Одна запись на песочницу за раз: пока идёт запись, новые запросы ставятся в очередь.
const writing = new Set<string>()
const queued = new Set<string>()

/** Сохраняет текущий код и дамп базы в общую песочницу. Без токена — только статус «только чтение». */
export async function saveSandbox(tabId: string, sandboxId: string, db: PGliteWorker): Promise<void> {
  const { patch, byId } = useSandboxStore.getState()
  const token = getToken()
  if (!token) {
    patch(sandboxId, { saveState: 'readonly' })
    return
  }
  if (writing.has(sandboxId)) {
    queued.add(sandboxId)
    return
  }
  writing.add(sandboxId)
  patch(sandboxId, { saveState: 'saving', saveError: null })
  try {
    const sql = useTabsStore.getState().tabs.find((tab) => tab.id === tabId)?.sql ?? ''
    const data = await blobToBase64(await db.dumpDataDir('none'))
    const sha = await writeSandbox(
      sandboxId,
      { sql, data, updatedAt: new Date().toISOString() },
      token,
      byId[sandboxId]?.sha ?? undefined,
    )
    patch(sandboxId, { sha, saveState: 'saved', savedAt: Date.now() })
  } catch (error: unknown) {
    const conflict = error instanceof ShareError && error.kind === 'conflict'
    patch(sandboxId, { saveState: conflict ? 'conflict' : 'error', saveError: messageOf(error) })
  } finally {
    writing.delete(sandboxId)
    if (queued.delete(sandboxId)) void saveSandbox(tabId, sandboxId, db)
  }
}

/**
 * Делает локальную вкладку общей: создаёт GUID, пишет первую версию в репозиторий и
 * привязывает вкладку к этому GUID. Возвращает GUID.
 */
export async function shareTab(tabId: string, db: PGliteWorker): Promise<string> {
  const token = getToken()
  if (!token) throw new ShareError('auth', 'Чтобы поделиться песочницей, укажите токен GitHub.')
  const sandboxId = crypto.randomUUID()
  const sql = useTabsStore.getState().tabs.find((tab) => tab.id === tabId)?.sql ?? ''
  const data = await blobToBase64(await db.dumpDataDir('none'))
  const sha = await writeSandbox(sandboxId, { sql, data, updatedAt: new Date().toISOString() }, token)
  useTabsStore.getState().setSandboxId(tabId, sandboxId)
  useSandboxStore.getState().patch(sandboxId, { sha, saveState: 'saved', savedAt: Date.now() })
  return sandboxId
}

/** Ссылка на песочницу: <origin><base><guid>. */
export function sandboxLink(sandboxId: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${sandboxId}`
}
