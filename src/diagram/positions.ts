import type { Point } from './layout'

/** Позиции узлов, которые пользователь передвинул вручную. Хранятся отдельно для каждой вкладки. */
const STORAGE_KEY = 'sql-sandbox:diagram'
const VERSION = 1

interface Envelope {
  version: number
  tabs: Record<string, Record<string, Point>>
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false
  const point = value as Partial<Point>
  return typeof point.x === 'number' && typeof point.y === 'number'
}

export function loadPositions(tabId: string): Record<string, Point> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const envelope = JSON.parse(raw) as Partial<Envelope>
    const tabs: unknown = envelope.tabs
    if (envelope.version !== VERSION || typeof tabs !== 'object' || tabs === null) return {}
    const stored: Record<string, unknown> = (tabs as Record<string, Record<string, unknown> | undefined>)[tabId] ?? {}
    return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, Point] => isPoint(entry[1])))
  } catch {
    // Повреждённые данные или недоступный localStorage: раскладка строится заново.
    return {}
  }
}

export function savePositions(tabId: string, positions: Record<string, Point>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const current: unknown = raw ? JSON.parse(raw) : {}
    const stored = (current as { tabs?: unknown } | null)?.tabs
    const tabs: Record<string, Record<string, Point>> =
      typeof stored === 'object' && stored !== null ? (stored as Record<string, Record<string, Point>>) : {}
    const envelope: Envelope = { version: VERSION, tabs: { ...tabs, [tabId]: positions } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    // Позиции не критичны: без сохранения диаграмма просто перестроится при открытии.
  }
}
