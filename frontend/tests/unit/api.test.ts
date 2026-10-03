import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiGet, pollInterval } from '../../src/api/client'

const reply = (status: number, body: unknown, json = true) =>
  vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: json ? () => Promise.resolve(body) : () => Promise.reject(new Error('not json')),
  })

afterEach(() => vi.unstubAllGlobals())

describe('apiGet classification', () => {
  it('treats a 502 without a JSON error body as network (the host is asleep)', async () => {
    vi.stubGlobal('fetch', reply(502, null, false))
    expect((await apiGet('/x')).kind).toBe('network')
  })
  it('keeps a 502 that carries our error body as an error', async () => {
    vi.stubGlobal('fetch', reply(502, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'x' } }))
    expect((await apiGet('/x')).kind).toBe('error')
  })
  it('classifies 202 as computing and 200 as ok', async () => {
    vi.stubGlobal(
      'fetch',
      reply(202, { status: 'computing', progress: { step: 1, steps: 3, label: 'a' } }),
    )
    expect((await apiGet('/x')).kind).toBe('computing')
    vi.stubGlobal('fetch', reply(200, { module: 'identity', data: {} }))
    expect((await apiGet('/x')).kind).toBe('ok')
  })
  it('classifies a rejected fetch as network and sends no credentials', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('failed'))
    vi.stubGlobal('fetch', f)
    expect((await apiGet('/x')).kind).toBe('network')
    expect(f.mock.calls[0][1].credentials).toBe('omit')
    expect(f.mock.calls[0][1].headers).toBeUndefined()
  })
})

describe('poll interval', () => {
  it('follows the schedule and never exceeds 90 requests a minute', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(pollInterval)).toEqual([2, 2, 3, 3, 4, 5, 5, 6])
    for (let k = 1; k <= 8; k++) expect((k * 60) / pollInterval(k)).toBeLessThanOrEqual(90)
  })
})
