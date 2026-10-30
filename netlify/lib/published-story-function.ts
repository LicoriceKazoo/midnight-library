import { connectLambda, getStore } from '@netlify/blobs'
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'
import {
  createMemoryRateLimiter,
  createPublishedStoryHandler,
  publishingServiceUnavailableResponse,
  type PublishedStoryStore,
} from './published-story-core.js'

const storeName = 'midnight-library-published-stories'

type StoredStory = Parameters<PublishedStoryStore['create']>[1]
type BlobsStore = {
  delete: (key: string) => Promise<void>
  getWithMetadata: (key: string, options: { type: 'json'; consistency: 'strong' }) => Promise<{ data: StoredStory; etag?: string } | null>
  setJSON: (key: string, data: unknown, options: { onlyIfNew: true } | { onlyIfMatch: string }) => Promise<{ modified: boolean }>
}
type BlobsLambdaEvent = Parameters<typeof connectLambda>[0]
type FunctionDependencies = {
  connect?: (event: BlobsLambdaEvent) => void
  openStore?: (options: { name: string; consistency: 'strong' }) => BlobsStore
  logError?: (message: string, details: { errorName: string }) => void
  publisherId?: string
}

function blobsLambdaEvent(event: HandlerEvent): BlobsLambdaEvent {
  const blobs = (event as HandlerEvent & { blobs?: unknown }).blobs
  if (typeof blobs !== 'string' || !blobs) {
    const error = new Error('Netlify Blobs request context is missing.')
    error.name = 'BlobsRequestContextError'
    throw error
  }
  const headers = Object.fromEntries(
    Object.entries(event.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  return { blobs, headers }
}

function publishedStoryStore(blobs: BlobsStore): PublishedStoryStore {
  return {
    async get(id) {
      const result = await blobs.getWithMetadata(id, { type: 'json', consistency: 'strong' })
      return result ? { record: result.data, etag: result.etag ?? '' } : null
    },
    async create(id, record) {
      return (await blobs.setJSON(id, record, { onlyIfNew: true })).modified
    },
    async update(id, record, etag) {
      return (await blobs.setJSON(id, record, { onlyIfMatch: etag })).modified
    },
    async delete(id) {
      await blobs.delete(id)
    },
  }
}

function errorName(error: unknown) {
  return error instanceof Error && error.name ? error.name : 'UnknownError'
}

export function createPublishedStoryFunction({
  connect = connectLambda,
  openStore = getStore,
  logError = (message, details) => console.error(message, details),
  publisherId,
}: FunctionDependencies = {}): Handler {
  const rateLimit = createMemoryRateLimiter()

  return async (event, context): Promise<HandlerResponse> => {
    let blobs: BlobsStore
    try {
      connect(blobsLambdaEvent(event))
      blobs = openStore({ name: storeName, consistency: 'strong' })
    } catch (error) {
      logError('Published story Blob initialization failed.', { errorName: errorName(error) })
      return publishingServiceUnavailableResponse()
    }

    const handler = createPublishedStoryHandler({ store: publishedStoryStore(blobs), publisherId, rateLimit })
    return await handler(event, context) as HandlerResponse
  }
}
