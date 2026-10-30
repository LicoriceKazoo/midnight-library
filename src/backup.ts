import { currentSchemaVersion, migrateState, preferenceLimits } from './model'
import type { AppState, Chapter, Note, ReadingPreferences, Story } from './types'

export const backupFormat = 'midnight-library-backup'
export const backupVersion = 1

export type BackupDocument = {
  format: typeof backupFormat
  version: typeof backupVersion
  exportedAt: string
  data: AppState
}

export type BackupParseResult =
  | { ok: true; state: AppState; exportedAt: string }
  | { ok: false; error: string }

const allowedRichTextTags = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'span', 'h1', 'h2', 'h3', 'h4',
  'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'hr',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function requireString(value: unknown, label: string, allowBlank = true) {
  if (typeof value !== 'string' || (!allowBlank && value.trim().length === 0)) {
    throw new Error(`${label} must be ${allowBlank ? 'text' : 'non-empty text'}.`)
  }
  return value
}

function requireTimestamp(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} has an invalid timestamp.`)
  }
  return value
}

function validateRichText(html: string, label: string) {
  if (html.length > 5_000_000) throw new Error(`${label} is too large.`)
  if (/<!--|<!doctype|<\?|javascript:|\son[a-z]+\s*=/iu.test(html)) {
    throw new Error(`${label} contains unsafe markup.`)
  }

  const tokens = html.match(/<[^>]*>/gu) ?? []
  for (const token of tokens) {
    const match = token.match(/^<\/?([a-z][a-z0-9]*)\b/iu)
    if (!match || !allowedRichTextTags.has(match[1].toLowerCase())) {
      throw new Error(`${label} contains unsupported markup.`)
    }

    const tag = match[1].toLowerCase()
    if (tag === 'span' && !token.startsWith('</')) {
      const safeSpan = /^<span(?: style="color:\s*(?:#[0-9a-f]{3,8}|rgba?\([0-9,.\s%]+\));?")?>$/iu
      if (!safeSpan.test(token)) throw new Error(`${label} contains an unsupported text style.`)
    } else if (!new RegExp(`^<\\/?${tag}\\s*\\/?>$`, 'iu').test(token)) {
      throw new Error(`${label} contains unsupported attributes.`)
    }
  }

  const withoutTokens = html.replace(/<[^>]*>/gu, '')
  if (/[<>]/u.test(withoutTokens)) throw new Error(`${label} contains malformed markup.`)
}

function validateChapter(value: unknown, storyIndex: number, chapterIndex: number): Chapter {
  const label = `Story ${storyIndex + 1}, chapter ${chapterIndex + 1}`
  if (!isRecord(value)) throw new Error(`${label} is invalid.`)
  const contentHtml = value.contentHtml
  const paragraphs = value.paragraphs
  if (contentHtml !== undefined) {
    validateRichText(requireString(contentHtml, `${label} content`), `${label} content`)
  } else if (!Array.isArray(paragraphs) || !paragraphs.every((item) => typeof item === 'string')) {
    throw new Error(`${label} has no readable content.`)
  }

  return {
    id: requireString(value.id, `${label} ID`, false),
    title: requireString(value.title, `${label} title`, false),
    contentHtml: contentHtml as string | undefined,
    paragraphs: paragraphs as string[] | undefined,
    createdAt: requireTimestamp(value.createdAt, label),
    updatedAt: requireTimestamp(value.updatedAt, label),
  }
}

function validateNote(value: unknown, storyIndex: number, noteIndex: number): Note {
  const label = `Story ${storyIndex + 1}, note ${noteIndex + 1}`
  if (!isRecord(value)) throw new Error(`${label} is invalid.`)
  return {
    id: requireString(value.id, `${label} ID`, false),
    text: requireString(value.text, `${label} text`),
    createdAt: requireTimestamp(value.createdAt, label),
    updatedAt: requireTimestamp(value.updatedAt, label),
  }
}

function validatePreferences(value: unknown): ReadingPreferences {
  if (!isRecord(value)) throw new Error('Reading preferences are missing or invalid.')
  const fontSize = value.fontSize
  const lineHeight = value.lineHeight
  if (
    typeof fontSize !== 'number' || !Number.isFinite(fontSize) ||
    fontSize < preferenceLimits.fontSize.min || fontSize > preferenceLimits.fontSize.max
  ) throw new Error('The backup contains an invalid font size.')
  if (
    typeof lineHeight !== 'number' || !Number.isFinite(lineHeight) ||
    lineHeight < preferenceLimits.lineHeight.min || lineHeight > preferenceLimits.lineHeight.max
  ) throw new Error('The backup contains invalid line spacing.')
  return { fontSize, lineHeight }
}

function validateStories(value: unknown): Story[] {
  if (!Array.isArray(value)) throw new Error('The backup does not contain a story collection.')
  const storyIds = new Set<string>()
  const chapterIds = new Set<string>()
  const noteIds = new Set<string>()

  return value.map((item, storyIndex) => {
    if (!isRecord(item)) throw new Error(`Story ${storyIndex + 1} is invalid.`)
    const id = requireString(item.id, `Story ${storyIndex + 1} ID`, false)
    if (storyIds.has(id)) throw new Error(`Duplicate story ID “${id}” was found.`)
    storyIds.add(id)

    if (!Array.isArray(item.chapters)) throw new Error(`Story ${storyIndex + 1} has invalid chapters.`)
    const chapters = item.chapters.map((chapter, chapterIndex) => {
      const validated = validateChapter(chapter, storyIndex, chapterIndex)
      if (chapterIds.has(validated.id)) throw new Error(`Duplicate chapter ID “${validated.id}” was found.`)
      chapterIds.add(validated.id)
      return validated
    })

    const rawNotes = item.notes ?? []
    if (!Array.isArray(rawNotes)) throw new Error(`Story ${storyIndex + 1} has invalid notes.`)
    const notes = rawNotes.map((note, noteIndex) => {
      const validated = validateNote(note, storyIndex, noteIndex)
      if (noteIds.has(validated.id)) throw new Error(`Duplicate note ID “${validated.id}” was found.`)
      noteIds.add(validated.id)
      return validated
    })

    return {
      id,
      title: requireString(item.title, `Story ${storyIndex + 1} title`, false),
      description: item.description === undefined
        ? ''
        : requireString(item.description, `Story ${storyIndex + 1} description`),
      isSample: typeof item.isSample === 'boolean' ? item.isSample : undefined,
      createdAt: requireTimestamp(item.createdAt, `Story ${storyIndex + 1}`),
      updatedAt: requireTimestamp(item.updatedAt, `Story ${storyIndex + 1}`),
      chapters,
      notes,
    }
  })
}

export function createBackup(state: AppState, now = new Date()): BackupDocument {
  return {
    format: backupFormat,
    version: backupVersion,
    exportedAt: now.toISOString(),
    data: structuredClone(state),
  }
}

export function serializeBackup(state: AppState, now = new Date()) {
  return JSON.stringify(createBackup(state, now), null, 2)
}

export function parseBackup(text: string): BackupParseResult {
  try {
    const value: unknown = JSON.parse(text)
    if (!isRecord(value) || value.format !== backupFormat) {
      throw new Error('This is not a Midnight Library backup file.')
    }
    if (value.version !== backupVersion) {
      throw new Error('This backup version is not supported by this app.')
    }
    if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
      throw new Error('The backup export date is invalid.')
    }
    if (!isRecord(value.data)) throw new Error('The backup data is missing.')
    if (
      typeof value.data.schemaVersion !== 'number' || !Number.isInteger(value.data.schemaVersion) ||
      value.data.schemaVersion < 1 ||
      value.data.schemaVersion > currentSchemaVersion
    ) throw new Error('This backup uses a newer storage schema.')

    const state = migrateState({
      schemaVersion: value.data.schemaVersion,
      stories: validateStories(value.data.stories),
      preferences: validatePreferences(value.data.preferences),
    }, [])

    return { ok: true, state, exportedAt: value.exportedAt }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The backup could not be read.' }
  }
}
