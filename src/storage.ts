import type { AppState } from './types'
import { appStateStore, openDatabase } from './database'

export async function loadState(): Promise<Partial<AppState> | undefined> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(appStateStore, 'readonly')
    const request = transaction.objectStore(appStateStore).get('current')

    request.onsuccess = () => resolve(request.result as Partial<AppState> | undefined)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

export async function saveState(state: AppState): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(appStateStore, 'readwrite')
    transaction.objectStore(appStateStore).put(state, 'current')

    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => reject(transaction.error)
  })
}
