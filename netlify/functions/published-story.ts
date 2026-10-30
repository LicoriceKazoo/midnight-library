import { getStore } from '@netlify/blobs'
import type { Handler } from '@netlify/functions'
import { createPublishedStoryHandler, type PublishedStoryStore } from './published-story-core.js'

const blobs = getStore({ name: 'midnight-library-published-stories', consistency: 'strong' })

const store: PublishedStoryStore = {
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

export const handler: Handler = createPublishedStoryHandler({ store })
