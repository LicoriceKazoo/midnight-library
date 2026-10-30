import { useRef, useState } from 'react'
import { serializeBackup, parseBackup } from './backup'
import { Icon } from './Icon'
import type { AppState } from './types'

export function BackupControls({
  state,
  onImportReady,
}: {
  state: AppState
  onImportReady: (state: AppState, exportedAt: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const exportBackup = () => {
    const contents = serializeBackup(state)
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
    const date = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const link = document.createElement('a')
    link.href = url
    link.download = `midnight-library-backup-${date}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setMessage('Backup downloaded.')
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    setMessage(null)
    if (file.size > 25_000_000) {
      setMessage('That backup is larger than the 25 MB import limit.')
      return
    }

    try {
      const result = parseBackup(await file.text())
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      onImportReady(result.state, result.exportedAt)
    } catch {
      setMessage('The selected file could not be read.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="backup-controls">
      <div className="control-title"><Icon name="archive" size={18} /><span>Backup &amp; restore</span></div>
      <p>Keep a portable copy of your stories and reading settings. Audio is stored separately and is not included.</p>
      <div className="backup-actions">
        <button onClick={exportBackup} type="button"><Icon name="download" size={17} /> Export</button>
        <button onClick={() => inputRef.current?.click()} type="button"><Icon name="upload" size={17} /> Import</button>
      </div>
      <input
        accept="application/json,.json"
        aria-label="Choose a Midnight Library backup"
        className="visually-hidden"
        onChange={(event) => void importBackup(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      {message && <p className="backup-message" role="status">{message}</p>}
    </section>
  )
}

export function RestoreBackupDialog({
  currentStoryCount,
  exportedAt,
  importedState,
  onCancel,
  onRestore,
}: {
  currentStoryCount: number
  exportedAt: string
  importedState: AppState
  onCancel: () => void
  onRestore: () => void
}) {
  const chapterCount = importedState.stories.reduce((total, story) => total + story.chapters.length, 0)
  const noteCount = importedState.stories.reduce((total, story) => total + (story.notes?.length ?? 0), 0)

  return (
    <div aria-labelledby="restore-dialog-title" aria-modal="true" className="dialog-backdrop" role="dialog">
      <section className="action-dialog restore-dialog">
        <span className="dialog-icon warning"><Icon name="upload" /></span>
        <h2 id="restore-dialog-title">Replace this library?</h2>
        <p>
          This backup contains <strong>{importedState.stories.length}</strong> stories,{' '}
          <strong>{chapterCount}</strong> chapters, and <strong>{noteCount}</strong> notes.
          It was exported {new Date(exportedAt).toLocaleString()}.
        </p>
        <div className="restore-warning">
          All {currentStoryCount} stories currently on this device and your reading settings will be replaced.
          Importing does not merge or duplicate libraries.
        </div>
        <div className="dialog-actions">
          <button autoFocus className="secondary-button" onClick={onCancel} type="button">Cancel</button>
          <button className="restore-button" onClick={onRestore} type="button">Replace &amp; restore</button>
        </div>
      </section>
    </div>
  )
}
