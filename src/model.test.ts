import { describe, expect, it } from 'vitest'
import { chapterToHtml, countWords, currentSchemaVersion, migrateState, normalizePreferences } from './model'
import type { Story } from './types'

const legacyStory: Story = {
  id: 'legacy-story',
  title: 'Legacy Story',
  description: 'Saved before rich-text editing.',
  createdAt: 1,
  updatedAt: 2,
  chapters: [
    {
      id: 'legacy-chapter',
      title: 'Chapter One',
      paragraphs: ['A quiet beginning.', 'A lantern <glowed>.'],
      createdAt: 1,
      updatedAt: 2,
    },
  ],
}

describe('state migrations', () => {
  it('preserves legacy stories while adding rich content and notes', () => {
    const migrated = migrateState(
      { stories: [legacyStory], preferences: { fontSize: 18, lineHeight: 1.75 } },
      [],
    )

    expect(migrated.schemaVersion).toBe(currentSchemaVersion)
    expect(migrated.stories[0].notes).toEqual([])
    expect(migrated.stories[0].chapters[0].contentHtml).toBe(
      '<p>A quiet beginning.</p><p>A lantern &lt;glowed&gt;.</p>',
    )
  })

  it('keeps rich-text formatting and colors unchanged', () => {
    const contentHtml = '<h2>Nightfall</h2><p><strong>Gold</strong> and <span style="color: #dda6a6">rose</span>.</p>'
    expect(chapterToHtml({ ...legacyStory.chapters[0], contentHtml })).toBe(contentHtml)
    expect(countWords(contentHtml)).toBe(4)
  })
})

describe('reading preferences', () => {
  it('clamps the new typography range and retains two-decimal spacing', () => {
    expect(normalizePreferences({ fontSize: 5, lineHeight: 0.8 })).toEqual({ fontSize: 11, lineHeight: 1.2 })
    expect(normalizePreferences({ fontSize: 80, lineHeight: 8 })).toEqual({ fontSize: 30, lineHeight: 5 })
    expect(normalizePreferences({ fontSize: 21, lineHeight: 2.34 })).toEqual({ fontSize: 21, lineHeight: 2.34 })
    expect(normalizePreferences({ fontSize: 18, lineHeight: 1.85 })).toEqual({ fontSize: 18, lineHeight: 1.85 })
  })
})
