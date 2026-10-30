import type { AudioLibraryState, AudioPlaylist, AudioTrack, RepeatMode } from './audioTypes'

export const defaultAudioState: AudioLibraryState = {
  schemaVersion: 1,
  playlists: [],
  playback: {
    position: 0,
    volume: 0.8,
    muted: false,
    repeatMode: 'off',
    shuffle: false,
  },
}

const repeatModes: RepeatMode[] = ['off', 'one', 'playlist']

export function nextRepeatMode(mode: RepeatMode) {
  return repeatModes[(repeatModes.indexOf(mode) + 1) % repeatModes.length]
}

export function migrateAudioState(state?: Partial<AudioLibraryState>): AudioLibraryState {
  const playback = state?.playback
  return {
    schemaVersion: 1,
    playlists: Array.isArray(state?.playlists)
      ? state.playlists.filter((playlist) =>
          typeof playlist?.id === 'string' && typeof playlist.name === 'string' &&
          Array.isArray(playlist.trackIds),
        ).map((playlist) => ({
          ...playlist,
          trackIds: playlist.trackIds.filter((id) => typeof id === 'string'),
          lastTrackId: typeof playlist.lastTrackId === 'string' ? playlist.lastTrackId : undefined,
        }))
      : [],
    playback: {
      currentTrackId: typeof playback?.currentTrackId === 'string' ? playback.currentTrackId : undefined,
      currentPlaylistId: typeof playback?.currentPlaylistId === 'string' ? playback.currentPlaylistId : undefined,
      position: Number.isFinite(playback?.position) ? Math.max(0, playback?.position ?? 0) : 0,
      volume: Number.isFinite(playback?.volume) ? Math.min(1, Math.max(0, playback?.volume ?? 0.8)) : 0.8,
      muted: Boolean(playback?.muted),
      repeatMode: repeatModes.includes(playback?.repeatMode ?? 'off') ? playback?.repeatMode ?? 'off' : 'off',
      shuffle: Boolean(playback?.shuffle),
    },
  }
}

export function playbackQueue(
  tracks: AudioTrack[],
  playlists: AudioPlaylist[],
  playlistId?: string,
) {
  const available = new Set(tracks.map((track) => track.id))
  const playlist = playlists.find((item) => item.id === playlistId)
  return playlist
    ? playlist.trackIds.filter((id) => available.has(id))
    : tracks.map((track) => track.id)
}

export function adjacentTrackId({
  queue,
  currentTrackId,
  direction,
  repeatMode,
  shuffle,
  random = Math.random,
}: {
  queue: string[]
  currentTrackId?: string
  direction: 'next' | 'previous'
  repeatMode: RepeatMode
  shuffle: boolean
  random?: () => number
}) {
  if (!queue.length) return undefined
  if (shuffle && queue.length > 1) {
    const candidates = queue.filter((id) => id !== currentTrackId)
    return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
  }
  const index = Math.max(0, queue.indexOf(currentTrackId ?? queue[0]))
  const offset = direction === 'next' ? 1 : -1
  const candidate = queue[index + offset]
  if (candidate) return candidate
  if (repeatMode === 'playlist') return direction === 'next' ? queue[0] : queue[queue.length - 1]
  return undefined
}

export function endedTrackId({
  queue,
  currentTrackId,
  repeatMode,
  shuffle,
  random,
}: {
  queue: string[]
  currentTrackId?: string
  repeatMode: RepeatMode
  shuffle: boolean
  random?: () => number
}) {
  if (repeatMode === 'one') return currentTrackId
  return adjacentTrackId({ queue, currentTrackId, direction: 'next', repeatMode, shuffle, random })
}

export function removeTrackFromPlaylists(playlists: AudioPlaylist[], trackId: string) {
  return playlists.map((playlist) => ({
    ...playlist,
    trackIds: playlist.trackIds.filter((id) => id !== trackId),
    lastTrackId: playlist.lastTrackId === trackId ? undefined : playlist.lastTrackId,
    updatedAt: playlist.trackIds.includes(trackId) ? Date.now() : playlist.updatedAt,
  }))
}
