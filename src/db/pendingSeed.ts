/**
 * Скрипт, который нужно выполнить в базе вкладки при первом открытии: данные шаблона
 * или импортированного файла. Выполняется один раз, затем забывается.
 */
const pending = new Map<string, string>()

export function setPendingSeed(tabId: string, script: string): void {
  pending.set(tabId, script)
}

export function takePendingSeed(tabId: string): string | undefined {
  const script = pending.get(tabId)
  pending.delete(tabId)
  return script
}
