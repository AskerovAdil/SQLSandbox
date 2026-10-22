import { readSandbox, ShareError, writeSandbox } from './githubStore'
import { encodeSandbox, utf8ToBase64 } from './sandboxFile'

const sample = { sql: 'SELECT 1;', data: '', updatedAt: '2026-10-22T10:00:00.000Z' }
const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readSandbox', () => {
  it('returns null when the sandbox file does not exist yet', async () => {
    mockFetch(new Response('{}', { status: 404 }))
    expect(await readSandbox(id, null)).toBeNull()
  })

  it('decodes the file and returns its sha', async () => {
    const content = utf8ToBase64(encodeSandbox(sample))
    const fn = mockFetch(new Response(JSON.stringify({ content, sha: 'abc' }), { status: 200 }))
    const result = await readSandbox(id, null)
    expect(result).toEqual({ sandbox: sample, sha: 'abc' })
    expect(fn.mock.calls[0]?.[0]).toContain(`/contents/sandboxes/${id}.json?ref=sandboxes`)
  })

  it('maps rate limits to a readable error', async () => {
    mockFetch(new Response('{}', { status: 403 }))
    await expect(readSandbox(id, null)).rejects.toMatchObject({ kind: 'rate-limit' })
  })
})

describe('writeSandbox', () => {
  it('sends sha for updates and returns the new sha', async () => {
    const fn = mockFetch(new Response(JSON.stringify({ content: { sha: 'new' } }), { status: 200 }))
    expect(await writeSandbox(id, sample, 'tok', 'old')).toBe('new')
    const init = fn.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(init.body as string)).toMatchObject({ sha: 'old', branch: 'sandboxes' })
  })

  it('reports a conflict when the file changed since it was read', async () => {
    mockFetch(new Response('{}', { status: 409 }))
    const error = await writeSandbox(id, sample, 'tok', 'old').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ShareError)
    expect(error).toMatchObject({ kind: 'conflict' })
  })

  it('reports an invalid token as auth error', async () => {
    mockFetch(new Response('{}', { status: 401 }))
    await expect(writeSandbox(id, sample, 'bad')).rejects.toMatchObject({ kind: 'auth' })
  })
})
