import { useEffect, useState, useSyncExternalStore } from 'react'
import { activateUpdate, dismissOfflineReady, dismissRegistrationError, dismissUpdate, getPwaState, subscribePwa } from './pwa'

export function PwaStatus({ beforeUpdate }: { beforeUpdate: () => Promise<void> }) {
  const status = useSyncExternalStore(subscribePwa, getPwaState)
  const [updating, setUpdating] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    if (!status.offlineReady) return
    const timer = window.setTimeout(dismissOfflineReady, 6000)
    return () => window.clearTimeout(timer)
  }, [status.offlineReady])

  const update = async () => {
    setUpdating(true)
    setSaveError(false)
    try {
      await beforeUpdate()
      await activateUpdate()
    } catch {
      setUpdating(false)
      setSaveError(true)
    }
  }

  if (!status.needRefresh && !status.offlineReady && !status.registrationError) return null

  return (
    <aside aria-live="polite" className="pwa-status">
      {status.needRefresh ? (
        <>
          <div>
            <strong>Update ready</strong>
            <span>{saveError ? 'Your latest changes could not be saved. The update was not applied.' : 'Apply it when you finish this sentence. Your library will be saved first.'}</span>
          </div>
          <div className="pwa-status-actions">
            <button disabled={updating} onClick={() => void update()} type="button">{updating ? 'Saving…' : 'Save & update'}</button>
            <button aria-label="Dismiss update" disabled={updating} onClick={dismissUpdate} type="button">Later</button>
          </div>
        </>
      ) : status.registrationError ? (
        <>
          <div><strong>Offline setup unavailable</strong><span>The library still works online and your local data is unchanged.</span></div>
          <div className="pwa-status-actions"><button onClick={dismissRegistrationError} type="button">Dismiss</button></div>
        </>
      ) : (
        <div><strong>Ready offline</strong><span>Stories and the editor can now open without a connection.</span></div>
      )}
    </aside>
  )
}
