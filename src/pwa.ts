import { registerSW } from 'virtual:pwa-register'

export type PwaState = {
  needRefresh: boolean
  offlineReady: boolean
  registrationError: boolean
}

let state: PwaState = { needRefresh: false, offlineReady: false, registrationError: false }
const listeners = new Set<() => void>()

function setState(next: Partial<PwaState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

export function subscribePwa(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPwaState() {
  return state
}

export function dismissOfflineReady() {
  setState({ offlineReady: false })
}

export function dismissUpdate() {
  setState({ needRefresh: false })
}

export function dismissRegistrationError() {
  setState({ registrationError: false })
}

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => setState({ needRefresh: true }),
  onOfflineReady: () => setState({ offlineReady: true }),
  onRegisterError: () => setState({ registrationError: true }),
})

export async function activateUpdate() {
  await updateServiceWorker(true)
}
