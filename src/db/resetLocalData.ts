/** Удаляет все локальные базы PGlite (IndexedDB с префиксом /pglite). */
export async function resetLocalData(): Promise<void> {
  const databases = await indexedDB.databases()
  await Promise.all(
    databases
      .map((info) => info.name)
      .filter((name): name is string => name?.startsWith('/pglite') === true)
      .map(
        (name) =>
          new Promise<void>((resolve) => {
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
          }),
      ),
  )
}
