declare module 'netlify-identity-widget' {
  export type IdentityUser = {
    id: string
    email?: string
    jwt: (forceRefresh?: boolean) => Promise<string>
  }

  type IdentityEvent = 'init' | 'login' | 'logout' | 'error' | 'open' | 'close'
  type IdentityWidget = {
    init: (options?: { APIUrl?: string; logo?: boolean }) => void
    open: (action?: 'login' | 'signup') => void
    close: () => void
    currentUser: () => IdentityUser | null
    logout: () => Promise<void>
    on: (event: IdentityEvent, callback: (...args: unknown[]) => void) => void
    off: (event: IdentityEvent, callback?: (...args: unknown[]) => void) => void
  }

  const widget: IdentityWidget
  export default widget
}
