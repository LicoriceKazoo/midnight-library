import { useEffect, useRef, useState } from 'react'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension, type Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Icon } from './Icon'
import { countWords } from './model'
import { sanitizePastedHtml } from './richText'
import { SaveIndicator } from './SaveIndicator'
import type { Chapter, ReadingPreferences, SaveStatus, Story } from './types'

const colors = ['#f3ead7', '#e4c57d', '#dda6a6', '#a9c8c0', '#aebde0']

const ParagraphIndentation = Extension.create({
  name: 'paragraphIndentation',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => Math.max(0, Math.min(4, Number(element.getAttribute('data-indent')) || 0)),
          renderHTML: (attributes) => attributes.indent ? { 'data-indent': String(attributes.indent) } : {},
        },
        firstLineIndent: {
          default: false,
          parseHTML: (element) => element.getAttribute('data-first-line-indent') === 'true',
          renderHTML: (attributes) => attributes.firstLineIndent ? { 'data-first-line-indent': 'true' } : {},
        },
      },
    }]
  },
})

function selectedParagraphs(editor: Editor) {
  const positions = new Map<number, { indent: number; firstLineIndent: boolean }>()
  const { from, to } = editor.state.selection
  editor.state.doc.nodesBetween(from, to, (node, position) => {
    if (node.type.name === 'paragraph') {
      positions.set(position, {
        indent: Number(node.attrs.indent) || 0,
        firstLineIndent: Boolean(node.attrs.firstLineIndent),
      })
    }
  })
  return positions
}

function changeParagraphIndent(editor: Editor, amount: number) {
  const paragraphs = selectedParagraphs(editor)
  let transaction = editor.state.tr
  paragraphs.forEach((attributes, position) => {
    transaction = transaction.setNodeMarkup(position, undefined, {
      ...editor.state.doc.nodeAt(position)?.attrs,
      indent: Math.max(0, Math.min(4, attributes.indent + amount)),
    })
  })
  if (transaction.docChanged) editor.view.dispatch(transaction.scrollIntoView())
}

function toggleFirstLineIndent(editor: Editor) {
  const paragraphs = selectedParagraphs(editor)
  const nextValue = ![...paragraphs.values()].every((attributes) => attributes.firstLineIndent)
  let transaction = editor.state.tr
  paragraphs.forEach((_attributes, position) => {
    transaction = transaction.setNodeMarkup(position, undefined, {
      ...editor.state.doc.nodeAt(position)?.attrs,
      firstLineIndent: nextValue,
    })
  })
  if (transaction.docChanged) editor.view.dispatch(transaction.scrollIntoView())
}

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
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const selectedRange = useRef({ from: 0, to: 0 })
  const fullViewportHeight = useRef(window.visualViewport?.height ?? window.innerHeight)
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, ParagraphIndentation],
    content: contentHtml,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'chapter-editor-content',
        'aria-label': `Edit ${chapter.title}`,
      },
      transformPastedHTML: sanitizePastedHtml,
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      selectedRange.current = {
        from: currentEditor.state.selection.from,
        to: currentEditor.state.selection.to,
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      setWordCount(countWords(html))
      onChange(html)
    },
  })

  useEffect(() => {
    const viewport = window.visualViewport
    let settleTimer = 0

    const updateKeyboardState = () => {
      const viewportHeight = viewport?.height ?? window.innerHeight
      const editorFocused = Boolean(document.activeElement?.closest('.chapter-editor-content'))
      if (!editorFocused) fullViewportHeight.current = Math.max(fullViewportHeight.current, viewportHeight)
      const nextOpen = editorFocused && fullViewportHeight.current - viewportHeight > 120
      setKeyboardOpen(nextOpen)

      if (nextOpen) {
        window.requestAnimationFrame(() => {
          const selection = window.getSelection()
          if (!selection?.rangeCount) return
          const cursor = selection.getRangeAt(0).getBoundingClientRect()
          const visibleBottom = viewportHeight - 24
          if (cursor.bottom > visibleBottom) window.scrollBy({ top: cursor.bottom - visibleBottom + 40 })
        })
      }
    }

    const scheduleUpdate = () => {
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(updateKeyboardState, 40)
    }

    viewport?.addEventListener('resize', scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)
    document.addEventListener('focusin', scheduleUpdate)
    document.addEventListener('focusout', scheduleUpdate)
    return () => {
      window.clearTimeout(settleTimer)
      viewport?.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      document.removeEventListener('focusin', scheduleUpdate)
      document.removeEventListener('focusout', scheduleUpdate)
    }
  }, [])

  if (!editor) return null

  const run = (command: () => void) => (event: React.MouseEvent) => {
    event.preventDefault()
    command()
  }

  const applyColor = (color?: string) => (event: React.MouseEvent) => {
    event.preventDefault()
    const range = selectedRange.current
    const chain = editor.chain().setTextSelection(range).focus()
    if (color) chain.setColor(color).run()
    else chain.unsetColor().run()
  }

  return (
    <main
      className={`editor-screen ${keyboardOpen ? 'keyboard-open' : ''}`}
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
            aria-expanded={paletteOpen}
            aria-label="Text colors"
            aria-pressed={paletteOpen}
            className={paletteOpen ? 'active' : ''}
            onMouseDown={(event) => {
              event.preventDefault()
              selectedRange.current = { from: editor.state.selection.from, to: editor.state.selection.to }
              setPaletteOpen((open) => !open)
            }}
            type="button"
          >
            <Icon name="palette" size={18} />
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
          <span className="toolbar-divider" />
          <button aria-label="Outdent paragraphs" onMouseDown={run(() => changeParagraphIndent(editor, -1))} type="button"><Icon name="outdent" size={18} /></button>
          <button aria-label="Indent paragraphs" onMouseDown={run(() => changeParagraphIndent(editor, 1))} type="button"><Icon name="indent" size={18} /></button>
          <button aria-label="Toggle first-line indent" onMouseDown={run(() => toggleFirstLineIndent(editor))} type="button"><Icon name="first-line-indent" size={18} /></button>
        </div>
        <div aria-hidden={!paletteOpen} className={`color-picker ${paletteOpen ? 'is-open' : ''}`} inert={!paletteOpen} aria-label="Text color">
          <span>Color</span>
          {colors.map((color) => (
            <button
              aria-label={`Set text color ${color}`}
              className={editor.isActive('textStyle', { color }) ? 'active' : ''}
              key={color}
              onMouseDown={applyColor(color)}
              style={{ '--swatch': color } as React.CSSProperties}
              type="button"
            />
          ))}
          <button aria-label="Clear text color" className="clear-color" onMouseDown={applyColor()} type="button">×</button>
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
