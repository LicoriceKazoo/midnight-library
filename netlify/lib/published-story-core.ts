import { randomUUID } from 'node:crypto'
import filterXSS from 'xss'
import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions'
import { publishedStoryVersion, type PublishedStory, type PublishedStoryPayload } from '../../src/publishing.js'

const maxBodyBytes = 600_000
const maxChapters = 30
const maxContentBytes = 500_000
const publicationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

type StoredStory = PublishedStory & { ownerId: string }

export type PublishedStoryStore = {
  get: (id: string) => Promise<{ record: StoredStory; etag: string } | null>
  create: (id: string, record: StoredStory) => Promise<boolean>
  update: (id: string, record: StoredStory, etag: string) => Promise<boolean>
  delete: (id: string) => Promise<void>
}

type RateLimiter = (key: string, limit: number, windowMs: number) => { allowed: boolean; retryAfter: number }

function json(statusCode: number, body: unknown, extraHeaders: Record<string, string> = {}): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

function publicStory(record: StoredStory): PublishedStory {
  const { ownerId: _ownerId, ...story } = record
  return story
}

function publicationId(event: HandlerEvent) {
  const id = event.path.split('/').filter(Boolean).at(-1) ?? ''
  return publicationIdPattern.test(id) ? id : null
}

function userFrom(context: HandlerContext) {
  const user = context.clientContext?.user
  return user && typeof user.sub === 'string' ? user as { sub: string; email?: string } : null
}

function cleanText(value: unknown, maxLength: number, label: string, allowBlank = false) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`)
  const text = value.trim()
  if (!allowBlank && !text) throw new Error(`${label} cannot be blank.`)
  if (text.length > maxLength) throw new Error(`${label} is too long.`)
  return text
}

export function sanitizePublishedHtml(value: unknown) {
  if (typeof value !== 'string') throw new Error('Chapter content must be HTML text.')
  if (Buffer.byteLength(value, 'utf8') > 250_000) throw new Error('A chapter is too large to publish.')
  return filterXSS(value, {
    whiteList: {
      br: [], strong: [], b: [], em: [], i: [], h1: [], h2: [], h3: [], h4: [],
      blockquote: [], ul: [], ol: [], li: [], pre: [], code: [], hr: [],
      p: ['data-indent', 'data-first-line-indent'],
      span: ['style'],
    },
    onTagAttr(tag, name, attributeValue) {
      if (tag === 'p' && name === 'data-indent' && /^[1-4]$/u.test(attributeValue)) return `data-indent="${attributeValue}"`
      if (tag === 'p' && name === 'data-first-line-indent' && attributeValue === 'true') return 'data-first-line-indent="true"'
      if (tag === 'span' && name === 'style') {
        const color = attributeValue.match(/^\s*color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([0-9,.\s%]+\))\s*;?\s*$/iu)?.[1]
        return color ? `style="color: ${color}"` : ''
      }
      return ''
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template'],
  })
}

export function validatePublishedStoryPayload(value: unknown): PublishedStoryPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Published story data is invalid.')
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.chapters) || input.chapters.length < 1) throw new Error('Select at least one chapter to publish.')
  if (input.chapters.length > maxChapters) throw new Error(`A publication can contain at most ${maxChapters} chapters.`)
  const chapterIds = new Set<string>()
  let contentBytes = 0
  const chapters = input.chapters.map((chapter, index) => {
    if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) throw new Error(`Chapter ${index + 1} is invalid.`)
    const item = chapter as Record<string, unknown>
    const id = cleanText(item.id, 100, `Chapter ${index + 1} ID`)
    if (chapterIds.has(id)) throw new Error('Published chapters must be unique.')
    chapterIds.add(id)
    const contentHtml = sanitizePublishedHtml(item.contentHtml)
    contentBytes += Buffer.byteLength(contentHtml, 'utf8')
    return { id, title: cleanText(item.title, 120, `Chapter ${index + 1} title`), contentHtml }
  })
  if (contentBytes > maxContentBytes) throw new Error('The selected chapters are too large to publish together.')
  return {
    title: cleanText(input.title, 160, 'Story title'),
    description: cleanText(input.description ?? '', 2_000, 'Story description', true),
    chapters,
  }
}

export function createMemoryRateLimiter(now = () => Date.now()): RateLimiter {
  const attempts = new Map<string, number[]>()
  return (key, limit, windowMs) => {
    const timestamp = now()
    const recent = (attempts.get(key) ?? []).filter((item) => timestamp - item < windowMs)
    if (recent.length >= limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (timestamp - recent[0])) / 1000)) }
    }
    recent.push(timestamp)
    attempts.set(key, recent)
    return { allowed: true, retryAfter: 0 }
  }
}

export function createPublishedStoryHandler({
  store,
  publisherId = process.env.MIDNIGHT_LIBRARY_PUBLISHER_ID,
  rateLimit = createMemoryRateLimiter(),
  now = () => new Date(),
  generateId = randomUUID,
}: {
  store: PublishedStoryStore
  publisherId?: string
  rateLimit?: RateLimiter
  now?: () => Date
  generateId?: () => string
}): Handler {
  return async (event, context) => {
    try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: { Allow: 'GET, POST, PUT, DELETE, OPTIONS' } }
    const user = userFrom(context)
    const mutation = event.httpMethod !== 'GET'
    const rateKey = mutation ? `publisher:${user?.sub ?? 'anonymous'}` : `reader:${event.headers['x-nf-client-connection-ip'] ?? event.headers['x-forwarded-for'] ?? 'unknown'}`
    const allowance = rateLimit(rateKey, mutation ? 20 : 120, 60_000)
    if (!allowance.allowed) return json(429, { error: 'Too many requests. Please try again shortly.' }, { 'Retry-After': String(allowance.retryAfter) })

    if (event.httpMethod === 'GET') {
      const id = publicationId(event)
      if (!id) return json(404, { error: 'Published story not found.' })
      const stored = await store.get(id)
      return stored ? json(200, publicStory(stored.record)) : json(404, { error: 'Published story not found.' })
    }

    if (!publisherId) return json(503, { error: 'Publisher authorization is not configured.' })
    if (!user) return json(401, { error: 'Publisher sign-in is required.' })
    if (user.sub !== publisherId) return json(403, { error: 'This identity is not authorized to publish.' })

    if (event.httpMethod === 'DELETE') {
      const id = publicationId(event)
      if (!id) return json(404, { error: 'Published story not found.' })
      const stored = await store.get(id)
      if (!stored) return json(404, { error: 'Published story not found.' })
      await store.delete(id)
      return { statusCode: 204, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } }
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST, PUT, DELETE, OPTIONS' })
    const requestBody = event.body && event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    if (!requestBody || Buffer.byteLength(requestBody, 'utf8') > maxBodyBytes) return json(413, { error: 'The publication request is too large.' })

    let payload: PublishedStoryPayload
    try {
      payload = validatePublishedStoryPayload(JSON.parse(requestBody) as unknown)
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : 'Published story data is invalid.' })
    }

    const timestamp = now().toISOString()
    if (event.httpMethod === 'POST') {
      const id = generateId()
      const record: StoredStory = { ...payload, version: publishedStoryVersion, id, ownerId: user.sub, publishedAt: timestamp, updatedAt: timestamp }
      if (!await store.create(id, record)) return json(409, { error: 'Please try publishing again.' })
      return json(201, publicStory(record))
    }

    const id = publicationId(event)
    if (!id) return json(404, { error: 'Published story not found.' })
    const existing = await store.get(id)
    if (!existing) return json(404, { error: 'Published story not found.' })
    const record: StoredStory = { ...payload, version: publishedStoryVersion, id, ownerId: user.sub, publishedAt: existing.record.publishedAt, updatedAt: timestamp }
    if (!await store.update(id, record, existing.etag)) return json(409, { error: 'The published story changed. Please try again.' })
      return json(200, publicStory(record))
    } catch (error) {
      console.error('Published story request failed.', error)
      return json(500, { error: 'The publishing service is temporarily unavailable.' })
    }
  }
}
