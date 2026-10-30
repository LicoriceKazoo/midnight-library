export type Chapter = {
  id: string
  title: string
  paragraphs: string[]
  createdAt: number
  updatedAt: number
}

export type Story = {
  id: string
  title: string
  description: string
  isSample?: boolean
  createdAt: number
  updatedAt: number
  chapters: Chapter[]
}

export type ReadingPreferences = {
  fontSize: number
  lineHeight: number
}

export type View =
  | { name: 'library' }
  | { name: 'story'; storyId: string }
  | { name: 'reader'; storyId: string; chapterId: string }
