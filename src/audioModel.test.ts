import { describe, expect, it } from 'vitest'
import { adjacentTrackId, endedTrackId, migrateAudioState, nextRepeatMode, playbackQueue, removeTrackFromPlaylists } from './audioModel'
import type { AudioPlaylist, AudioTrack } from './audioTypes'

const tracks: AudioTrack[] = ['a', 'b', 'c'].map((id, index) => ({
  id, fileName: `${id}.mp3`, title: id.toUpperCase(), mimeType: 'audio/mpeg', size: 10,
  createdAt: index,
}))
const playlists: AudioPlaylist[] = [{
  id: 'night', name: 'Night', trackIds: ['c', 'missing', 'a'], createdAt: 1, updatedAt: 1,
}]

describe('audio playback navigation', () => {
  it('builds queues without missing files and moves through playlists', () => {
    const queue = playbackQueue(tracks, playlists, 'night')
    expect(queue).toEqual(['c', 'a'])
    expect(adjacentTrackId({ queue, currentTrackId: 'c', direction: 'next', repeatMode: 'off', shuffle: false })).toBe('a')
    expect(adjacentTrackId({ queue, currentTrackId: 'a', direction: 'next', repeatMode: 'off', shuffle: false })).toBeUndefined()
    expect(adjacentTrackId({ queue, currentTrackId: 'a', direction: 'next', repeatMode: 'playlist', shuffle: false })).toBe('c')
  })

  it('supports repeat-one, shuffle, and repeat mode cycling', () => {
    expect(endedTrackId({ queue: ['a', 'b'], currentTrackId: 'a', repeatMode: 'one', shuffle: false })).toBe('a')
    expect(endedTrackId({ queue: ['a', 'b', 'c'], currentTrackId: 'a', repeatMode: 'off', shuffle: true, random: () => 0.99 })).toBe('c')
    expect(nextRepeatMode('off')).toBe('one')
    expect(nextRepeatMode('one')).toBe('playlist')
    expect(nextRepeatMode('playlist')).toBe('off')
  })

  it('removes deleted tracks from every playlist', () => {
    const updated = removeTrackFromPlaylists([{ ...playlists[0], lastTrackId: 'c' }], 'c')
    expect(updated[0].trackIds).toEqual(['missing', 'a'])
    expect(updated[0].lastTrackId).toBeUndefined()
  })
})

describe('audio state migration', () => {
  it('restores playback settings while clamping unsafe values', () => {
    const state = migrateAudioState({
      schemaVersion: 1,
      playlists,
      playback: { position: 42, volume: 4, muted: true, repeatMode: 'playlist', shuffle: true },
    })
    expect(state.playback).toMatchObject({ position: 42, volume: 1, muted: true, repeatMode: 'playlist', shuffle: true })
  })

  it('preserves a playlist last-track pointer during migration', () => {
    const state = migrateAudioState({
      schemaVersion: 1,
      playlists: [{ ...playlists[0], lastTrackId: 'a' }],
    })
    expect(state.playlists[0].lastTrackId).toBe('a')
  })
})
