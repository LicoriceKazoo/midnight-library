import type { IdentityUser } from 'netlify-identity-widget'

let identityPromise: Promise<typeof import('netlify-identity-widget').default> | null = null

export async function loadPublisherIdentity() {
  identityPromise ??= import('netlify-identity-widget').then((module) => {
    module.default.init()
    return module.default
  }).catch((error) => {
    identityPromise = null
    throw error
  })
  return identityPromise
}

export async function getPublisherUser(): Promise<IdentityUser | null> {
  return (await loadPublisherIdentity()).currentUser()
}

export async function getPublisherToken() {
  const user = await getPublisherUser()
  return user ? user.jwt() : null
}
