import { PGliteWorker } from '@electric-sql/pglite/worker'

export interface OpenOptions {
  /** Дамп данных, из которого создаётся база (дублирование вкладки). */
  loadDataDir?: Blob
}

/** Открывает изолированную базу вкладки (хранилище idb://<tabId>) в отдельном воркере. */
export async function openDatabase(tabId: string, options: OpenOptions = {}): Promise<PGliteWorker> {
  const worker = new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' })
  try {
    return await PGliteWorker.create(worker, { dataDir: `idb://${tabId}`, loadDataDir: options.loadDataDir })
  } catch (error: unknown) {
    worker.terminate()
    throw error
  }
}
