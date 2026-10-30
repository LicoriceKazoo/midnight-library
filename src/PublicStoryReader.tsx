import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { preferenceLimits, readingThemes } from './model'
import { fetchPublishedStory } from './publishingApi'
import { sanitizePastedHtml } from './richText'
import type { PublishedStory } from './publishing'
import type { ReadingTheme } from './types'

export function PublicStoryReader({ publicationId }: { publicationId: string }) {
  const [story, setStory] = useState<PublishedStory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ReadingTheme>('midnight')
  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.75)

  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme
    document.documentElement.dataset.theme = theme
    return () => {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme
      else delete document.documentElement.dataset.theme
    }
  }, [theme])

  useEffect(() => {
    const previousTitle = document.title
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const createdRobots = !robots
    robots ??= document.head.appendChild(document.createElement('meta'))
    robots.name = 'robots'
    robots.content = 'noindex, nofollow, noarchive'
    return () => {
      document.title = previousTitle
      if (createdRobots) robots.remove()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchPublishedStory(publicationId)
      .then((published) => {
        if (!controller.signal.aborted) {
          setStory(published)
          document.title = `${published.title} — The Midnight Library`
        }
      })
      .catch((reason) => !controller.signal.aborted && setError(reason instanceof Error ? reason.message : 'This story is unavailable.'))
    return () => controller.abort()
  }, [publicationId])

  if (error) return (
    <main className="public-story-state">
      <span className="brand-mark">✦</span>
      <h1>This story is unavailable</h1>
      <p>It may have been unpublished, or the link may be incomplete.</p>
    </main>
  )
  if (!story) return <main className="public-story-state"><span className="brand-mark">✦</span><p>Opening the shared story…</p></main>

  return (
    <div className="public-reader-shell" style={{ '--reader-font-size': `${fontSize}px`, '--reader-line-height': lineHeight } as React.CSSProperties}>
      <header className="public-reader-header">
        <a href="/" aria-label="The Midnight Library home"><span>✦</span> The Midnight Library</a>
        <details>
          <summary><Icon name="settings" size={18} /> Reading comfort</summary>
          <div className="public-reading-controls">
            <label>Font size <output>{fontSize}px</output><input aria-label="Shared story font size" max={preferenceLimits.fontSize.max} min={preferenceLimits.fontSize.min} onChange={(event) => setFontSize(Number(event.target.value))} type="range" value={fontSize} /></label>
            <div className="line-control"><span>Line spacing</span><div><button aria-label="Decrease shared story line spacing" disabled={lineHeight <= preferenceLimits.lineHeight.min} onClick={() => setLineHeight((value) => Math.max(preferenceLimits.lineHeight.min, Number((value - .5).toFixed(2))))} type="button">−</button><output>{lineHeight.toFixed(2)}</output><button aria-label="Increase shared story line spacing" disabled={lineHeight >= preferenceLimits.lineHeight.max} onClick={() => setLineHeight((value) => Math.min(preferenceLimits.lineHeight.max, Number((value + .5).toFixed(2))))} type="button">+</button></div></div>
            <div className="public-theme-options" aria-label="Shared story theme">
              {readingThemes.map((option) => <button aria-label={`Use ${option.name} theme`} aria-pressed={theme === option.id} key={option.id} onClick={() => setTheme(option.id)} style={{ background: `linear-gradient(90deg, ${option.colors.join(', ')})` }} type="button"><span>{option.name}</span></button>)}
            </div>
          </div>
        </details>
      </header>

      <main className="public-story">
        <header className="public-story-title">
          <p>Shared from The Midnight Library</p>
          <h1>{story.title}</h1>
          {story.description && <div>{story.description}</div>}
          <span>✦</span>
        </header>
        <nav aria-label="Published chapters" className="public-chapter-nav">
          {story.chapters.map((chapter, index) => <a href={`#chapter-${index + 1}`} key={chapter.id}><small>{String(index + 1).padStart(2, '0')}</small>{chapter.title}</a>)}
        </nav>
        <div className="public-chapters">
          {story.chapters.map((chapter, index) => (
            <article id={`chapter-${index + 1}`} key={chapter.id}>
              <header><span>Chapter {index + 1}</span><h2>{chapter.title}</h2></header>
              <div className="rich-reading-content" dangerouslySetInnerHTML={{ __html: sanitizePastedHtml(chapter.contentHtml) }} />
            </article>
          ))}
        </div>
        <footer className="public-story-footer">✦ Read-only snapshot published {new Date(story.updatedAt).toLocaleDateString()}</footer>
      </main>
    </div>
  )
}
