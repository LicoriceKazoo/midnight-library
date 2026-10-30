import type { SaveStatus } from './types'

export function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span className={`save-indicator ${status}`} role="status">
      <span aria-hidden="true" />
      {status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed' : 'Saved locally'}
    </span>
  )
}
