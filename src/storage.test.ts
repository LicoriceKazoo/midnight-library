import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadState, saveState } from './storage'
import type { AppState } from './types'

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('midnight-library')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

describe('IndexedDB storage', () => {
  beforeEach(clearDatabase)

  it('round-trips formatted chapters, story notes, and preferences', async () => {
    const state: AppState = {
      schemaVersion: 3,
      preferences: { fontSize: 30, lineHeight: 3, theme: 'charcoal' },
      stories: [
        {
          id: 'story',
          title: 'The Story',
          description: 'A test story.',
          createdAt: 1,
          updatedAt: 2,
          chapters: [
            {
              id: 'chapter',
              title: 'The Chapter',
              contentHtml: '<p><strong>Formatted</strong> <span style="color: #e4c57d">text</span></p>',
              createdAt: 1,
              updatedAt: 2,
            },
          ],
          notes: [{ id: 'note', text: 'Remember the lantern.', createdAt: 1, updatedAt: 2 }],
        },
      ],
    }

    await saveState(state)
    await expect(loadState()).resolves.toEqual(state)
  })
})
