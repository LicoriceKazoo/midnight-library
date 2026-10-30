import { audioFilesStore, audioMetadataStore, audioStateStore, openDatabase } from './database'
import type { AudioLibraryState, AudioTrack } from './audioTypes'

export async function listAudioTracks(): Promise<AudioTrack[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(audioMetadataStore, 'readonly')
    const request = transaction.objectStore(audioMetadataStore).getAll()
    request.onsuccess = () => resolve((request.result as AudioTrack[]).sort((a, b) => a.createdAt - b.createdAt))
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

export async function saveAudioTrack(track: AudioTrack, file: Blob): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([audioMetadataStore, audioFilesStore], 'readwrite')
    transaction.objectStore(audioMetadataStore).put(track, track.id)
    transaction.objectStore(audioFilesStore).put(file, track.id)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
    transaction.onabort = () => { database.close(); reject(transaction.error) }
  })
}

export async function updateAudioTrack(track: AudioTrack): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(audioMetadataStore, 'readwrite')
    transaction.objectStore(audioMetadataStore).put(track, track.id)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}

export async function loadAudioFile(trackId: string): Promise<Blob | undefined> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(audioFilesStore, 'readonly')
    const request = transaction.objectStore(audioFilesStore).get(trackId)
    request.onsuccess = () => resolve(request.result as Blob | undefined)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

export async function deleteAudioTrack(trackId: string): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([audioMetadataStore, audioFilesStore], 'readwrite')
    transaction.objectStore(audioMetadataStore).delete(trackId)
    transaction.objectStore(audioFilesStore).delete(trackId)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}

export async function loadAudioState(): Promise<Partial<AudioLibraryState> | undefined> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(audioStateStore, 'readonly')
    const request = transaction.objectStore(audioStateStore).get('current')
    request.onsuccess = () => resolve(request.result as Partial<AudioLibraryState> | undefined)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

export async function saveAudioState(state: AudioLibraryState): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(audioStateStore, 'readwrite')
    transaction.objectStore(audioStateStore).put(state, 'current')
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}
