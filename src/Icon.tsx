import type { ReactNode } from 'react'

type IconName =
  | 'archive'
  | 'arrow-left'
  | 'book'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-up'
  | 'download'
  | 'edit'
  | 'external-link'
  | 'home'
  | 'indent'
  | 'outdent'
  | 'first-line-indent'
  | 'menu'
  | 'minus'
  | 'music'
  | 'notebook'
  | 'palette'
  | 'pause'
  | 'play'
  | 'playlist'
  | 'plus'
  | 'redo'
  | 'repeat'
  | 'repeat-one'
  | 'settings'
  | 'share'
  | 'shuffle'
  | 'skip-back'
  | 'skip-forward'
  | 'trash'
  | 'undo'
  | 'upload'
  | 'volume'
  | 'volume-x'
  | 'x'

const paths: Record<IconName, ReactNode> = {
  archive: <><path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6" /></>,
  'arrow-left': <path d="m15 18-6-6 6-6" />,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  'external-link': <><path d="M14 3h7v7M10 14 21 3" /><path d="M18 13v7H4V6h7" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  indent: <><path d="M9 6h11M9 10h11M9 14h11M9 18h11" /><path d="m3 9 3 3-3 3" /></>,
  outdent: <><path d="M9 6h11M9 10h11M9 14h11M9 18h11" /><path d="m6 9-3 3 3 3" /></>,
  'first-line-indent': <><path d="M4 6h16M8 11h12M8 16h12" /><path d="m3 9 3 3-3 3" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  minus: <path d="M5 12h14" />,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  notebook: <><path d="M6 3h14v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 3v18M11 8h6M11 12h6" /></>,
  palette: <><path d="M12 3a9 9 0 0 0 0 18h1.5a1.8 1.8 0 0 0 0-3.6H12a1.4 1.4 0 0 1 0-2.8h2.4A6.6 6.6 0 0 0 21 8c0-3.2-4-5-9-5Z" /><circle cx="7.5" cy="9" r=".8" /><circle cx="10.5" cy="6.5" r=".8" /><circle cx="15" cy="7" r=".8" /></>,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  playlist: <><path d="M4 6h10M4 11h10M4 16h7" /><path d="M18 11v8M15 14h6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  redo: <><path d="m17 7 4 4-4 4" /><path d="M3 17v-2a4 4 0 0 1 4-4h14" /></>,
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
  'repeat-one': <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3M11 10h2v5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
  shuffle: <><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></>,
  'skip-back': <><path d="M19 20 9 12l10-8ZM5 19V5" /></>,
  'skip-forward': <><path d="m5 4 10 8-10 8ZM19 5v14" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" /></>,
  undo: <><path d="m7 7-4 4 4 4" /><path d="M21 17v-2a4 4 0 0 0-4-4H3" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 21h14" /></>,
  volume: <><path d="M11 5 6 9H2v6h4l5 4ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></>,
  'volume-x': <><path d="M11 5 6 9H2v6h4l5 4ZM16 9l5 6M21 9l-5 6" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">{paths[name]}</g>
    </svg>
  )
}
