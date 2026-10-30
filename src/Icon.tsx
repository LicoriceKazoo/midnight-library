import type { ReactNode } from 'react'

type IconName =
  | 'archive'
  | 'arrow-left'
  | 'book'
  | 'chevron-right'
  | 'download'
  | 'edit'
  | 'home'
  | 'menu'
  | 'minus'
  | 'notebook'
  | 'plus'
  | 'redo'
  | 'settings'
  | 'trash'
  | 'undo'
  | 'upload'
  | 'x'

const paths: Record<IconName, ReactNode> = {
  archive: <><path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6" /></>,
  'arrow-left': <path d="m15 18-6-6 6-6" />,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  minus: <path d="M5 12h14" />,
  notebook: <><path d="M6 3h14v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 3v18M11 8h6M11 12h6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  redo: <><path d="m17 7 4 4-4 4" /><path d="M3 17v-2a4 4 0 0 1 4-4h14" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" /></>,
  undo: <><path d="m7 7-4 4 4 4" /><path d="M21 17v-2a4 4 0 0 0-4-4H3" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 21h14" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">{paths[name]}</g>
    </svg>
  )
}
