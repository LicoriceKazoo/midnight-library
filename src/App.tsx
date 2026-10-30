import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { defaultPreferences, sampleStories } from './sampleData'
import { loadState, saveState } from './storage'
import type { Chapter, ReadingPreferences, Story, View } from './types'
import './App.css'

type DialogState =
  | { type: 'create-story' }
  | { type: 'rename-story'; storyId: string; initialValue: string }
  | { type: 'delete-story'; storyId: string; title: string }
  | { type: 'create-chapter'; storyId: string }
  | { type: 'rename-chapter'; storyId: string; chapterId: string; initialValue: string }
  | { type: 'delete-chapter'; storyId: string; chapterId: string; title: string }
  | null

const cloneSamples = () => structuredClone(sampleStories)

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp)
}

function App() {
  const [stories, setStories] = useState<Story[]>([])
  const [preferences, setPreferences] = useState<ReadingPreferences>(defaultPreferences)
  const [view, setView] = useState<View>({ name: 'library' })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [hydrated, setHydrated] = useState(false)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    loadState()
      .then((stored) => {
        setStories(stored?.stories ?? cloneSamples())
        setPreferences(stored?.preferences ?? defaultPreferences)
      })
      .catch(() => {
        setStories(cloneSamples())
        setStorageError(true)
      })
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveState({ stories, preferences }).catch(() => setStorageError(true))
  }, [hydrated, preferences, stories])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (dialog) setDialog(null)
      else setDrawerOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [dialog])

  useEffect(() => {
    document.body.style.overflow = drawerOpen || dialog ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [dialog, drawerOpen])

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
    setView(nextView)
    setDrawerOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateStory = (storyId: string, transform: (story: Story) => Story) => {
    setStories((current) =>
      current.map((story) => (story.id === storyId ? transform(story) : story)),
    )
  }

  const handleDialogSubmit = (value?: string) => {
    if (!dialog) return
    const title = value?.trim()
    const now = Date.now()

    if (dialog.type === 'create-story' && title) {
      const story: Story = {
        id: crypto.randomUUID(),
        title,
        description: 'A new story, waiting to unfold.',
        createdAt: now,
        updatedAt: now,
        chapters: [],
      }
      setStories((current) => [story, ...current])
      setDialog(null)
      navigate({ name: 'story', storyId: story.id })
      return
    }

    if (dialog.type === 'rename-story' && title) {
      updateStory(dialog.storyId, (story) => ({ ...story, title, updatedAt: now }))
    }

    if (dialog.type === 'delete-story') {
      setStories((current) => current.filter((story) => story.id !== dialog.storyId))
      if ('storyId' in view && view.storyId === dialog.storyId) navigate({ name: 'library' })
    }

    if (dialog.type === 'create-chapter' && title) {
      const chapter: Chapter = {
        id: crypto.randomUUID(),
        title,
        paragraphs: [],
        createdAt: now,
        updatedAt: now,
      }
      updateStory(dialog.storyId, (story) => ({
        ...story,
        updatedAt: now,
        chapters: [...story.chapters, chapter],
      }))
      setDialog(null)
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

    setDialog(null)
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
        onBack={() =>
          navigate(
            view.name === 'reader' && activeStory
              ? { name: 'story', storyId: activeStory.id }
              : { name: 'library' },
          )
        }
        onMenu={() => setDrawerOpen(true)}
      />

      {view.name === 'library' && (
        <LibraryScreen
          stories={stories}
          onCreate={() => setDialog({ type: 'create-story' })}
          onDelete={(story) =>
            setDialog({ type: 'delete-story', storyId: story.id, title: story.title })
          }
          onOpen={(storyId) => navigate({ name: 'story', storyId })}
          onRename={(story) =>
            setDialog({ type: 'rename-story', storyId: story.id, initialValue: story.title })
          }
        />
      )}

      {view.name === 'story' && activeStory && (
        <StoryScreen
          story={activeStory}
          onCreate={() => setDialog({ type: 'create-chapter', storyId: activeStory.id })}
          onDelete={(chapter) =>
            setDialog({
              type: 'delete-chapter', storyId: activeStory.id, chapterId: chapter.id, title: chapter.title,
            })
          }
          onOpen={(chapterId) =>
            navigate({ name: 'reader', storyId: activeStory.id, chapterId })
          }
          onRename={(chapter) =>
            setDialog({
              type: 'rename-chapter', storyId: activeStory.id, chapterId: chapter.id, initialValue: chapter.title,
            })
          }
        />
      )}

      {view.name === 'reader' && activeStory && activeChapter && (
        <ReaderScreen chapter={activeChapter} preferences={preferences} story={activeStory} />
      )}

      <NavigationDrawer
        activeStory={activeStory}
        open={drawerOpen}
        preferences={preferences}
        view={view}
        onClose={() => setDrawerOpen(false)}
        onNavigate={navigate}
        onPreferences={setPreferences}
      />

      {dialog && (
        <ActionDialog dialog={dialog} onCancel={() => setDialog(null)} onSubmit={handleDialogSubmit} />
      )}
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
        <span>{view.name === 'library' ? 'Midnight Library' : activeStory?.title}</span>
      </button>
      <button aria-label="Open reading settings" className="icon-button" onClick={onMenu} type="button">
        <Icon name="settings" />
      </button>
    </header>
  )
}

function LibraryScreen({
  stories, onCreate, onDelete, onOpen, onRename,
}: {
  stories: Story[]
  onCreate: () => void
  onDelete: (story: Story) => void
  onOpen: (storyId: string) => void
  onRename: (story: Story) => void
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
                <button onClick={() => onRename(story)} type="button"><Icon name="edit" size={16} /> Rename</button>
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
  story, onCreate, onDelete, onOpen, onRename,
}: {
  story: Story
  onCreate: () => void
  onDelete: (chapter: Chapter) => void
  onOpen: (chapterId: string) => void
  onRename: (chapter: Chapter) => void
}) {
  return (
    <main className="screen story-screen">
      <section className="story-hero">
        {story.isSample && <span className="sample-badge">Sample story</span>}
        <p className="eyebrow">Story</p>
        <h1>{story.title}</h1>
        <p>{story.description}</p>
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
                <span><strong>{chapter.title}</strong><small>{chapter.paragraphs.length ? `${chapter.paragraphs.length} passages` : 'Empty chapter'}</small></span>
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
  chapter, preferences, story,
}: {
  chapter: Chapter
  preferences: ReadingPreferences
  story: Story
}) {
  const pageSize = 4
  const pages = Array.from(
    { length: Math.ceil(chapter.paragraphs.length / pageSize) },
    (_, index) => chapter.paragraphs.slice(index * pageSize, index * pageSize + pageSize),
  )

  return (
    <main
      className="reader-screen"
      style={{ '--reader-font-size': `${preferences.fontSize}px`, '--reader-line-height': preferences.lineHeight } as React.CSSProperties}
    >
      <header className="reader-title">
        {story.isSample && <span className="sample-badge">Sample reading</span>}
        <p>{story.title}</p>
        <h1>{chapter.title}</h1>
        <span className="title-flourish">✦</span>
      </header>

      {pages.length === 0 ? (
        <section className="empty-reading-page">
          <Icon name="book" size={28} />
          <h2>This chapter is empty</h2>
          <p>Story editing tools will arrive in the next milestone.</p>
        </section>
      ) : (
        <div className="reading-pages">
          {pages.map((paragraphs, pageIndex) => (
            <article className="reading-page" key={`${chapter.id}-${pageIndex}`}>
              <span className="page-ornament" aria-hidden="true">✦</span>
              {paragraphs.map((paragraph, index) =>
                pageIndex === 0 && index === 0 ? (
                  <p className="sample-notice" key={paragraph}>{paragraph}</p>
                ) : (
                  <p className={pageIndex === 0 && index === 1 ? 'opening-paragraph' : ''} key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
                ),
              )}
              <span className="page-number">{pageIndex + 1}</span>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}

function NavigationDrawer({
  activeStory, open, preferences, view, onClose, onNavigate, onPreferences,
}: {
  activeStory?: Story
  open: boolean
  preferences: ReadingPreferences
  view: View
  onClose: () => void
  onNavigate: (view: View) => void
  onPreferences: (preferences: ReadingPreferences) => void
}) {
  const setLineHeight = (lineHeight: number) =>
    onPreferences({ ...preferences, lineHeight: Math.min(2.15, Math.max(1.35, lineHeight)) })

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
          {activeStory && <button className={view.name === 'story' ? 'active' : ''} onClick={() => onNavigate({ name: 'story', storyId: activeStory.id })} type="button"><Icon name="book" /> Story chapters</button>}
        </nav>
        <section className="reading-controls">
          <div className="control-title"><Icon name="settings" size={18} /><span>Reading comfort</span></div>
          <label htmlFor="font-size">Font size <output>{preferences.fontSize}px</output></label>
          <input id="font-size" max="24" min="15" onChange={(event) => onPreferences({ ...preferences, fontSize: Number(event.target.value) })} type="range" value={preferences.fontSize} />
          <div className="line-control">
            <span>Line spacing</span>
            <div>
              <button aria-label="Decrease line spacing" disabled={preferences.lineHeight <= 1.35} onClick={() => setLineHeight(preferences.lineHeight - 0.2)} type="button"><Icon name="minus" size={18} /></button>
              <output>{preferences.lineHeight.toFixed(2)}</output>
              <button aria-label="Increase line spacing" disabled={preferences.lineHeight >= 2.15} onClick={() => setLineHeight(preferences.lineHeight + 0.2)} type="button"><Icon name="plus" size={18} /></button>
            </div>
          </div>
          <p className="control-preview" style={{ fontSize: `${Math.min(preferences.fontSize, 20)}px`, lineHeight: preferences.lineHeight }}>The night was quiet, and every page felt like a small illuminated window.</p>
        </section>
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
  onSubmit: (value?: string) => void
}) {
  const isDelete = dialog.type.startsWith('delete')
  const isStory = dialog.type.endsWith('story')
  const initialValue = 'initialValue' in dialog ? dialog.initialValue : ''
  const [value, setValue] = useState(initialValue)
  const action = dialog.type.startsWith('create') ? 'Create' : dialog.type.startsWith('rename') ? 'Rename' : 'Delete'

  return (
    <div aria-labelledby="action-dialog-title" aria-modal="true" className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()} role="dialog">
      <form className="action-dialog" onSubmit={(event) => { event.preventDefault(); onSubmit(value) }}>
        <span className={`dialog-icon ${isDelete ? 'delete' : ''}`}><Icon name={isDelete ? 'trash' : isStory ? 'book' : 'edit'} /></span>
        <h2 id="action-dialog-title">{action} {isStory ? 'story' : 'chapter'}</h2>
        {isDelete ? (
          <p>“{'title' in dialog ? dialog.title : ''}” will be permanently removed from this device.</p>
        ) : (
          <label>{isStory ? 'Story' : 'Chapter'} title<input autoFocus maxLength={80} onChange={(event) => setValue(event.target.value)} placeholder={isStory ? 'The name of your story' : 'Chapter title'} required value={value} /></label>
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

export default App
