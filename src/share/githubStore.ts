import { base64ToUtf8, decodeSandbox, encodeSandbox, type SharedSandbox, utf8ToBase64 } from './sandboxFile'

/**
 * Хранилище общих песочниц: файлы sandboxes/<guid>.json на ветке sandboxes этого репозитория.
 * Ветка не деплоится (деплой только из main). Читать может любой, писать — участники
 * репозитория с токеном, у которого есть права Contents: read and write.
 */
export const SANDBOX_REPO = { owner: 'AskerovAdil', repo: 'SQLSandbox', branch: 'sandboxes', dir: 'sandboxes' }

const TOKEN_KEY = 'sql-sandbox:github-token'
const API = 'https://api.github.com'

export type ShareErrorKind = 'conflict' | 'auth' | 'rate-limit' | 'network' | 'other'

export class ShareError extends Error {
  constructor(
    readonly kind: ShareErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'ShareError'
  }
}

export interface RemoteSandbox {
  sandbox: SharedSandbox
  /** Версия файла в Git. Передаётся при записи: по нему видно, что файл изменили после чтения. */
  sha: string
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token.trim())
  } catch {
    throw new ShareError('other', 'Браузер не разрешает сохранить токен (приватный режим или заблокированные данные сайта).')
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // токен и так недоступен
  }
}

function filePath(id: string): string {
  return `${SANDBOX_REPO.dir}/${id}.json`
}

function contentsUrl(id: string): string {
  return `${API}/repos/${SANDBOX_REPO.owner}/${SANDBOX_REPO.repo}/contents/${filePath(id)}`
}

function headers(token: string | null): Record<string, string> {
  const result: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) result['Authorization'] = `Bearer ${token}`
  return result
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new ShareError('network', 'Нет связи с GitHub. Проверьте интернет и попробуйте снова.')
  }
}

/** Ошибки API по коду ответа. Тексты — для пользователя. */
function apiError(status: number, action: string): ShareError {
  if (status === 401) return new ShareError('auth', 'Токен GitHub не принят. Укажите действующий токен.')
  if (status === 403 || status === 429) {
    return new ShareError(
      'rate-limit',
      `GitHub ограничил запросы (${action}). Подождите немного или укажите токен — с ним лимит выше.`,
    )
  }
  if (status === 409 || status === 422) {
    return new ShareError('conflict', 'Песочницу изменили с другого устройства. Обновите её, чтобы не потерять чужие правки.')
  }
  return new ShareError('other', `GitHub вернул ошибку ${String(status)} при попытке: ${action}.`)
}

/** Читает песочницу. null — файла ещё нет (новая песочница). */
export async function readSandbox(id: string, token: string | null = getToken()): Promise<RemoteSandbox | null> {
  const url = `${contentsUrl(id)}?ref=${SANDBOX_REPO.branch}`
  const response = await request(url, { headers: headers(token), cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw apiError(response.status, 'чтение песочницы')

  const body = (await response.json()) as { content?: string; sha?: string; size?: number }
  if (typeof body.content !== 'string' || typeof body.sha !== 'string') {
    throw new ShareError('other', 'GitHub вернул файл песочницы в неожиданном виде.')
  }
  return { sandbox: decodeSandbox(base64ToUtf8(body.content)), sha: body.sha }
}

/**
 * Пишет песочницу. Без sha создаётся новый файл; с sha — обновляется текущая версия.
 * Если файл изменили с тех пор, GitHub отвечает 409/422, и это ShareError kind=conflict.
 */
export async function writeSandbox(
  id: string,
  sandbox: SharedSandbox,
  token: string,
  sha?: string,
): Promise<string> {
  const text = encodeSandbox(sandbox)
  const body: Record<string, string> = {
    message: `sandbox ${id}: ${sandbox.updatedAt}`,
    content: utf8ToBase64(text),
    branch: SANDBOX_REPO.branch,
  }
  if (sha) body['sha'] = sha

  const response = await request(contentsUrl(id), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw apiError(response.status, 'сохранение песочницы')

  const result = (await response.json()) as { content?: { sha?: string } }
  if (!result.content?.sha) throw new ShareError('other', 'GitHub не вернул версию сохранённого файла.')
  return result.content.sha
}
