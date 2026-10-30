import { useEffect, useState } from 'react'
import { identityCallbackKind, type IdentityCallbackKind } from './identityCallbacks'
import { loadPublisherIdentity } from './publisherAuth'

function callbackError(kind: IdentityCallbackKind) {
  if (kind === 'invite') return 'This invitation link is invalid or has expired. Ask the site owner to send a new invitation.'
  if (kind === 'recovery') return 'This password-reset link is invalid or has expired. Request a new link from Publisher sign in.'
  return 'This account link is invalid or has expired. Request a new link and try again.'
}

function identityErrorMessage(kind: IdentityCallbackKind, error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (/failed to (?:fetch|load settings)|network|offline/iu.test(message)) {
    return 'The account service could not be reached. Check your connection, then reopen the latest email link.'
  }
  return callbackError(kind)
}

function callbackSuccess(kind: IdentityCallbackKind) {
  if (kind === 'invite') return 'Publisher account activated. You are now signed in.'
  if (kind === 'recovery') return 'Password updated. You are now signed in.'
  return 'Publisher account verified. You are now signed in.'
}

export function IdentityCallbackHandler() {
  const [callbackKind] = useState(() => identityCallbackKind(window.location.hash))
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null)

  useEffect(() => {
    if (!callbackKind) return
    let active = true
    let identity: Awaited<ReturnType<typeof loadPublisherIdentity>> | null = null
    const handleError = (error?: unknown) => active && setNotice({ message: identityErrorMessage(callbackKind, error), error: true })
    const handleLogin = () => active && setNotice({ message: callbackSuccess(callbackKind), error: false })

    void loadPublisherIdentity().then((loadedIdentity) => {
      if (!active) return
      identity = loadedIdentity
      identity.on('error', handleError)
      identity.on('login', handleLogin)
    }).catch(() => {
      if (active) setNotice({ message: 'Account setup could not start. Check your connection and reopen the latest email link.', error: true })
    })

    return () => {
      active = false
      identity?.off('error', handleError)
      identity?.off('login', handleLogin)
    }
  }, [callbackKind])

  if (!notice) return null
  return (
    <div className={`identity-callback-notice ${notice.error ? 'error' : 'success'}`} role={notice.error ? 'alert' : 'status'}>
      <span>{notice.message}</span>
      <button aria-label="Dismiss account message" onClick={() => setNotice(null)} type="button">×</button>
    </div>
  )
}
