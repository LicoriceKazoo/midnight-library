export type AudioTrack = {
  id: string
  fileName: string
  title: string
  mimeType: string
  size: number
  duration?: number
  createdAt: number
}

export type AudioPlaylist = {
  id: string
  name: string
  trackIds: string[]
  lastTrackId?: string
  createdAt: number
  updatedAt: number
}

export type RepeatMode = 'off' | 'one' | 'playlist'

export type AudioPlaybackState = {
  currentTrackId?: string
  currentPlaylistId?: string
  position: number
  volume: number
  muted: boolean
  repeatMode: RepeatMode
  shuffle: boolean
}

export type AudioLibraryState = {
  schemaVersion: 1
  playlists: AudioPlaylist[]
  playback: AudioPlaybackState
}
