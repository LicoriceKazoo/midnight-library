import { describe, expect, it } from 'vitest'
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
      },
      openStore(options) {
        calls.push('store')
        expect(options).toEqual({ name: 'midnight-library-published-stories', consistency: 'strong' })
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

  it('accepts the opaque Blobs metadata that Netlify injects into a Lambda request', async () => {
    const blobs = new MemoryBlobsStore()
    let opened = false
    const handler = createPublishedStoryFunction({
      openStore() { opened = true; return blobs },
      publisherId: owner.sub,
    })
    const blobsContext = Buffer.from(JSON.stringify({
      url: 'https://blob-edge.example.net',
      token: 'request-scoped-test-token',
    })).toString('base64')
    const request = event('POST', '', payload, blobsContext)
    Object.assign(request.headers, {
      'x-nf-deploy-id': 'test-deploy-id',
      'x-nf-site-id': 'test-site-id',
    })

    const response = await call(handler, request, owner)
    expect(response.statusCode).toBe(201)
    expect(opened).toBe(true)
  })

  it('preserves publication, public reading, republishing, and unpublishing behavior', async () => {
    const blobs = new MemoryBlobsStore()
    const handler = createPublishedStoryFunction({ connect() {}, openStore: () => blobs, publisherId: owner.sub })

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
    const handler = createPublishedStoryFunction({ connect() {}, openStore: () => blobs, publisherId: owner.sub })
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
      connect() {},
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
      connect() {},
      openStore() { throw initializationError },
      logError: (...details) => logs.push(details),
      publisherId: owner.sub,
    })

    const response = await call(handler, event('POST', '', payload), owner)
    expect(response.statusCode).toBe(500)
    expect(logs).toEqual([['Published story Blob initialization failed.', { errorName: 'MissingBlobsEnvironmentError' }]])
    expect(JSON.stringify(logs)).not.toContain('internal credential detail')
  })
})
