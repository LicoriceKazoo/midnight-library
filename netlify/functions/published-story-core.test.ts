import { describe, expect, it } from 'vitest'
import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions'
import { createPublishedStoryHandler, type PublishedStoryStore } from './published-story-core.js'

const publicationId = '123e4567-e89b-42d3-a456-426614174000'
const owner = { sub: 'publisher-user-id', email: 'owner@example.com' }
const payload = {
  title: 'The Harbor Light',
  description: 'A public description.',
  notes: [{ text: 'private' }],
  audio: [{ fileName: 'private.mp3' }],
  chapters: [
    {
      id: 'chapter-public',
      title: 'Blue Lanterns',
      contentHtml: '<p data-indent="2"><strong>Safe</strong><script>unsafe()</script><img src=x onerror=unsafe()><span style="color: #e4c57d"> light</span><span style="color: expression(unsafe())"> blocked</span></p>',
    },
  ],
}

class MemoryStore implements PublishedStoryStore {
  records = new Map<string, { record: Parameters<PublishedStoryStore['create']>[1]; etag: string }>()
  version = 0

  async get(id: string) { return this.records.get(id) ?? null }
  async create(id: string, record: Parameters<PublishedStoryStore['create']>[1]) {
    if (this.records.has(id)) return false
    this.records.set(id, { record: structuredClone(record), etag: String(++this.version) })
    return true
  }
  async update(id: string, record: Parameters<PublishedStoryStore['update']>[1], etag: string) {
    if (this.records.get(id)?.etag !== etag) return false
    this.records.set(id, { record: structuredClone(record), etag: String(++this.version) })
    return true
  }
  async delete(id: string) { this.records.delete(id) }
}

function event(method: string, id = '', body?: unknown): HandlerEvent {
  return {
    rawUrl: '', rawQuery: '', path: `/.netlify/functions/published-story/${id}`,
    httpMethod: method, headers: {}, multiValueHeaders: {}, queryStringParameters: null,
    multiValueQueryStringParameters: null, body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false,
  }
}

function context(user?: { sub: string; email?: string }): HandlerContext {
  return { clientContext: user ? { user } : {} } as HandlerContext
}

async function call(handler: Handler, request: HandlerEvent, user?: { sub: string; email?: string }) {
  return await handler(request, context(user)) as HandlerResponse
}

describe('published story function', () => {
  it('requires the configured owner identity for every mutation', async () => {
    const handler = createPublishedStoryHandler({ store: new MemoryStore(), publisherId: owner.sub, generateId: () => publicationId })
    expect((await call(handler, event('POST', '', payload))).statusCode).toBe(401)
    expect((await call(handler, event('POST', '', payload), { sub: 'someone-else' })).statusCode).toBe(403)
    expect((await call(createPublishedStoryHandler({ store: new MemoryStore(), publisherId: '' }), event('POST', '', payload), owner)).statusCode).toBe(503)
  })

  it('publishes only selected public fields and serves them without authentication', async () => {
    const store = new MemoryStore()
    const handler = createPublishedStoryHandler({ store, publisherId: owner.sub, generateId: () => publicationId, now: () => new Date('2026-10-30T12:00:00Z') })
    const created = await call(handler, event('POST', '', payload), owner)
    expect(created.statusCode).toBe(201)
    const createdBody = JSON.parse(created.body ?? '{}')
    expect(createdBody.id).toBe(publicationId)
    expect(createdBody.notes).toBeUndefined()
    expect(createdBody.audio).toBeUndefined()
    expect(createdBody.ownerId).toBeUndefined()
    expect(createdBody.chapters[0].contentHtml).toContain('<strong>Safe</strong>')
    expect(createdBody.chapters[0].contentHtml).toContain('data-indent="2"')
    expect(createdBody.chapters[0].contentHtml).not.toMatch(/script|onerror|<img|expression/iu)

    const publicRead = await call(handler, event('GET', publicationId))
    expect(publicRead.statusCode).toBe(200)
    expect(publicRead.headers?.['Cache-Control']).toContain('no-store')
    expect(publicRead.headers?.['X-Robots-Tag']).toContain('noindex')
    expect(JSON.parse(publicRead.body ?? '{}').title).toBe(payload.title)
    expect((await call(handler, event('GET'))).statusCode).toBe(404)
  })

  it('republishes, persists across handler instances, and unpublishes immediately', async () => {
    const store = new MemoryStore()
    const createHandler = createPublishedStoryHandler({ store, publisherId: owner.sub, generateId: () => publicationId, now: () => new Date('2026-10-30T12:00:00Z') })
    const created = JSON.parse((await call(createHandler, event('POST', '', payload), owner)).body ?? '{}')

    const afterDeployHandler = createPublishedStoryHandler({ store, publisherId: owner.sub, now: () => new Date('2026-10-30T13:00:00Z') })
    const updatedPayload = { ...payload, title: 'The Harbor Light — Revised' }
    const updated = await call(afterDeployHandler, event('PUT', publicationId, updatedPayload), owner)
    const updatedBody = JSON.parse(updated.body ?? '{}')
    expect(updated.statusCode).toBe(200)
    expect(updatedBody.title).toContain('Revised')
    expect(updatedBody.publishedAt).toBe(created.publishedAt)
    expect(updatedBody.updatedAt).not.toBe(created.updatedAt)

    expect((await call(afterDeployHandler, event('DELETE', publicationId), owner)).statusCode).toBe(204)
    expect((await call(afterDeployHandler, event('GET', publicationId))).statusCode).toBe(404)
  })

  it('returns a safe service error when storage is unavailable', async () => {
    const store = new MemoryStore()
    store.get = async () => { throw new Error('private storage detail') }
    const response = await call(createPublishedStoryHandler({ store, publisherId: owner.sub }), event('GET', publicationId))
    expect(response.statusCode).toBe(500)
    expect(response.body).not.toContain('private storage detail')
  })

  it('throttles requests with a retry interval', async () => {
    const handler = createPublishedStoryHandler({
      store: new MemoryStore(),
      publisherId: owner.sub,
      rateLimit: () => ({ allowed: false, retryAfter: 7 }),
    })
    const response = await call(handler, event('GET', publicationId))
    expect(response.statusCode).toBe(429)
    expect(response.headers?.['Retry-After']).toBe('7')
  })
})
