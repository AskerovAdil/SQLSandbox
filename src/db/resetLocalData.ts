/** Имя IndexedDB-базы, которую создаёт PGlite для idb://<tabId>. */
export function tabDatabaseName(tabId: string): string {
  return `/pglite/${tabId}`
}

/** Удаляет IndexedDB-базу. Если она ещё открыта, удаление дождётся закрытия соединения. */
export function deleteIndexedDb(name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => {
      resolve()
    }
    request.onerror = () => {
      resolve()
    }
    request.onblocked = () => {
      resolve()
    }
  })
}

/** Удаляет все локальные базы PGlite (IndexedDB с префиксом /pglite). */
export async function resetLocalData(): Promise<void> {
  const databases = await indexedDB.databases()
  const names = databases.map((info) => info.name).filter((name): name is string => name?.startsWith('/pglite') === true)
  await Promise.all(names.map((name) => deleteIndexedDb(name)))
}
