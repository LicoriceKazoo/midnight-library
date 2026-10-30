import { describe, expect, it } from 'vitest'
import { identityCallbackKind } from './identityCallbacks'

describe('Netlify Identity callback detection', () => {
  it('recognizes supported account callbacks without returning their tokens', () => {
    expect(identityCallbackKind('#invite_token=private-invitation')).toBe('invite')
    expect(identityCallbackKind('#/recovery_token=private-recovery')).toBe('recovery')
    expect(identityCallbackKind('#confirmation_token=private-confirmation')).toBe('confirmation')
    expect(identityCallbackKind('#email_change_token=private-email-change')).toBe('email_change')
  })

  it('ignores ordinary application fragments', () => {
    expect(identityCallbackKind('#chapter-2')).toBeNull()
    expect(identityCallbackKind('')).toBeNull()
  })
})
