import { readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Netlify Function discovery', () => {
  it('contains only the intended published-story entry point', async () => {
    const entries = await readdir(new URL('../../netlify/functions/', import.meta.url))
    expect(entries.sort()).toEqual(['published-story.ts'])
  })
})
