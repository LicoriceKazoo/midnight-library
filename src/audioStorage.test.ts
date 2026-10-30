import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { serializeBackup } from './backup'
import { defaultAudioState } from './audioModel'
import { deleteAudioTrack, listAudioTracks, loadAudioFile, loadAudioState, saveAudioState, saveAudioTrack, updateAudioTrack } from './audioStorage'
import type { AudioTrack } from './audioTypes'
import type { AppState } from './types'

function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('midnight-library')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

const track: AudioTrack = {
  id: 'track-one', fileName: 'rain.mp3', title: 'Soft Rain', mimeType: 'audio/mpeg',
  size: 4, createdAt: 1,
}

describe('local audio storage', () => {
  beforeEach(clearDatabase)

  it('stores metadata separately and loads only the requested audio blob', async () => {
    await saveAudioTrack(track, new Blob(['rain'], { type: 'audio/mpeg' }))
    await expect(listAudioTracks()).resolves.toEqual([track])
    const file = await loadAudioFile(track.id)
    expect(await file?.text()).toBe('rain')

    const renamed = { ...track, title: 'Rain at Midnight' }
    await updateAudioTrack(renamed)
    await expect(listAudioTracks()).resolves.toEqual([renamed])

    await deleteAudioTrack(track.id)
    await expect(listAudioTracks()).resolves.toEqual([])
    await expect(loadAudioFile(track.id)).resolves.toBeUndefined()
  })

  it('persists playlists and playback independently from story backups', async () => {
    const audioState = {
      ...defaultAudioState,
      playlists: [{ id: 'playlist', name: 'Reading', trackIds: [track.id], createdAt: 1, updatedAt: 2 }],
      playback: { ...defaultAudioState.playback, currentTrackId: track.id, position: 17, volume: 0.45 },
    }
    await saveAudioState(audioState)
    await expect(loadAudioState()).resolves.toEqual(audioState)

    const storyState: AppState = { schemaVersion: 2, stories: [], preferences: { fontSize: 18, lineHeight: 1.75 } }
    const backup = serializeBackup(storyState)
    expect(backup).not.toContain(track.fileName)
    expect(backup).not.toContain('audio-track')
  })
})
