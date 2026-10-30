import { createContext, useContext } from 'react'
import type { AudioLibraryState, AudioPlaylist, AudioTrack } from './audioTypes'

export type AudioContextValue = {
  tracks: AudioTrack[]
  playlists: AudioPlaylist[]
  playback: AudioLibraryState['playback']
  currentTrack?: AudioTrack
  playing: boolean
  loading: boolean
  progress: number
  duration: number
  message: string | null
  uploadFiles: (files: File[]) => Promise<void>
  renameTrack: (trackId: string, title: string) => Promise<void>
  removeTrack: (trackId: string) => Promise<void>
  createPlaylist: (name: string) => void
  renamePlaylist: (playlistId: string, name: string) => void
  removePlaylist: (playlistId: string) => void
  setPlaylistTracks: (playlistId: string, trackIds: string[]) => void
  playTrack: (trackId: string, playlistId?: string) => void
  playPlaylist: (playlistId: string) => void
  togglePlay: () => void
  previous: () => void
  next: () => void
  seek: (position: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  cycleRepeat: () => void
  toggleShuffle: () => void
  clearMessage: () => void
}

export const AudioContext = createContext<AudioContextValue | null>(null)

export function useAudio() {
  const value = useContext(AudioContext)
  if (!value) throw new Error('useAudio must be used within AudioProvider.')
  return value
}
