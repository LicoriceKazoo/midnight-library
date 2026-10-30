import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { buildPublishedStoryPayload } from './publishing'
import { shareUrl } from './publishingClient'
import { getPublisherToken, loadPublisherIdentity } from './publisherAuth'
import { publishStory, unpublishStory } from './publishingApi'
import { sanitizePastedHtml } from './richText'
import type { Story, StoryPublication } from './types'

type PendingAction = 'publish' | 'unpublish' | null

export function ShareStoryDialog({
  story,
  onClose,
  onPublication,
}: {
  story: Story
  onClose: () => void
  onPublication: (publication?: StoryPublication) => void
}) {
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>(
    story.publication?.chapterIds.filter((id) => story.chapters.some((chapter) => chapter.id === id))
      ?? story.chapters.map((chapter) => chapter.id),
  )
  const [preview, setPreview] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const payload = useMemo(() => buildPublishedStoryPayload(story, selectedChapterIds), [selectedChapterIds, story])
  const publicationLink = story.publication ? shareUrl(story.publication.id) : null

  useEffect(() => {
    let active = true
    let loadedIdentity: Awaited<ReturnType<typeof loadPublisherIdentity>> | null = null
    const update = () => loadedIdentity && setSignedIn(Boolean(loadedIdentity.currentUser()))
    void loadPublisherIdentity().then((identity) => {
      if (!active) return
      loadedIdentity = identity
      setSignedIn(Boolean(identity.currentUser()))
      identity.on('login', update)
      identity.on('logout', update)
    }).catch(() => active && setMessage('Publisher sign-in is unavailable until this site is connected to Netlify Identity.'))
    return () => {
      active = false
      loadedIdentity?.off('login', update)
      loadedIdentity?.off('logout', update)
    }
  }, [])

  const requireToken = async () => {
    const token = await getPublisherToken()
    if (!token) {
      setMessage('Sign in with the authorized publisher identity before publishing.')
      return null
    }
    return token
  }

  const confirmPublish = async () => {
    setWorking(true)
    setMessage(null)
    try {
      const token = await requireToken()
      if (!token) return
      const published = await publishStory(payload, token, story.publication?.id)
      const timestamp = Date.parse(published.updatedAt)
      onPublication({
        id: published.id,
        publishedAt: Date.parse(published.publishedAt),
        updatedAt: Number.isFinite(timestamp) ? timestamp : Date.now(),
        chapterIds: [...selectedChapterIds],
      })
      setPendingAction(null)
      setMessage(story.publication ? 'Published snapshot updated.' : 'Story published. The link is ready to share.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The story could not be published.')
    } finally {
      setWorking(false)
    }
  }

  const confirmUnpublish = async () => {
    if (!story.publication) return
    setWorking(true)
    setMessage(null)
    try {
      const token = await requireToken()
      if (!token) return
      await unpublishStory(story.publication.id, token)
      onPublication(undefined)
      setPendingAction(null)
      setMessage('Story unpublished. The normal share link no longer opens it.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The story could not be unpublished.')
    } finally {
      setWorking(false)
    }
  }

  const copyLink = async () => {
    if (!publicationLink) return
    try {
      await navigator.clipboard.writeText(publicationLink)
      setMessage('Share link copied.')
    } catch {
      setMessage(`Copy this link: ${publicationLink}`)
    }
  }

  const openPublisherLogin = async () => {
    try {
      const identity = await loadPublisherIdentity()
      identity.open('login')
    } catch {
      setMessage('Publisher sign-in is unavailable until this site is connected to Netlify Identity.')
    }
  }

  const signOutPublisher = async () => {
    try {
      await (await loadPublisherIdentity()).logout()
      setMessage('Publisher signed out. Local writing remains available.')
    } catch {
      setMessage('The publisher session could not be closed. Please try again.')
    }
  }

  return (
    <div aria-labelledby="share-story-title" aria-modal="true" className="dialog-backdrop" role="dialog">
      <section className="share-story-dialog">
        <header className="share-dialog-header">
          <div>
            <p className="eyebrow">Read-only snapshot</p>
            <h2 id="share-story-title">Share “{story.title}”</h2>
          </div>
          <button aria-label="Close sharing" className="icon-button" onClick={onClose} type="button"><Icon name="x" /></button>
        </header>

        <div className="publication-status">
          <span className={story.publication ? 'is-published' : ''} />
          <strong>{story.publication ? 'Published' : 'Private on this device'}</strong>
          {story.publication && <small>Snapshot updated {new Date(story.publication.updatedAt).toLocaleDateString()}</small>}
        </div>

        <p className="snapshot-explanation">Publishing uploads only this story and the chapters checked below. It does not continuously synchronize edits. Notes, audio, other stories, and unchecked chapters stay on this device.</p>

        <fieldset className="publish-chapter-picker">
          <legend>Chapters to publish</legend>
          {story.chapters.length ? story.chapters.map((chapter, index) => (
            <label key={chapter.id}>
              <input
                checked={selectedChapterIds.includes(chapter.id)}
                onChange={(event) => setSelectedChapterIds((current) => event.target.checked
                  ? [...current, chapter.id]
                  : current.filter((id) => id !== chapter.id))}
                type="checkbox"
              />
              <span><small>Chapter {index + 1}</small>{chapter.title}</span>
            </label>
          )) : <p>Create a chapter before publishing this story.</p>}
        </fieldset>

        <button className="preview-publication-button" disabled={!payload.chapters.length} onClick={() => setPreview((current) => !current)} type="button">
          <Icon name="book" size={17} /> {preview ? 'Hide published preview' : 'Preview published version'}
        </button>

        {preview && (
          <section className="publication-preview" aria-label="Published story preview">
            <h3>{payload.title}</h3>
            {payload.description && <p>{payload.description}</p>}
            {payload.chapters.map((chapter) => (
              <article key={chapter.id}>
                <h4>{chapter.title}</h4>
                <div className="rich-reading-content" dangerouslySetInnerHTML={{ __html: sanitizePastedHtml(chapter.contentHtml) }} />
              </article>
            ))}
          </section>
        )}

        {publicationLink && (
          <div className="publication-link">
            <span>{publicationLink}</span>
            <button onClick={() => void copyLink()} type="button">Copy link</button>
            <a href={publicationLink} rel="noreferrer" target="_blank">Open <Icon name="external-link" size={14} /></a>
          </div>
        )}

        {message && <p className="share-message" role="status">{message}</p>}

        {!signedIn && <button className="publisher-login" onClick={() => void openPublisherLogin()} type="button">Publisher sign in</button>}
        {signedIn && <div className="publisher-session"><span>Publisher signed in</span><button onClick={() => void signOutPublisher()} type="button">Sign out</button></div>}

        {pendingAction ? (
          <div className="publication-confirmation" role="alert">
            <p>{pendingAction === 'unpublish'
              ? 'Unpublish this story? The normal link will stop working, but copies already downloaded by readers cannot be revoked.'
              : `Publish a snapshot containing ${payload.chapters.length} selected ${payload.chapters.length === 1 ? 'chapter' : 'chapters'}?`}</p>
            <div>
              <button disabled={working} onClick={() => setPendingAction(null)} type="button">Cancel</button>
              <button className={pendingAction === 'unpublish' ? 'delete-button' : 'gold-button'} disabled={working} onClick={() => void (pendingAction === 'unpublish' ? confirmUnpublish() : confirmPublish())} type="button">
                {working ? 'Working…' : pendingAction === 'unpublish' ? 'Confirm unpublish' : story.publication ? 'Confirm republish' : 'Confirm publish'}
              </button>
            </div>
          </div>
        ) : (
          <footer className="share-actions">
            {story.publication && <button className="secondary-button" onClick={() => setPendingAction('unpublish')} type="button">Unpublish</button>}
            <button className="gold-button" disabled={!payload.chapters.length || working} onClick={() => setPendingAction('publish')} type="button">
              <Icon name="share" size={17} /> {story.publication ? 'Republish edits' : 'Publish story'}
            </button>
          </footer>
        )}
      </section>
    </div>
  )
}
