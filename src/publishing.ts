import type { Story } from './types.js'

export const publishedStoryVersion = 1

export type PublishedChapter = {
  id: string
  title: string
  contentHtml: string
}

export type PublishedStoryPayload = {
  title: string
  description: string
  chapters: PublishedChapter[]
}

export type PublishedStory = PublishedStoryPayload & {
  version: typeof publishedStoryVersion
  id: string
  publishedAt: string
  updatedAt: string
}

function chapterContent(story: Story, chapterId: string) {
  const chapter = story.chapters.find((item) => item.id === chapterId)
  if (!chapter) return ''
  if (typeof chapter.contentHtml === 'string') return chapter.contentHtml
  const escape = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
  return chapter.paragraphs?.map((paragraph) => `<p>${escape(paragraph)}</p>`).join('') ?? '<p></p>'
}

export function buildPublishedStoryPayload(story: Story, selectedChapterIds: string[]): PublishedStoryPayload {
  const selected = new Set(selectedChapterIds)
  return {
    title: story.title,
    description: story.description,
    chapters: story.chapters
      .filter((chapter) => selected.has(chapter.id))
      .map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        contentHtml: chapterContent(story, chapter.id),
      })),
  }
}

