export type IdentityCallbackKind = 'invite' | 'recovery' | 'confirmation' | 'email_change' | 'access_denied'

export function identityCallbackKind(hash: string): IdentityCallbackKind | null {
  const callback = hash.replace(/^#\/?/u, '')
  const tokenKind = callback.match(/^(confirmation|invite|recovery|email_change)_token=/u)?.[1]
  if (tokenKind) return tokenKind as Exclude<IdentityCallbackKind, 'access_denied'>
  return callback.startsWith('error=access_denied') ? 'access_denied' : null
}
