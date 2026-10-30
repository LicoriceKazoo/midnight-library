import { useState } from 'react'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Icon } from './Icon'
import { countWords } from './model'
import { SaveIndicator } from './SaveIndicator'
import type { Chapter, ReadingPreferences, SaveStatus, Story } from './types'

const colors = ['#f3ead7', '#e4c57d', '#dda6a6', '#a9c8c0', '#aebde0']

export function RichTextEditor({
  chapter,
  contentHtml,
  preferences,
  saveStatus,
  story,
  onChange,
  onDone,
}: {
  chapter: Chapter
  contentHtml: string
  preferences: ReadingPreferences
  saveStatus: SaveStatus
  story: Story
  onChange: (html: string) => void
  onDone: () => void
}) {
  const [wordCount, setWordCount] = useState(() => countWords(contentHtml))
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color],
    content: contentHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'chapter-editor-content',
        'aria-label': `Edit ${chapter.title}`,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      setWordCount(countWords(html))
      onChange(html)
    },
  })

  if (!editor) return null

  const run = (command: () => void) => (event: React.MouseEvent) => {
    event.preventDefault()
    command()
  }

  return (
    <main
      className="editor-screen"
      style={{ '--reader-font-size': `${preferences.fontSize}px`, '--reader-line-height': preferences.lineHeight } as React.CSSProperties}
    >
      <header className="editor-heading">
        <div>
          <p>{story.title}</p>
          <h1>{chapter.title}</h1>
        </div>
        <button className="reading-mode-button" onClick={onDone} type="button">
          <Icon name="book" size={18} /> Reading mode
        </button>
      </header>

      <div aria-label="Text formatting" className="editor-toolbar" role="toolbar">
        <div className="format-buttons">
          <button
            aria-label="Bold"
            aria-pressed={editor.isActive('bold')}
            className={editor.isActive('bold') ? 'active' : ''}
            onMouseDown={run(() => editor.chain().focus().toggleBold().run())}
            type="button"
          >
            <strong>B</strong>
          </button>
          <button
            aria-label="Italic"
            aria-pressed={editor.isActive('italic')}
            className={editor.isActive('italic') ? 'active' : ''}
            onMouseDown={run(() => editor.chain().focus().toggleItalic().run())}
            type="button"
          >
            <em>I</em>
          </button>
          <button
            aria-label="Heading"
            aria-pressed={editor.isActive('heading', { level: 2 })}
            className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
            onMouseDown={run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            type="button"
          >
            H2
          </button>
          <span className="toolbar-divider" />
          <button aria-label="Undo" disabled={!editor.can().undo()} onMouseDown={run(() => editor.chain().focus().undo().run())} type="button">
            <Icon name="undo" size={18} />
          </button>
          <button aria-label="Redo" disabled={!editor.can().redo()} onMouseDown={run(() => editor.chain().focus().redo().run())} type="button">
            <Icon name="redo" size={18} />
          </button>
        </div>
        <div className="color-picker" aria-label="Text color">
          <span>Color</span>
          {colors.map((color) => (
            <button
              aria-label={`Set text color ${color}`}
              className={editor.isActive('textStyle', { color }) ? 'active' : ''}
              key={color}
              onMouseDown={run(() => editor.chain().focus().setColor(color).run())}
              style={{ '--swatch': color } as React.CSSProperties}
              type="button"
            />
          ))}
          <button aria-label="Clear text color" className="clear-color" onMouseDown={run(() => editor.chain().focus().unsetColor().run())} type="button">×</button>
        </div>
      </div>

      <section className="editor-paper">
        <EditorContent editor={editor} />
      </section>

      <footer className="editor-status-bar">
        <span>{wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}</span>
        <SaveIndicator status={saveStatus} />
      </footer>
    </main>
  )
}
