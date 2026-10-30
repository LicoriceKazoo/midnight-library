import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioContext } from './AudioContext'
import type { AudioContextValue } from './AudioContext'
import { adjacentTrackId, defaultAudioState, endedTrackId, migrateAudioState, nextRepeatMode, playbackQueue, removeTrackFromPlaylists } from './audioModel'
import { deleteAudioTrack, listAudioTracks, loadAudioFile, loadAudioState, saveAudioState, saveAudioTrack, updateAudioTrack } from './audioStorage'
import type { AudioLibraryState, AudioTrack } from './audioTypes'

const acceptedExtensions = new Set(['mp3', 'm4a', 'mp4', 'ogg', 'oga', 'wav', 'webm', 'aac'])
const mimeByExtension: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', ogg: 'audio/ogg',
  oga: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm', aac: 'audio/aac',
}

function fileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/u, '').replaceAll(/[_-]+/gu, ' ').trim() || fileName
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  const [library, setLibrary] = useState<AudioLibraryState>(defaultAudioState)
  const [hydrated, setHydrated] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const autoplayRequested = useRef(false)
  const lastStoredPosition = useRef(0)
  const suppressPausePersistence = useRef(false)

  const currentTrack = tracks.find((track) => track.id === library.playback.currentTrackId)
  const queue = useMemo(
    () => playbackQueue(tracks, library.playlists, library.playback.currentPlaylistId),
    [library.playback.currentPlaylistId, library.playlists, tracks],
  )

  useEffect(() => {
    Promise.all([listAudioTracks(), loadAudioState()])
      .then(([storedTracks, storedState]) => {
        const nextState = migrateAudioState(storedState)
        const trackIds = new Set(storedTracks.map((track) => track.id))
        nextState.playlists = nextState.playlists.map((playlist) => ({
          ...playlist,
          trackIds: playlist.trackIds.filter((id) => trackIds.has(id)),
        }))
        if (nextState.playback.currentTrackId && !trackIds.has(nextState.playback.currentTrackId)) {
          nextState.playback.currentTrackId = undefined
          nextState.playback.position = 0
        }
        setTracks(storedTracks)
        setLibrary(nextState)
        setProgress(nextState.playback.position)
      })
      .catch(() => setMessage('The local audio library could not be opened.'))
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      saveAudioState(library).catch(() => setMessage('Playback settings could not be saved.'))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [hydrated, library])

  useEffect(() => {
    const audio = audioRef.current
    const trackId = library.playback.currentTrackId
    let cancelled = false

    if (audio) {
      suppressPausePersistence.current = !audio.paused
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (!audio || !trackId) return

    setLoading(true)
    loadAudioFile(trackId)
      .then((file) => {
        if (cancelled) return
        if (!file) throw new Error('missing')
        const url = URL.createObjectURL(file)
        objectUrlRef.current = url
        audio.src = url
        audio.load()
      })
      .catch(() => {
        if (!cancelled) setMessage('This audio file is no longer available on this device.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [library.playback.currentTrackId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = library.playback.volume
    audio.muted = library.playback.muted
  }, [library.playback.muted, library.playback.volume])

  useEffect(() => () => {
    const audio = audioRef.current
    audio?.pause()
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const attemptPlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    try {
      await audio.play()
      setMessage(null)
    } catch {
      setPlaying(false)
      setMessage('Playback is ready. Tap play once more to allow audio in this browser.')
    }
  }

  const selectTrack = (trackId: string, playlistId?: string, autoplay = true) => {
    autoplayRequested.current = autoplay
    lastStoredPosition.current = 0
    setProgress(0)
    setLibrary((current) => ({
      ...current,
      playback: {
        ...current.playback,
        currentTrackId: trackId,
        currentPlaylistId: playlistId,
        position: 0,
      },
    }))
  }

  const move = (direction: 'next' | 'previous', autoplay = true) => {
    const trackId = adjacentTrackId({
      queue,
      currentTrackId: library.playback.currentTrackId,
      direction,
      repeatMode: library.playback.repeatMode,
      shuffle: library.playback.shuffle,
    })
    if (trackId) selectTrack(trackId, library.playback.currentPlaylistId, autoplay)
  }

  const value: AudioContextValue = {
    tracks,
    playlists: library.playlists,
    playback: library.playback,
    currentTrack,
    playing,
    loading,
    progress,
    duration,
    message,
    uploadFiles: async (files) => {
      let added = 0
      for (const file of files) {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
        const mimeType = file.type || mimeByExtension[extension] || ''
        const browserSupport = mimeType ? document.createElement('audio').canPlayType(mimeType) : ''
        if (!acceptedExtensions.has(extension) || !mimeType.startsWith('audio/') || !browserSupport) {
          setMessage(`“${file.name}” is not a browser-playable audio file.`)
          continue
        }

        if (navigator.storage?.estimate) {
          try {
            const estimate = await navigator.storage.estimate()
            if (estimate.quota && estimate.usage !== undefined && estimate.quota - estimate.usage < file.size * 1.1) {
              setMessage(`There is not enough local storage for “${file.name}”.`)
              continue
            }
          } catch {
            // Some privacy modes do not expose estimates; IndexedDB still reports quota errors.
          }
        }

        const track: AudioTrack = {
          id: crypto.randomUUID(),
          fileName: file.name,
          title: fileTitle(file.name),
          mimeType,
          size: file.size,
          createdAt: Date.now(),
        }
        try {
          await saveAudioTrack(track, file)
          setTracks((current) => [...current, track])
          added += 1
        } catch (error) {
          setMessage(
            error instanceof DOMException && error.name === 'QuotaExceededError'
              ? `There is not enough local storage for “${file.name}”.`
              : `“${file.name}” could not be saved locally.`,
          )
        }
      }
      if (added) setMessage(`${added} ${added === 1 ? 'track' : 'tracks'} added to your local audio library.`)
    },
    renameTrack: async (trackId, title) => {
      const track = tracks.find((item) => item.id === trackId)
      if (!track) return
      const updated = { ...track, title: title.trim() }
      try {
        await updateAudioTrack(updated)
        setTracks((current) => current.map((item) => item.id === trackId ? updated : item))
      } catch {
        setMessage('The track title could not be saved.')
      }
    },
    removeTrack: async (trackId) => {
      try {
        await deleteAudioTrack(trackId)
      } catch {
        setMessage('The track could not be removed from local storage.')
        return
      }
      if (library.playback.currentTrackId === trackId) {
        audioRef.current?.pause()
        setLibrary((current) => ({
          ...current,
          playback: { ...current.playback, currentTrackId: undefined, position: 0 },
          playlists: removeTrackFromPlaylists(current.playlists, trackId),
        }))
      } else {
        setLibrary((current) => ({ ...current, playlists: removeTrackFromPlaylists(current.playlists, trackId) }))
      }
      setTracks((current) => current.filter((track) => track.id !== trackId))
    },
    createPlaylist: (name) => {
      if (!name.trim()) return
      const now = Date.now()
      setLibrary((current) => ({
        ...current,
        playlists: [...current.playlists, { id: crypto.randomUUID(), name: name.trim(), trackIds: [], createdAt: now, updatedAt: now }],
      }))
    },
    renamePlaylist: (playlistId, name) => {
      if (!name.trim()) return
      setLibrary((current) => ({
        ...current,
        playlists: current.playlists.map((playlist) =>
          playlist.id === playlistId ? { ...playlist, name: name.trim(), updatedAt: Date.now() } : playlist,
        ),
      }))
    },
    removePlaylist: (playlistId) => setLibrary((current) => ({
      ...current,
      playlists: current.playlists.filter((playlist) => playlist.id !== playlistId),
      playback: current.playback.currentPlaylistId === playlistId
        ? { ...current.playback, currentPlaylistId: undefined }
        : current.playback,
    })),
    setPlaylistTracks: (playlistId, trackIds) => setLibrary((current) => ({
      ...current,
      playlists: current.playlists.map((playlist) =>
        playlist.id === playlistId ? { ...playlist, trackIds: [...new Set(trackIds)], updatedAt: Date.now() } : playlist,
      ),
    })),
    playTrack: (trackId, playlistId) => selectTrack(trackId, playlistId),
    playPlaylist: (playlistId) => {
      const playlist = library.playlists.find((item) => item.id === playlistId)
      const firstTrack = playlist?.trackIds.find((id) => tracks.some((track) => track.id === id))
      if (firstTrack) selectTrack(firstTrack, playlistId)
    },
    togglePlay: () => {
      const audio = audioRef.current
      if (playing) audio?.pause()
      else if (!library.playback.currentTrackId && tracks[0]) selectTrack(tracks[0].id)
      else if (audio?.src && audio.readyState >= 1) void attemptPlay()
      else autoplayRequested.current = true
    },
    previous: () => {
      const audio = audioRef.current
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0
        setProgress(0)
      } else move('previous')
    },
    next: () => move('next'),
    seek: (position) => {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(position)) return
      audio.currentTime = Math.max(0, Math.min(position, audio.duration || position))
      setProgress(audio.currentTime)
      setLibrary((current) => ({ ...current, playback: { ...current.playback, position: audio.currentTime } }))
    },
    setVolume: (volume) => {
      const nextVolume = Math.max(0, Math.min(1, volume))
      if (audioRef.current) audioRef.current.volume = nextVolume
      setLibrary((current) => ({ ...current, playback: { ...current.playback, volume: nextVolume } }))
    },
    toggleMute: () => {
      if (audioRef.current) audioRef.current.muted = !library.playback.muted
      setLibrary((current) => ({ ...current, playback: { ...current.playback, muted: !current.playback.muted } }))
    },
    cycleRepeat: () => setLibrary((current) => ({
      ...current, playback: { ...current.playback, repeatMode: nextRepeatMode(current.playback.repeatMode) },
    })),
    toggleShuffle: () => setLibrary((current) => ({
      ...current, playback: { ...current.playback, shuffle: !current.playback.shuffle },
    })),
    clearMessage: () => setMessage(null),
  }

  return (
    <AudioContext.Provider value={value}>
      {children}
      <audio
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() => {
          const nextTrack = endedTrackId({
            queue,
            currentTrackId: library.playback.currentTrackId,
            repeatMode: library.playback.repeatMode,
            shuffle: library.playback.shuffle,
          })
          if (nextTrack === library.playback.currentTrackId && audioRef.current) {
            audioRef.current.currentTime = 0
            void attemptPlay()
          } else if (nextTrack) selectTrack(nextTrack, library.playback.currentPlaylistId)
          else setPlaying(false)
        }}
        onError={() => setMessage('This track could not be played by the browser.')}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget
          const restoredPosition = library.playback.position
          if (restoredPosition > 0 && restoredPosition < audio.duration) audio.currentTime = restoredPosition
          setProgress(audio.currentTime)
          setDuration(audio.duration)
          if (currentTrack && audio.duration && currentTrack.duration !== audio.duration) {
            const updated = { ...currentTrack, duration: audio.duration }
            setTracks((items) => items.map((item) => item.id === updated.id ? updated : item))
            void updateAudioTrack(updated).catch(() => setMessage('The track duration could not be saved.'))
          }
          if (autoplayRequested.current) {
            autoplayRequested.current = false
            void attemptPlay()
          }
        }}
        onPause={(event) => {
          setPlaying(false)
          if (suppressPausePersistence.current) {
            suppressPausePersistence.current = false
            return
          }
          const position = event.currentTarget.currentTime || 0
          setLibrary((current) => ({ ...current, playback: { ...current.playback, position } }))
        }}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={(event) => {
          const position = event.currentTarget.currentTime
          setProgress(position)
          if (Math.abs(position - lastStoredPosition.current) >= 1) {
            lastStoredPosition.current = position
            setLibrary((current) => ({ ...current, playback: { ...current.playback, position } }))
          }
        }}
        preload="metadata"
        ref={audioRef}
      />
    </AudioContext.Provider>
  )
}
