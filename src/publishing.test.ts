import { describe, expect, it } from 'vitest'
import { buildPublishedStoryPayload } from './publishing'
import type { Story } from './types'

describe('publication snapshots', () => {
  it('includes only the chosen story chapters and never private notes or audio data', () => {
    const story: Story = {
      id: 'local-story', title: 'Local Story', description: 'Public description', createdAt: 1, updatedAt: 2,
      notes: [{ id: 'private-note', text: 'Never upload this', createdAt: 1, updatedAt: 1 }],
      chapters: [
        { id: 'chosen', title: 'Chosen', contentHtml: '<p>Public chapter</p>', createdAt: 1, updatedAt: 1 },
        { id: 'draft', title: 'Draft', contentHtml: '<p>Private draft</p>', createdAt: 1, updatedAt: 1 },
      ],
    }
    const snapshot = buildPublishedStoryPayload(story, ['chosen'])
    expect(snapshot.chapters.map((chapter) => chapter.id)).toEqual(['chosen'])
    expect(JSON.stringify(snapshot)).not.toContain('Never upload this')
    expect(JSON.stringify(snapshot)).not.toContain('Private draft')
    expect(snapshot).not.toHaveProperty('notes')
  })
})
