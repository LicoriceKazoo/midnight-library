import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AudioLibraryScreen } from './AudioLibraryScreen'
import { useAudio } from './AudioContext'
import { AudioProvider } from './AudioProvider'
import { BackupControls, RestoreBackupDialog } from './BackupControls'
import { CompactAudioPlayer, type PlayerDisplayState } from './CompactAudioPlayer'
import { Icon } from './Icon'
import { QuickNotesDrawer } from './QuickNotesDrawer'
import { PwaStatus } from './PwaStatus'
import { chapterToHtml, countWords, currentSchemaVersion, migrateState, normalizePreferences, preferenceLimits, readingThemes } from './model'
import { defaultPreferences, sampleStories } from './sampleData'
import { loadState, saveState } from './storage'
import type { AppState, Chapter, Note, ReadingPreferences, SaveStatus, Story, View } from './types'
import './App.css'

const RichTextEditor = lazy(() =>
  import('./RichTextEditor').then((module) => ({ default: module.RichTextEditor })),
)

type DialogState =
  | { type: 'create-story' }
  | { type: 'edit-story'; storyId: string; initialTitle: string; initialDescription: string }
  | { type: 'delete-story'; storyId: string; title: string }
  | { type: 'create-chapter'; storyId: string }
  | { type: 'rename-chapter'; storyId: string; chapterId: string; initialValue: string }
  | { type: 'delete-chapter'; storyId: string; chapterId: string; title: string }
  | null

type HistoryOverlay = 'drawer' | 'notes' | 'dialog' | 'backup' | 'player'

type MidnightHistoryState = {
  midnightLibrary: true
  view: View
  overlay?: HistoryOverlay
  scrollY: number
}

function isView(value: unknown): value is View {
  if (!value || typeof value !== 'object' || !('name' in value)) return false
  const candidate = value as Partial<View>
  if (candidate.name === 'library' || candidate.name === 'audio') return true
  if (candidate.name === 'story') return typeof candidate.storyId === 'string'
  return candidate.name === 'reader' && typeof candidate.storyId === 'string' && typeof candidate.chapterId === 'string'
}

function isMidnightHistoryState(value: unknown): value is MidnightHistoryState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MidnightHistoryState>
  return candidate.midnightLibrary === true && isView(candidate.view)
}

function sameView(first: View, second: View) {
  if (first.name !== second.name) return false
  if ('storyId' in first && 'storyId' in second && first.storyId !== second.storyId) return false
  return first.name !== 'reader' || (second.name === 'reader' && first.chapterId === second.chapterId)
}

function initialView(): View {
  if (isMidnightHistoryState(window.history.state)) return window.history.state.view
  const view: View = { name: 'library' }
  window.history.replaceState({ midnightLibrary: true, view, scrollY: 0 } satisfies MidnightHistoryState, '')
  return view
}

function validStoredView(view: View, stories: Story[]): View {
  if (!('storyId' in view)) return view
  const story = stories.find((item) => item.id === view.storyId)
  if (!story) return { name: 'library' }
  if (view.name === 'reader' && !story.chapters.some((chapter) => chapter.id === view.chapterId)) {
    return { name: 'story', storyId: story.id }
  }
  return view
}

const cloneSamples = () => structuredClone(sampleStories)

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp)
}

function AppContent() {
  const audio = useAudio()
  const [stories, setStories] = useState<Story[]>([])
  const [preferences, setPreferences] = useState<ReadingPreferences>(defaultPreferences)
  const [view, setView] = useState<View>(initialView)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [pendingBackup, setPendingBackup] = useState<{ state: AppState; exportedAt: string } | null>(null)
  const [playerState, setPlayerState] = useState<PlayerDisplayState>('minimized')
  const [backupNotice, setBackupNotice] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const saveSequence = useRef(0)
  const pendingPlayerState = useRef<PlayerDisplayState | null>(null)

  useEffect(() => {
    loadState()
      .then((stored) => {
        const state = migrateState(stored, cloneSamples())
        const historyView = isMidnightHistoryState(window.history.state) ? window.history.state.view : { name: 'library' } as View
        const restoredView = validStoredView(historyView, state.stories)
        setStories(state.stories)
        setPreferences(state.preferences)
        setView(restoredView)
        if (!sameView(historyView, restoredView)) {
          window.history.replaceState({ midnightLibrary: true, view: restoredView, scrollY: 0 } satisfies MidnightHistoryState, '')
        }
      })
      .catch(() => {
        const state = migrateState(undefined, cloneSamples())
        setStories(state.stories)
        setPreferences(state.preferences)
        setStorageError(true)
      })
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const sequence = ++saveSequence.current
    const saveTimer = window.setTimeout(() => {
      saveState({ schemaVersion: currentSchemaVersion, stories, preferences })
        .then(() => {
          if (sequence === saveSequence.current) setSaveStatus('saved')
        })
        .catch(() => {
          if (sequence === saveSequence.current) setSaveStatus('error')
          setStorageError(true)
        })
    }, 350)
    return () => window.clearTimeout(saveTimer)
  }, [hydrated, preferences, stories])

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme
    const themeColor = readingThemes.find((theme) => theme.id === preferences.theme)?.colors[0] ?? '#080d19'
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColor)
  }, [preferences.theme])

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    const restoreHistory = (event: PopStateEvent) => {
      if (!isMidnightHistoryState(event.state)) return
      setView(event.state.view)
      setDrawerOpen(event.state.overlay === 'drawer')
      setNotesOpen(event.state.overlay === 'notes')
      const requestedPlayerState = pendingPlayerState.current
      pendingPlayerState.current = null
      setPlayerState((current) => requestedPlayerState ?? (event.state.overlay === 'player' ? 'expanded' : current === 'hidden' ? 'hidden' : 'minimized'))
      setDialog(null)
      setPendingBackup(null)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.scrollTo({ top: event.state.scrollY ?? 0 })
      }))
    }
    window.addEventListener('popstate', restoreHistory)
    return () => window.removeEventListener('popstate', restoreHistory)
  }, [])

  const activeOverlay: HistoryOverlay | undefined = drawerOpen
    ? 'drawer'
    : notesOpen
      ? 'notes'
      : dialog
        ? 'dialog'
        : pendingBackup
          ? 'backup'
          : playerState === 'expanded'
            ? 'player'
            : undefined

  const rememberCurrentScroll = () => {
    if (!isMidnightHistoryState(window.history.state)) return
    window.history.replaceState({ ...window.history.state, scrollY: window.scrollY } satisfies MidnightHistoryState, '')
  }

  const openOverlay = (overlay: HistoryOverlay) => {
    rememberCurrentScroll()
    const nextState: MidnightHistoryState = { midnightLibrary: true, view, overlay, scrollY: window.scrollY }
    if (activeOverlay) window.history.replaceState(nextState, '')
    else window.history.pushState(nextState, '')
    setDrawerOpen(overlay === 'drawer')
    setNotesOpen(overlay === 'notes')
    setPlayerState((current) => overlay === 'player' ? 'expanded' : current === 'hidden' ? 'hidden' : 'minimized')
    if (overlay !== 'dialog') setDialog(null)
    if (overlay !== 'backup') setPendingBackup(null)
  }

  const closeOverlay = (overlay: HistoryOverlay) => {
    if (isMidnightHistoryState(window.history.state) && window.history.state.overlay === overlay) {
      window.history.back()
      return
    }
    if (overlay === 'drawer') setDrawerOpen(false)
    if (overlay === 'notes') setNotesOpen(false)
    if (overlay === 'dialog') setDialog(null)
    if (overlay === 'backup') setPendingBackup(null)
    if (overlay === 'player') setPlayerState('minimized')
  }

  const openDialog = (nextDialog: Exclude<DialogState, null>) => {
    setDialog(nextDialog)
    openOverlay('dialog')
  }

  const openBackup = (state: AppState, exportedAt: string) => {
    setPendingBackup({ state, exportedAt })
    openOverlay('backup')
  }

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (pendingBackup) closeOverlay('backup')
      else if (dialog) closeOverlay('dialog')
      else if (notesOpen) closeNotes()
      else if (drawerOpen) closeOverlay('drawer')
      else if (playerState === 'expanded') closeOverlay('player')
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [dialog, drawerOpen, notesOpen, pendingBackup, playerState])

  useEffect(() => {
    document.body.style.overflow = drawerOpen || dialog || notesOpen || pendingBackup ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [dialog, drawerOpen, notesOpen, pendingBackup])

  const activeStory = useMemo(
    () => ('storyId' in view ? stories.find((story) => story.id === view.storyId) : undefined),
    [stories, view],
  )
  const activeChapter = useMemo(
    () =>
      view.name === 'reader'
        ? activeStory?.chapters.find((chapter) => chapter.id === view.chapterId)
        : undefined,
    [activeStory, view],
  )

  const navigate = (nextView: View) => {
    if (sameView(view, nextView)) {
      if (nextView.name === 'audio') setPlayerState('minimized')
      if (activeOverlay) closeOverlay(activeOverlay)
      return
    }
    rememberCurrentScroll()
    const nextState: MidnightHistoryState = { midnightLibrary: true, view: nextView, scrollY: 0 }
    if (activeOverlay) window.history.replaceState(nextState, '')
    else window.history.pushState(nextState, '')
    setView(nextView)
    setDrawerOpen(false)
    setNotesOpen(false)
    setDialog(null)
    setPendingBackup(null)
    setPlayerState((current) => nextView.name === 'audio' ? 'minimized' : current === 'hidden' ? 'hidden' : 'minimized')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateStory = (storyId: string, transform: (story: Story) => Story) => {
    setSaveStatus('saving')
    setStories((current) =>
      current.map((story) => (story.id === storyId ? transform(story) : story)),
    )
  }

  const updateChapterContent = (storyId: string, chapterId: string, contentHtml: string) => {
    const now = Date.now()
    updateStory(storyId, (story) => ({
      ...story,
      updatedAt: now,
      chapters: story.chapters.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, contentHtml, updatedAt: now } : chapter,
      ),
    }))
  }

  const openNotes = () => {
    setNotesOpen(true)
    openOverlay('notes')
  }

  function closeNotes() {
    closeOverlay('notes')
  }

  const addNote = (storyId: string) => {
    const note: Note = {
      id: crypto.randomUUID(),
      text: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    updateStory(storyId, (story) => ({ ...story, notes: [...(story.notes ?? []), note] }))
    return note.id
  }

  const updateNote = (storyId: string, noteId: string, text: string) => {
    updateStory(storyId, (story) => ({
      ...story,
      notes: (story.notes ?? []).map((note) =>
        note.id === noteId ? { ...note, text, updatedAt: Date.now() } : note,
      ),
    }))
  }

  const deleteNote = (storyId: string, noteId: string) => {
    updateStory(storyId, (story) => ({
      ...story,
      notes: (story.notes ?? []).filter((note) => note.id !== noteId),
    }))
  }

  const restoreBackup = () => {
    if (!pendingBackup) return
    setSaveStatus('saving')
    setStories(pendingBackup.state.stories)
    setPreferences(pendingBackup.state.preferences)
    const libraryView: View = { name: 'library' }
    window.history.replaceState({ midnightLibrary: true, view: libraryView, scrollY: 0 } satisfies MidnightHistoryState, '')
    setPendingBackup(null)
    setDrawerOpen(false)
    setNotesOpen(false)
    setDialog(null)
    setPlayerState((current) => current === 'hidden' ? 'hidden' : 'minimized')
    setView(libraryView)
    setBackupNotice('Backup restored. Your complete library is saved locally.')
    window.setTimeout(() => setBackupNotice(null), 5000)
    window.scrollTo({ top: 0 })
  }

  const handleDialogSubmit = (value?: string, description?: string) => {
    if (!dialog) return
    const title = value?.trim()
    const now = Date.now()
    setSaveStatus('saving')

    if (dialog.type === 'create-story' && title) {
      const story: Story = {
        id: crypto.randomUUID(),
        title,
        description: 'A new story, waiting to unfold.',
        createdAt: now,
        updatedAt: now,
        chapters: [],
        notes: [],
      }
      setStories((current) => [story, ...current])
      navigate({ name: 'story', storyId: story.id })
      return
    }

    if (dialog.type === 'edit-story' && title) {
      updateStory(dialog.storyId, (story) => ({
        ...story,
        title,
        description: description ?? '',
        updatedAt: now,
      }))
    }

    if (dialog.type === 'delete-story') {
      setStories((current) => current.filter((story) => story.id !== dialog.storyId))
      if ('storyId' in view && view.storyId === dialog.storyId) navigate({ name: 'library' })
    }

    if (dialog.type === 'create-chapter' && title) {
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        title,
        contentHtml: '<p></p>',
        createdAt: now,
        updatedAt: now,
      }
      updateStory(dialog.storyId, (story) => ({
        ...story,
        updatedAt: now,
        chapters: [...story.chapters, chapter],
      }))
      navigate({ name: 'reader', storyId: dialog.storyId, chapterId: chapter.id })
      return
    }

    if (dialog.type === 'rename-chapter' && title) {
      updateStory(dialog.storyId, (story) => ({
        ...story,
        updatedAt: now,
        chapters: story.chapters.map((chapter) =>
          chapter.id === dialog.chapterId ? { ...chapter, title, updatedAt: now } : chapter,
        ),
      }))
    }

    if (dialog.type === 'delete-chapter') {
      updateStory(dialog.storyId, (story) => ({
        ...story,
        updatedAt: now,
        chapters: story.chapters.filter((chapter) => chapter.id !== dialog.chapterId),
      }))
      if (view.name === 'reader' && view.chapterId === dialog.chapterId) {
        navigate({ name: 'story', storyId: dialog.storyId })
      }
    }

    closeOverlay('dialog')
  }

  if (!hydrated) {
    return (
      <main className="loading-screen">
        <span className="brand-mark">ML</span>
        <p>Opening the library…</p>
      </main>
    )
  }

  return (
    <div className="app-shell">
      {storageError && (
        <div className="storage-alert" role="alert">
          Local storage is unavailable. Changes may not persist after closing this tab.
        </div>
      )}

      <AppHeader
        activeStory={activeStory}
        view={view}
        onBack={() => window.history.back()}
        onMenu={() => openOverlay('drawer')}
      />

      {view.name === 'library' && (
        <LibraryScreen
          stories={stories}
          onCreate={() => openDialog({ type: 'create-story' })}
          onDelete={(story) =>
            openDialog({ type: 'delete-story', storyId: story.id, title: story.title })
          }
          onOpen={(storyId) => navigate({ name: 'story', storyId })}
          onEdit={(story) =>
            openDialog({
              type: 'edit-story', storyId: story.id, initialTitle: story.title,
              initialDescription: story.description,
            })
          }
        />
      )}

      {view.name === 'story' && activeStory && (
        <StoryScreen
          story={activeStory}
          onEditDetails={() => openDialog({
            type: 'edit-story', storyId: activeStory.id, initialTitle: activeStory.title,
            initialDescription: activeStory.description,
          })}
          onCreate={() => openDialog({ type: 'create-chapter', storyId: activeStory.id })}
          onDelete={(chapter) =>
            openDialog({
              type: 'delete-chapter', storyId: activeStory.id, chapterId: chapter.id, title: chapter.title,
            })
          }
          onOpen={(chapterId) =>
            navigate({ name: 'reader', storyId: activeStory.id, chapterId })
          }
          onRename={(chapter) =>
            openDialog({
              type: 'rename-chapter', storyId: activeStory.id, chapterId: chapter.id, initialValue: chapter.title,
            })
          }
        />
      )}

      {view.name === 'audio' && <AudioLibraryScreen onPlayerRestore={() => setPlayerState((current) => current === 'hidden' ? 'minimized' : current)} />}

      {view.name === 'reader' && activeStory && activeChapter && (
        <ReaderScreen
          chapter={activeChapter}
          preferences={preferences}
          saveStatus={saveStatus}
          story={activeStory}
          onChange={(contentHtml) => updateChapterContent(activeStory.id, activeChapter.id, contentHtml)}
          onOpenNotes={openNotes}
        />
      )}

      <NavigationDrawer
        activeStory={activeStory}
        open={drawerOpen}
        preferences={preferences}
        view={view}
        onClose={() => closeOverlay('drawer')}
        onNavigate={navigate}
        onPreferences={(nextPreferences) => {
          setSaveStatus('saving')
          setPreferences(nextPreferences)
        }}
        onImportReady={openBackup}
        state={{ schemaVersion: currentSchemaVersion, stories, preferences }}
      />

      {dialog && (
        <ActionDialog dialog={dialog} onCancel={() => closeOverlay('dialog')} onSubmit={handleDialogSubmit} />
      )}

      {pendingBackup && (
        <RestoreBackupDialog
          currentStoryCount={stories.length}
          exportedAt={pendingBackup.exportedAt}
          importedState={pendingBackup.state}
          onCancel={() => closeOverlay('backup')}
          onRestore={restoreBackup}
        />
      )}

      {activeStory && (
        <QuickNotesDrawer
          notes={activeStory.notes ?? []}
          open={notesOpen}
          saveStatus={saveStatus}
          storyTitle={activeStory.title}
          onAdd={() => addNote(activeStory.id)}
          onClose={closeNotes}
          onDelete={(noteId) => deleteNote(activeStory.id, noteId)}
          onUpdate={(noteId, text) => updateNote(activeStory.id, noteId, text)}
        />
      )}
      {backupNotice && <div className="success-toast" role="status">{backupNotice}</div>}
      <PwaStatus beforeUpdate={() => saveState({ schemaVersion: currentSchemaVersion, stories, preferences })} />
      <CompactAudioPlayer
        state={playerState}
        onStateChange={(nextState) => {
          if (nextState === 'expanded') {
            openOverlay('player')
            return
          }
          if (playerState === 'expanded' && isMidnightHistoryState(window.history.state) && window.history.state.overlay === 'player') {
            pendingPlayerState.current = nextState
            window.history.back()
            return
          }
          if (nextState === 'hidden') audio.pause()
          setPlayerState(nextState)
        }}
      />
    </div>
  )
}

function AppHeader({
  activeStory, view, onBack, onMenu,
}: {
  activeStory?: Story
  view: View
  onBack: () => void
  onMenu: () => void
}) {
  return (
    <header className="app-header">
      <button
        aria-label={view.name === 'library' ? 'Open navigation menu' : 'Go back'}
        className="icon-button"
        onClick={view.name === 'library' ? onMenu : onBack}
        type="button"
      >
        <Icon name={view.name === 'library' ? 'menu' : 'arrow-left'} />
      </button>
      <button className="header-brand" onClick={() => window.scrollTo({ top: 0 })} type="button">
        <span className="brand-star">✦</span>
        <span>{view.name === 'library' ? 'Midnight Library' : view.name === 'audio' ? 'Audio Library' : activeStory?.title}</span>
      </button>
      <button aria-label="Open reading settings" className="icon-button" onClick={onMenu} type="button">
        <Icon name="settings" />
      </button>
    </header>
  )
}

function LibraryScreen({
  stories, onCreate, onDelete, onEdit, onOpen,
}: {
  stories: Story[]
  onCreate: () => void
  onDelete: (story: Story) => void
  onEdit: (story: Story) => void
  onOpen: (storyId: string) => void
}) {
  return (
    <main className="screen library-screen">
      <section className="library-intro">
        <p className="eyebrow">Your private collection</p>
        <h1>Stories to return to.</h1>
        <p>A quiet place for the worlds you’re building.</p>
      </section>

      <button className="new-story-button" onClick={onCreate} type="button">
        <span className="new-story-icon"><Icon name="plus" size={22} /></span>
        <span><strong>New Story</strong><small>Begin somewhere wonderful</small></span>
        <Icon name="chevron-right" size={18} />
      </button>

      <div className="section-heading">
        <h2>Your library</h2>
        <span>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</span>
      </div>

      {stories.length === 0 ? (
        <EmptyState title="The shelves are waiting" text="Create your first story to begin." onCreate={onCreate} />
      ) : (
        <div className="story-grid">
          {stories.map((story, index) => (
            <article className="story-card" key={story.id}>
              <button className="story-open-area" onClick={() => onOpen(story.id)} type="button">
                <span className={`book-cover cover-${(index % 4) + 1}`}>
                  <span className="cover-ornament">✦</span>
                  <span>{story.title.slice(0, 1).toUpperCase()}</span>
                </span>
                <span className="story-card-content">
                  <span className="story-card-labels">
                    {story.isSample && <span className="sample-badge">Sample</span>}
                    <span>{story.chapters.length} {story.chapters.length === 1 ? 'chapter' : 'chapters'}</span>
                  </span>
                  <strong>{story.title}</strong>
                  <span className="story-description">{story.description}</span>
                  <span className="story-date">Updated {formatDate(story.updatedAt)}</span>
                </span>
              </button>
              <div className="card-actions" aria-label={`Actions for ${story.title}`}>
                <button onClick={() => onEdit(story)} type="button"><Icon name="edit" size={16} /> Details</button>
                <button className="danger-action" onClick={() => onDelete(story)} type="button"><Icon name="trash" size={16} /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}

function StoryScreen({
  story, onCreate, onDelete, onEditDetails, onOpen, onRename,
}: {
  story: Story
  onCreate: () => void
  onDelete: (chapter: Chapter) => void
  onEditDetails: () => void
  onOpen: (chapterId: string) => void
  onRename: (chapter: Chapter) => void
}) {
  return (
    <main className="screen story-screen">
      <section className="story-hero">
        <div className="story-hero-actions">
          {story.isSample && <span className="sample-badge">Sample story</span>}
          <button onClick={onEditDetails} type="button"><Icon name="edit" size={15} /> Edit details</button>
        </div>
        <p className="eyebrow">Story</p>
        <h1>{story.title}</h1>
        {story.description && <p className="story-full-description">{story.description}</p>}
      </section>

      <div className="chapter-heading">
        <div><p className="eyebrow">Contents</p><h2>Chapters</h2></div>
        <button className="compact-gold-button" onClick={onCreate} type="button"><Icon name="plus" size={18} /> New chapter</button>
      </div>

      {story.chapters.length === 0 ? (
        <EmptyState title="No chapters yet" text="Add a chapter when you’re ready." onCreate={onCreate} />
      ) : (
        <ol className="chapter-list">
          {story.chapters.map((chapter, index) => (
            <li className="chapter-row" key={chapter.id}>
              <button className="chapter-open" onClick={() => onOpen(chapter.id)} type="button">
                <span className="chapter-number">{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{chapter.title}</strong><small>{countWords(chapterToHtml(chapter)) ? `${countWords(chapterToHtml(chapter))} words` : 'Empty chapter'}</small></span>
                <Icon name="chevron-right" size={18} />
              </button>
              <div className="chapter-actions">
                <button aria-label={`Rename ${chapter.title}`} onClick={() => onRename(chapter)} type="button"><Icon name="edit" size={17} /></button>
                <button aria-label={`Delete ${chapter.title}`} className="danger-action" onClick={() => onDelete(chapter)} type="button"><Icon name="trash" size={17} /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}

function ReaderScreen({
  chapter, preferences, saveStatus, story, onChange, onOpenNotes,
}: {
  chapter: Chapter
  preferences: ReadingPreferences
  saveStatus: SaveStatus
  story: Story
  onChange: (contentHtml: string) => void
  onOpenNotes: () => void
}) {
  const [editing, setEditing] = useState(false)
  const scrollRatio = useRef(0)
  const contentHtml = chapterToHtml(chapter)
  const pages = useMemo(() => paginateHtml(contentHtml), [contentHtml])

  const switchMode = (nextEditing: boolean) => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollRatio.current = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0
    setEditing(nextEditing)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const nextHeight = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: Math.max(0, scrollRatio.current * nextHeight) })
    }))
  }

  if (editing) {
    return (
      <Suspense fallback={<EditorLoading />}>
        <RichTextEditor
          chapter={chapter}
          contentHtml={contentHtml}
          preferences={preferences}
          saveStatus={saveStatus}
          story={story}
          onChange={onChange}
          onDone={() => switchMode(false)}
        />
      </Suspense>
    )
  }

  return (
    <main
      className="reader-screen"
      style={{ '--reader-font-size': `${preferences.fontSize}px`, '--reader-line-height': preferences.lineHeight } as React.CSSProperties}
    >
      <div className="reader-action-bar">
        <button onClick={() => switchMode(true)} type="button"><Icon name="edit" size={17} /> Edit chapter</button>
        <button aria-label="Open quick notes" onClick={onOpenNotes} type="button"><Icon name="notebook" size={18} /><span>Notes</span></button>
      </div>
      <header className="reader-title">
        {story.isSample && <span className="sample-badge">Sample reading</span>}
        <p>{story.title}</p>
        <h1>{chapter.title}</h1>
        <span className="title-flourish">✦</span>
      </header>

      {countWords(contentHtml) === 0 ? (
        <section className="empty-reading-page">
          <Icon name="book" size={28} />
          <h2>This chapter is empty</h2>
          <p>Choose Edit chapter to begin writing.</p>
        </section>
      ) : (
        <div className="reading-pages">
          {pages.map((pageHtml, pageIndex) => (
            <article className="reading-page" key={`${chapter.id}-${pageIndex}`}>
              <span className="page-ornament" aria-hidden="true">✦</span>
              <div className="rich-reading-content" dangerouslySetInnerHTML={{ __html: pageHtml }} />
              <span className="page-number">{pageIndex + 1}</span>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}

function EditorLoading() {
  return (
    <main className="editor-loading">
      <span className="brand-mark">✦</span>
      <p>Preparing your writing space…</p>
    </main>
  )
}

function paginateHtml(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html
  const blocks = Array.from(container.children)
  if (blocks[0]?.textContent?.startsWith('Sample story')) blocks[0].classList.add('sample-notice')
  const openingParagraph = blocks.find((block) => !block.classList.contains('sample-notice'))
  openingParagraph?.classList.add('opening-paragraph')

  const pages: string[] = []
  for (let index = 0; index < blocks.length; index += 4) {
    pages.push(blocks.slice(index, index + 4).map((block) => block.outerHTML).join(''))
  }
  return pages
}

function NavigationDrawer({
  activeStory, open, preferences, state, view, onClose, onImportReady, onNavigate, onPreferences,
}: {
  activeStory?: Story
  open: boolean
  preferences: ReadingPreferences
  state: AppState
  view: View
  onClose: () => void
  onImportReady: (state: AppState, exportedAt: string) => void
  onNavigate: (view: View) => void
  onPreferences: (preferences: ReadingPreferences) => void
}) {
  const setLineHeight = (lineHeight: number) =>
    onPreferences(normalizePreferences({ ...preferences, lineHeight }))

  return (
    <>
      <button aria-label="Close navigation menu" className={`drawer-scrim ${open ? 'is-open' : ''}`} onClick={onClose} tabIndex={open ? 0 : -1} type="button" />
      <aside aria-hidden={!open} aria-label="Navigation and reading preferences" className={`navigation-drawer ${open ? 'is-open' : ''}`} inert={!open}>
        <div className="drawer-header">
          <div className="drawer-brand"><span>✦</span><strong>Midnight Library</strong></div>
          <button aria-label="Close menu" className="icon-button" onClick={onClose} type="button"><Icon name="x" /></button>
        </div>
        <nav className="drawer-navigation" aria-label="Main navigation">
          <button className={view.name === 'library' ? 'active' : ''} onClick={() => onNavigate({ name: 'library' })} type="button"><Icon name="home" /> Library</button>
          <button className={view.name === 'audio' ? 'active' : ''} onClick={() => onNavigate({ name: 'audio' })} type="button"><Icon name="music" /> Audio Library</button>
          {activeStory && <button className={view.name === 'story' ? 'active' : ''} onClick={() => onNavigate({ name: 'story', storyId: activeStory.id })} type="button"><Icon name="book" /> Story chapters</button>}
        </nav>
        <section className="reading-controls">
          <div className="control-title"><Icon name="settings" size={18} /><span>Reading comfort</span></div>
          <label htmlFor="font-size">Font size <output>{preferences.fontSize}px</output></label>
          <input
            id="font-size"
            max={preferenceLimits.fontSize.max}
            min={preferenceLimits.fontSize.min}
            onChange={(event) => onPreferences(normalizePreferences({ ...preferences, fontSize: Number(event.target.value) }))}
            style={{ '--range-progress': `${((preferences.fontSize - preferenceLimits.fontSize.min) / (preferenceLimits.fontSize.max - preferenceLimits.fontSize.min)) * 100}%` } as React.CSSProperties}
            type="range"
            value={preferences.fontSize}
          />
          <div className="line-control">
            <span>Line spacing</span>
            <div>
              <button aria-label="Decrease line spacing" disabled={preferences.lineHeight <= preferenceLimits.lineHeight.min} onClick={() => setLineHeight(preferences.lineHeight - preferenceLimits.lineHeight.step)} type="button"><Icon name="minus" size={18} /></button>
              <output>{preferences.lineHeight.toFixed(2)}</output>
              <button aria-label="Increase line spacing" disabled={preferences.lineHeight >= preferenceLimits.lineHeight.max} onClick={() => setLineHeight(preferences.lineHeight + preferenceLimits.lineHeight.step)} type="button"><Icon name="plus" size={18} /></button>
            </div>
          </div>
          <fieldset className="theme-control">
            <legend>Color theme</legend>
            <div>
              {readingThemes.map((theme) => (
                <button
                  aria-label={`Use ${theme.name} theme`}
                  aria-pressed={preferences.theme === theme.id}
                  className={preferences.theme === theme.id ? 'active' : ''}
                  key={theme.id}
                  onClick={() => onPreferences(normalizePreferences({ ...preferences, theme: theme.id }))}
                  type="button"
                >
                  <span className="theme-swatches" aria-hidden="true">
                    {theme.colors.map((color) => <i key={color} style={{ background: color }} />)}
                  </span>
                  <span>{theme.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <p className="control-preview" style={{ fontSize: `${Math.min(preferences.fontSize, 20)}px`, lineHeight: preferences.lineHeight }}>The night was quiet, and every page felt like a small illuminated window.</p>
        </section>
        <BackupControls onImportReady={onImportReady} state={state} />
        <p className="drawer-footer">Saved privately on this device</p>
      </aside>
    </>
  )
}

function ActionDialog({
  dialog, onCancel, onSubmit,
}: {
  dialog: Exclude<DialogState, null>
  onCancel: () => void
  onSubmit: (value?: string, description?: string) => void
}) {
  const isDelete = dialog.type.startsWith('delete')
  const isEditStory = dialog.type === 'edit-story'
  const isStory = dialog.type.endsWith('story')
  const initialValue = 'initialValue' in dialog
    ? dialog.initialValue
    : isEditStory ? dialog.initialTitle : ''
  const [value, setValue] = useState(initialValue)
  const [description, setDescription] = useState(isEditStory ? dialog.initialDescription : '')
  const action = dialog.type.startsWith('create') ? 'Create' : isEditStory ? 'Save' : dialog.type.startsWith('rename') ? 'Rename' : 'Delete'
  const heading = isEditStory ? 'Edit story details' : `${action} ${isStory ? 'story' : 'chapter'}`

  return (
    <div aria-labelledby="action-dialog-title" aria-modal="true" className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()} role="dialog">
      <form className="action-dialog" onSubmit={(event) => { event.preventDefault(); onSubmit(value, description) }}>
        <span className={`dialog-icon ${isDelete ? 'delete' : ''}`}><Icon name={isDelete ? 'trash' : isStory ? 'book' : 'edit'} /></span>
        <h2 id="action-dialog-title">{heading}</h2>
        {isDelete ? (
          <p>“{'title' in dialog ? dialog.title : ''}” will be permanently removed from this device.</p>
        ) : (
          <div className="dialog-fields">
            <label>{isStory ? 'Story' : 'Chapter'} title<input autoFocus maxLength={80} onChange={(event) => setValue(event.target.value)} placeholder={isStory ? 'The name of your story' : 'Chapter title'} required value={value} /></label>
            {isEditStory && (
              <label>Description <span>Optional</span><textarea maxLength={1200} onChange={(event) => setDescription(event.target.value)} placeholder="Add a short description…" rows={5} value={description} /></label>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onCancel} type="button">Cancel</button>
          <button className={isDelete ? 'delete-button' : 'gold-button'} disabled={!isDelete && !value.trim()} type={isDelete ? 'button' : 'submit'} onClick={isDelete ? () => onSubmit() : undefined}>{action}</button>
        </div>
      </form>
    </div>
  )
}

function EmptyState({ title, text, onCreate }: { title: string; text: string; onCreate: () => void }) {
  return (
    <section className="empty-state">
      <span><Icon name="book" size={26} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="compact-gold-button" onClick={onCreate} type="button"><Icon name="plus" size={17} /> Create now</button>
    </section>
  )
}

function App() {
  return <AudioProvider><AppContent /></AudioProvider>
}

export default App
