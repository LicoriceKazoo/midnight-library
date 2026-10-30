export const databaseName = 'midnight-library'
export const databaseVersion = 3
export const appStateStore = 'app-state'
export const audioMetadataStore = 'audio-track-metadata'
export const audioFilesStore = 'audio-track-files'
export const audioStateStore = 'audio-state'

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)

    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of [appStateStore, audioMetadataStore, audioFilesStore, audioStateStore]) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('The local database is open in another tab.'))
  })
}
