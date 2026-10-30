import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { SaveIndicator } from './SaveIndicator'
import type { Note, SaveStatus } from './types'

export function QuickNotesDrawer({
  notes,
  open,
  saveStatus,
  storyTitle,
  onAdd,
  onClose,
  onDelete,
  onUpdate,
}: {
  notes: Note[]
  open: boolean
  saveStatus: SaveStatus
  storyTitle: string
  onAdd: () => string
  onClose: () => void
  onDelete: (noteId: string) => void
  onUpdate: (noteId: string, text: string) => void
}) {
  const dragStart = useRef<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const addNote = () => {
    const noteId = onAdd()
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>(`[data-note-id="${noteId}"]`)?.focus()
    })
  }

  return (
    <>
      <button aria-label="Close quick notes" className={`notes-scrim ${open ? 'is-open' : ''}`} onClick={onClose} tabIndex={open ? 0 : -1} type="button" />
      <aside aria-hidden={!open} aria-label={`Quick notes for ${storyTitle}`} className={`notes-sheet ${open ? 'is-open' : ''}`} inert={!open}>
        <div
          className="notes-drag-zone"
          onPointerDown={(event) => { dragStart.current = event.clientY }}
          onPointerUp={(event) => {
            if (dragStart.current !== null && event.clientY - dragStart.current > 70) onClose()
            dragStart.current = null
          }}
        >
          <span className="drag-handle" />
        </div>
        <header className="notes-header">
          <div>
            <p>For {storyTitle}</p>
            <h2>Quick Notes</h2>
          </div>
          <button aria-label="Close quick notes" className="icon-button" onClick={onClose} type="button"><Icon name="x" /></button>
        </header>
        <div className="notes-list">
          {notes.length === 0 ? (
            <div className="notes-empty">
              <Icon name="notebook" size={26} />
              <p>Keep a thought, a detail, or a spark for later.</p>
            </div>
          ) : notes.map((note, index) => (
            <article className="note-card" key={note.id}>
              <label htmlFor={`note-${note.id}`}>Note {index + 1}</label>
              <textarea
                data-note-id={note.id}
                id={`note-${note.id}`}
                onChange={(event) => onUpdate(note.id, event.target.value)}
                placeholder="Write a quick note…"
                rows={4}
                value={note.text}
              />
              <div className="note-card-footer">
                <span>{note.text.trim() ? 'Saved automatically' : 'Empty note'}</span>
                {pendingDelete === note.id ? (
                  <span className="note-delete-confirm">
                    <button onClick={() => setPendingDelete(null)} type="button">Keep</button>
                    <button onClick={() => { onDelete(note.id); setPendingDelete(null) }} type="button">Delete</button>
                  </span>
                ) : (
                  <button aria-label={`Delete note ${index + 1}`} onClick={() => setPendingDelete(note.id)} type="button"><Icon name="trash" size={16} /></button>
                )}
              </div>
            </article>
          ))}
        </div>
        <footer className="notes-footer">
          <button className="compact-gold-button" onClick={addNote} type="button"><Icon name="plus" size={18} /> New note</button>
          <SaveIndicator status={saveStatus} />
        </footer>
      </aside>
    </>
  )
}
