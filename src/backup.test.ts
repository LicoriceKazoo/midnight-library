import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { backupFormat, backupVersion, createBackup, parseBackup, serializeBackup } from './backup'
import { loadState, saveState } from './storage'
import type { AppState } from './types'

const state: AppState = {
  schemaVersion: 3,
  preferences: { fontSize: 22, lineHeight: 4.85, theme: 'amethyst' },
  stories: [
    {
      id: 'story-one',
      title: 'The Harbor Light',
      description: 'A description\nwith two lines.',
      createdAt: 10,
      updatedAt: 20,
      chapters: [
        {
          id: 'chapter-one',
          title: 'Blue Lanterns',
          contentHtml: '<h2>Nightfall</h2><p data-indent="2" data-first-line-indent="true"><strong>Gold</strong> and <span style="color: #e4c57d">starlight</span>.</p>',
          createdAt: 10,
          updatedAt: 20,
        },
      ],
      notes: [{ id: 'note-one', text: 'Remember the tide.', createdAt: 11, updatedAt: 21 }],
    },
  ],
}

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('midnight-library')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

describe('backup export and restore', () => {
  beforeEach(clearDatabase)

  it('exports and imports rich text, notes, descriptions, and preferences without loss', async () => {
    const exportedAt = new Date('2026-10-29T12:00:00.000Z')
    const document = createBackup(state, exportedAt)
    expect(document.format).toBe(backupFormat)
    expect(document.version).toBe(backupVersion)
    expect(document.exportedAt).toBe(exportedAt.toISOString())

    const parsed = parseBackup(serializeBackup(state, exportedAt))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.state).toEqual(state)

    await saveState(parsed.state)
    await expect(loadState()).resolves.toEqual(state)
  })

  it('supports older stories without descriptions', () => {
    const document = createBackup(state) as unknown as Record<string, unknown>
    const data = document.data as AppState
    const legacyStory = data.stories[0] as StoryWithoutDescription
    delete legacyStory.description

    const parsed = parseBackup(JSON.stringify(document))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.state.stories[0].description).toBe('')
  })

  it('migrates backups created before theme preferences', () => {
    const document = createBackup(state) as unknown as { data: { preferences: Record<string, unknown> } }
    delete document.data.preferences.theme
    const parsed = parseBackup(JSON.stringify(document))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.state.preferences.theme).toBe('midnight')
  })

  it('rejects duplicate IDs and unsafe rich text before restore', () => {
    const duplicate = createBackup(state)
    duplicate.data.stories.push(structuredClone(duplicate.data.stories[0]))
    const duplicateResult = parseBackup(JSON.stringify(duplicate))
    expect(duplicateResult.ok).toBe(false)
    if (!duplicateResult.ok) expect(duplicateResult.error).toContain('Duplicate story ID')

    const unsafe = createBackup(state)
    unsafe.data.stories[0].chapters[0].contentHtml = '<p>Safe</p><script>alert(1)</script>'
    const unsafeResult = parseBackup(JSON.stringify(unsafe))
    expect(unsafeResult.ok).toBe(false)
    if (!unsafeResult.ok) expect(unsafeResult.error).toContain('unsupported markup')
  })
})

type StoryWithoutDescription = Omit<AppState['stories'][number], 'description'> & {
  description?: string
}
