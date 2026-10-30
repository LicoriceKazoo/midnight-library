import { useRef, useState } from 'react'
import { useAudio } from './AudioContext'
import { Icon } from './Icon'
import type { AudioPlaylist, AudioTrack } from './audioTypes'

type AudioDialog =
  | { type: 'rename-track'; track: AudioTrack }
  | { type: 'delete-track'; track: AudioTrack }
  | { type: 'create-playlist' }
  | { type: 'rename-playlist'; playlist: AudioPlaylist }
  | { type: 'delete-playlist'; playlist: AudioPlaylist }
  | { type: 'manage-playlist'; playlist: AudioPlaylist }
  | null

function formatBytes(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return 'Duration pending'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function AudioLibraryScreen({ onPlayerRestore }: { onPlayerRestore: () => void }) {
  const audio = useAudio()
  const fileInput = useRef<HTMLInputElement>(null)
  const [dialog, setDialog] = useState<AudioDialog>(null)
  const [working, setWorking] = useState(false)

  const upload = async (files?: FileList | null) => {
    if (!files?.length) return
    setWorking(true)
    await audio.uploadFiles(Array.from(files))
    setWorking(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <main className="screen audio-library-screen">
      <section className="audio-library-hero">
        <div>
          <p className="eyebrow">Stored on this device</p>
          <h1>Audio Library</h1>
          <p>Music and ambience for the worlds between these pages.</p>
        </div>
        <button className="audio-upload-button" disabled={working} onClick={() => fileInput.current?.click()} type="button">
          <Icon name="upload" size={19} /> {working ? 'Adding…' : 'Add audio'}
        </button>
        <input
          accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/aac,.mp3,.m4a,.ogg,.oga,.wav,.webm,.aac"
          aria-label="Choose audio files"
          className="visually-hidden"
          multiple
          onChange={(event) => void upload(event.target.files)}
          ref={fileInput}
          type="file"
        />
      </section>

      {audio.message && (
        <div className="audio-message" role="status">
          <span>{audio.message}</span>
          <button aria-label="Dismiss audio message" onClick={audio.clearMessage} type="button"><Icon name="x" size={16} /></button>
        </div>
      )}

      <section className="audio-section">
        <div className="audio-section-heading">
          <div><p className="eyebrow">Collection</p><h2>Tracks</h2></div>
          <span>{audio.tracks.length} {audio.tracks.length === 1 ? 'track' : 'tracks'}</span>
        </div>
        {audio.tracks.length === 0 ? (
          <div className="audio-empty-state">
            <span><Icon name="music" size={26} /></span>
            <h3>Your audio shelf is quiet</h3>
            <p>Add an MP3 or another browser-playable audio file to begin.</p>
            <button className="compact-gold-button" onClick={() => fileInput.current?.click()} type="button"><Icon name="plus" size={17} /> Add your first track</button>
          </div>
        ) : (
          <div className="audio-track-list">
            {audio.tracks.map((track, index) => (
              <article className={`audio-track-card ${audio.currentTrack?.id === track.id ? 'current' : ''}`} key={track.id}>
                <button aria-label={`${audio.currentTrack?.id === track.id && audio.playing ? 'Pause' : 'Play'} ${track.title || track.fileName}`} className="track-play-button" onClick={() => {
                  onPlayerRestore()
                  if (audio.currentTrack?.id === track.id && audio.playing) audio.togglePlay()
                  else audio.playTrack(track.id)
                }} type="button">
                  {audio.currentTrack?.id === track.id && audio.playing ? <Icon name="pause" /> : <Icon name="play" />}
                </button>
                <div className="track-copy">
                  <span className="track-index">{String(index + 1).padStart(2, '0')}</span>
                  <strong>{track.title || track.fileName}</strong>
                  <small>{track.fileName} · {formatBytes(track.size)} · {formatDuration(track.duration)}</small>
                </div>
                <div className="track-actions">
                  <button aria-label={`Edit ${track.title || track.fileName}`} onClick={() => setDialog({ type: 'rename-track', track })} type="button"><Icon name="edit" size={16} /></button>
                  <button aria-label={`Delete ${track.title || track.fileName}`} className="danger-action" onClick={() => setDialog({ type: 'delete-track', track })} type="button"><Icon name="trash" size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="audio-section playlist-section">
        <div className="audio-section-heading">
          <div><p className="eyebrow">Curated listening</p><h2>Playlists</h2></div>
          <button className="compact-gold-button" onClick={() => setDialog({ type: 'create-playlist' })} type="button"><Icon name="plus" size={17} /> New playlist</button>
        </div>
        {audio.playlists.length === 0 ? (
          <div className="playlist-empty"><p>Create a playlist to gather a story’s soundtrack in one place.</p></div>
        ) : (
          <div className="playlist-grid">
            {audio.playlists.map((playlist) => (
              <article className="playlist-card" key={playlist.id}>
                <div className="playlist-symbol"><Icon name="playlist" size={23} /></div>
                <div className="playlist-copy"><strong>{playlist.name}</strong><span>{playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}</span></div>
                <button aria-label={`Play ${playlist.name}`} className="playlist-play" disabled={!playlist.trackIds.length} onClick={() => { onPlayerRestore(); audio.playPlaylist(playlist.id) }} title={playlist.trackIds.length ? `Play ${playlist.name}` : 'Add tracks before playing'} type="button"><Icon name="play" size={17} /></button>
                <div className="playlist-actions">
                  <button onClick={() => setDialog({ type: 'manage-playlist', playlist })} type="button">Tracks</button>
                  <button onClick={() => setDialog({ type: 'rename-playlist', playlist })} type="button">Rename</button>
                  <button className="danger-action" onClick={() => setDialog({ type: 'delete-playlist', playlist })} type="button">Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="audio-local-note"><Icon name="archive" size={15} /> Audio stays in this browser and is not included in story JSON backups.</p>
      {dialog && <AudioActionDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </main>
  )
}

function AudioActionDialog({ dialog, onClose }: { dialog: Exclude<AudioDialog, null>; onClose: () => void }) {
  const audio = useAudio()
  const initialName = dialog.type === 'rename-track'
    ? dialog.track.title
    : dialog.type === 'rename-playlist' ? dialog.playlist.name : ''
  const [name, setName] = useState(initialName)
  const [selectedTracks, setSelectedTracks] = useState<string[]>(
    dialog.type === 'manage-playlist' ? dialog.playlist.trackIds : [],
  )
  const isDelete = dialog.type === 'delete-track' || dialog.type === 'delete-playlist'
  const isManage = dialog.type === 'manage-playlist'

  const submit = async () => {
    if (dialog.type === 'rename-track') await audio.renameTrack(dialog.track.id, name)
    if (dialog.type === 'delete-track') await audio.removeTrack(dialog.track.id)
    if (dialog.type === 'create-playlist') audio.createPlaylist(name)
    if (dialog.type === 'rename-playlist') audio.renamePlaylist(dialog.playlist.id, name)
    if (dialog.type === 'delete-playlist') audio.removePlaylist(dialog.playlist.id)
    if (dialog.type === 'manage-playlist') audio.setPlaylistTracks(dialog.playlist.id, selectedTracks)
    onClose()
  }

  const heading = dialog.type === 'rename-track' ? 'Edit track title'
    : dialog.type === 'delete-track' ? 'Delete this track?'
      : dialog.type === 'create-playlist' ? 'New playlist'
        : dialog.type === 'rename-playlist' ? 'Rename playlist'
          : dialog.type === 'delete-playlist' ? 'Delete this playlist?'
            : `Tracks in ${dialog.playlist.name}`

  return (
    <div aria-labelledby="audio-dialog-title" aria-modal="true" className="dialog-backdrop" role="dialog">
      <form className="action-dialog audio-action-dialog" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <span className={`dialog-icon ${isDelete ? 'delete' : ''}`}><Icon name={isDelete ? 'trash' : isManage ? 'playlist' : 'music'} /></span>
        <h2 id="audio-dialog-title">{heading}</h2>
        {isDelete ? (
          <p>
            {dialog.type === 'delete-track'
              ? `“${dialog.track.title || dialog.track.fileName}” and its local audio file will be removed from every playlist.`
              : `“${dialog.playlist.name}” will be removed. Its audio tracks will remain in your library.`}
          </p>
        ) : isManage ? (
          <div className="playlist-track-picker">
            {audio.tracks.length === 0 ? <p>Add tracks to your library first.</p> : audio.tracks.map((track) => (
              <label key={track.id}>
                <input
                  checked={selectedTracks.includes(track.id)}
                  onChange={(event) => setSelectedTracks((current) =>
                    event.target.checked ? [...current, track.id] : current.filter((id) => id !== track.id),
                  )}
                  type="checkbox"
                />
                <span>{track.title || track.fileName}<small>{track.fileName}</small></span>
              </label>
            ))}
          </div>
        ) : (
          <label>{dialog.type === 'rename-track' ? 'Display title' : 'Playlist name'}
            <input autoFocus maxLength={100} onChange={(event) => setName(event.target.value)} placeholder={dialog.type === 'rename-track' ? 'Leave blank to use the filename' : 'Evening reading'} required={dialog.type !== 'rename-track'} value={name} />
          </label>
        )}
        <div className="dialog-actions">
          <button autoFocus={isDelete} className="secondary-button" onClick={onClose} type="button">Cancel</button>
          <button className={isDelete ? 'delete-button' : 'gold-button'} disabled={!isDelete && !isManage && dialog.type !== 'rename-track' && !name.trim()} type="submit">
            {isDelete ? 'Delete' : isManage ? 'Save tracks' : dialog.type === 'create-playlist' ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
