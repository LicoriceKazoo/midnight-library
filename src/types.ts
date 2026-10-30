export type Chapter = {
  id: string
  title: string
  paragraphs?: string[]
  contentHtml?: string
  createdAt: number
  updatedAt: number
}

export type Note = {
  id: string
  text: string
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
  notes?: Note[]
}

export type ReadingPreferences = {
  fontSize: number
  lineHeight: number
}

export type AppState = {
  schemaVersion: number
  stories: Story[]
  preferences: ReadingPreferences
}

export type SaveStatus = 'saving' | 'saved' | 'error'

export type View =
  | { name: 'library' }
  | { name: 'audio' }
  | { name: 'story'; storyId: string }
  | { name: 'reader'; storyId: string; chapterId: string }
