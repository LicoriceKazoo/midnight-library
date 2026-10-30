import type { AppState, Chapter, ReadingPreferences, Story } from './types'

export const currentSchemaVersion = 2
export const preferenceLimits = {
  fontSize: { min: 11, max: 30 },
  lineHeight: { min: 1.2, max: 3 },
} as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function normalizePreferences(
  preferences?: Partial<ReadingPreferences>,
): ReadingPreferences {
  return {
    fontSize: clamp(
      Number(preferences?.fontSize) || 18,
      preferenceLimits.fontSize.min,
      preferenceLimits.fontSize.max,
    ),
    lineHeight: Number(
      clamp(
        Number(preferences?.lineHeight) || 1.75,
        preferenceLimits.lineHeight.min,
        preferenceLimits.lineHeight.max,
      ).toFixed(2),
    ),
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function chapterToHtml(chapter: Chapter) {
  if (typeof chapter.contentHtml === 'string') return chapter.contentHtml
  if (!chapter.paragraphs?.length) return '<p></p>'
  return chapter.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
}

export function countWords(html: string) {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
  return text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0
}

export function migrateState(
  state: Partial<AppState> | undefined,
  fallbackStories: Story[],
): AppState {
  const sourceStories = Array.isArray(state?.stories) ? state.stories : fallbackStories
  const stories = sourceStories.map((story) => ({
    ...story,
    description: typeof story.description === 'string' ? story.description : '',
    notes: Array.isArray(story.notes) ? story.notes : [],
    chapters: Array.isArray(story.chapters)
      ? story.chapters.map((chapter) => ({
          ...chapter,
          contentHtml: chapterToHtml(chapter),
        }))
      : [],
  }))

  return {
    schemaVersion: currentSchemaVersion,
    stories,
    preferences: normalizePreferences(state?.preferences),
  }
}
