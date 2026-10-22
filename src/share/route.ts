const SANDBOX_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Возвращает GUID песочницы из пути вида <base>/<guid>, или null, если путь не про песочницу.
 * base — BASE_URL приложения (например, "/SQLSandbox/").
 */
export function parseSandboxId(pathname: string, base: string): string | null {
  if (!pathname.startsWith(base)) return null
  const rest = pathname.slice(base.length).replace(/\/+$/, '')
  return SANDBOX_ID.test(rest) ? rest.toLowerCase() : null
}
