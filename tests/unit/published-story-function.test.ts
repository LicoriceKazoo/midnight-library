import { describe, expect, it, vi } from 'vitest'
import { connectLambda, getStore } from '@netlify/blobs'
import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions'
import { createPublishedStoryFunction } from '../../netlify/lib/published-story-function.js'
import type { PublishedStory } from '../../src/publishing.js'

const owner = { sub: 'publisher-user-id', email: 'owner@example.com' }
const payload = {
  title: 'The Harbor Light',
  description: 'A public description.',
  chapters: [{ id: 'chapter-public', title: 'Blue Lanterns', contentHtml: '<p><strong>Safe</strong> light.</p>' }],
}

type StoredBlob = {
  data: PublishedStory & { ownerId: string }
  etag: string
}

class MemoryBlobsStore {
  records = new Map<string, StoredBlob>()
  version = 0

  async getWithMetadata(key: string) { return this.records.get(key) ?? null }
  async setJSON(key: string, data: unknown, options: { onlyIfNew: true } | { onlyIfMatch: string }) {
    const existing = this.records.get(key)
    if ('onlyIfNew' in options && existing) return { modified: false }
    if ('onlyIfMatch' in options && existing?.etag !== options.onlyIfMatch) return { modified: false }
    this.records.set(key, { data: structuredClone(data) as StoredBlob['data'], etag: String(++this.version) })
    return { modified: true }
  }
  async delete(key: string) { this.records.delete(key) }
}

function event(method: string, id = '', body?: unknown, blobs = 'opaque-netlify-blobs-context') {
  return {
    rawUrl: `https://example.netlify.app/api/published-stories/${id}`,
    rawQuery: '',
    path: `/.netlify/functions/published-story/${id}`,
    httpMethod: method,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: body === undefined ? null : JSON.stringify(body),
    isBase64Encoded: false,
    ...(blobs ? { blobs } : {}),
  } satisfies HandlerEvent & { blobs?: string }
}

function netlifyBlobsContext(includeUncachedEndpoint = true) {
  return Buffer.from(JSON.stringify({
    primary_region: 'us-east-1',
    token: 'request-scoped-test-token',
    url: 'https://blob-edge.example.net',
    ...(includeUncachedEndpoint ? { url_uncached: 'https://blob-uncached.example.net' } : {}),
  })).toString('base64')
}

function withNetlifyHeaders(request: ReturnType<typeof event>) {
  Object.assign(request.headers, {
    'x-nf-deploy-id': 'test-deploy-id',
    'x-nf-site-id': 'test-site-id',
  })
  return request
}

function context(user?: { sub: string; email?: string }): HandlerContext {
  return { clientContext: user ? { user } : {} } as HandlerContext
}

async function call(handler: Handler, request: HandlerEvent, user?: { sub: string; email?: string }) {
  return await handler(request, context(user)) as HandlerResponse
}

describe('published story Lambda compatibility entry point', () => {
  it('initializes Blobs from each request before opening the strongly consistent site-wide store', async () => {
    const calls: string[] = []
    const blobs = new MemoryBlobsStore()
    const handler = createPublishedStoryFunction({
      connect(input) {
        calls.push('connect')
        expect(input.blobs).toBe('opaque-netlify-blobs-context')
        return { uncachedEdgeURL: 'https://blob-uncached.example.net' }
      },
      openStore(options) {
        calls.push('store')
        expect(options).toEqual({
          name: 'midnight-library-published-stories',
          consistency: 'strong',
          uncachedEdgeURL: 'https://blob-uncached.example.net',
        })
        return blobs
      },
      publisherId: owner.sub,
    })

    expect(calls).toEqual([])
    const created = await call(handler, event('POST', '', payload), owner)
    expect(created.statusCode).toBe(201)
    expect(calls).toEqual(['connect', 'store'])
    expect(JSON.parse(created.body ?? '{}').title).toBe(payload.title)
  })

  it('reproduces the package error when connectLambda discards the uncached endpoint', async () => {
    const request = withNetlifyHeaders(event('POST', '', payload, netlifyBlobsContext()))
    const lambdaEvent = { blobs: request.blobs!, headers: request.headers as Record<string, string> }
    connectLambda(lambdaEvent)
    const fetchMock = vi.fn()
    const store = getStore({ name: 'midnight-library-published-stories', consistency: 'strong', fetch: fetchMock })

    await expect(store.setJSON('publication-id', payload, { onlyIfNew: true })).rejects.toMatchObject({
      name: 'BlobsConsistencyError',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses Netlify-provided uncached metadata for an actual strong conditional write', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 200,
      headers: { etag: 'created-etag' },
    }))
    const handler = createPublishedStoryFunction({
      openStore: (options) => getStore({ ...options, fetch: fetchMock }),
      publisherId: owner.sub,
    })
    const request = withNetlifyHeaders(event('POST', '', payload, netlifyBlobsContext()))

    const response = await call(handler, request, owner)
    expect(response.statusCode).toBe(201)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/blob-uncached\.example\.net\//u)
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('if-none-match')).toBe('*')
  })

  it('preserves publication, public reading, republishing, and unpublishing behavior', async () => {
    const blobs = new MemoryBlobsStore()
    const handler = createPublishedStoryFunction({
      connect: () => ({ uncachedEdgeURL: 'https://blob-uncached.example.net' }),
      openStore: () => blobs,
      publisherId: owner.sub,
    })

    const created = await call(handler, event('POST', '', payload), owner)
    const createdBody = JSON.parse(created.body ?? '{}')
    const id = createdBody.id as string
    expect(created.statusCode).toBe(201)

    const publicRead = await call(handler, event('GET', id))
    expect(publicRead.statusCode).toBe(200)
    expect(JSON.parse(publicRead.body ?? '{}').title).toBe(payload.title)

    const updated = await call(handler, event('PUT', id, { ...payload, title: 'The Harbor Light — Revised' }), owner)
    expect(updated.statusCode).toBe(200)
    expect(JSON.parse(updated.body ?? '{}').title).toContain('Revised')

    expect((await call(handler, event('DELETE', id), owner)).statusCode).toBe(204)
    expect((await call(handler, event('GET', id))).statusCode).toBe(404)
  })

  it('uses only Netlify-verified client context for publisher authorization', async () => {
    const blobs = new MemoryBlobsStore()
    const handler = createPublishedStoryFunction({
      connect: () => ({ uncachedEdgeURL: 'https://blob-uncached.example.net' }),
      openStore: () => blobs,
      publisherId: owner.sub,
    })
    const request = event('POST', '', payload)
    Object.assign(request.headers, { 'x-client-supplied-user-id': owner.sub })

    const response = await call(handler, request)
    expect(response.statusCode).toBe(401)
    expect(blobs.records.size).toBe(0)
  })

  it('returns a safe error when the Blob request context is missing', async () => {
    const logs: unknown[][] = []
    let opened = false
    const handler = createPublishedStoryFunction({
      connect: () => ({ uncachedEdgeURL: 'https://blob-uncached.example.net' }),
      openStore() { opened = true; return new MemoryBlobsStore() },
      logError: (...details) => logs.push(details),
      publisherId: owner.sub,
    })

    const response = await call(handler, event('POST', '', payload, ''), owner)
    expect(response.statusCode).toBe(500)
    expect(response.body).toContain('temporarily unavailable')
    expect(opened).toBe(false)
    expect(logs).toEqual([['Published story Blob initialization failed.', { errorName: 'BlobsRequestContextError' }]])
  })

  it('diagnoses Blob initialization failures without logging sensitive details', async () => {
    const logs: unknown[][] = []
    const initializationError = new Error('internal credential detail that must not be logged')
    initializationError.name = 'MissingBlobsEnvironmentError'
    const handler = createPublishedStoryFunction({
      connect: () => ({ uncachedEdgeURL: 'https://blob-uncached.example.net' }),
      openStore() { throw initializationError },
      logError: (...details) => logs.push(details),
      publisherId: owner.sub,
    })

    const response = await call(handler, event('POST', '', payload), owner)
    expect(response.statusCode).toBe(500)
    expect(logs).toEqual([['Published story Blob initialization failed.', { errorName: 'MissingBlobsEnvironmentError' }]])
    expect(JSON.stringify(logs)).not.toContain('internal credential detail')
  })

  it('fails closed when Netlify omits the uncached endpoint instead of using eventual consistency', async () => {
    const logs: unknown[][] = []
    let opened = false
    const handler = createPublishedStoryFunction({
      openStore() { opened = true; return new MemoryBlobsStore() },
      logError: (...details) => logs.push(details),
      publisherId: owner.sub,
    })
    const request = withNetlifyHeaders(event('POST', '', payload, netlifyBlobsContext(false)))

    const response = await call(handler, request, owner)
    expect(response.statusCode).toBe(500)
    expect(opened).toBe(false)
    expect(logs).toEqual([[
      'Published story Blob initialization failed.',
      { errorName: 'MissingBlobsConsistencyEndpointError' },
    ]])
  })
})
