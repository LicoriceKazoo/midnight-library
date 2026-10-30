import { useState } from 'react'
import { useAudio } from './AudioContext'
import { Icon } from './Icon'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function CompactAudioPlayer() {
  const audio = useAudio()
  const [expanded, setExpanded] = useState(false)
  if (!audio.tracks.length) return null

  return (
    <section aria-label="Audio player" className={`compact-audio-player ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <div className="expanded-player-controls">
          <div className="player-progress-row">
            <span>{formatTime(audio.progress)}</span>
            <input aria-label="Track position" disabled={!audio.duration} max={audio.duration || 1} min="0" onChange={(event) => audio.seek(Number(event.target.value))} step="0.1" type="range" value={Math.min(audio.progress, audio.duration || 1)} />
            <span>{formatTime(audio.duration)}</span>
          </div>
          <div className="player-options">
            <button aria-label={`Repeat: ${audio.playback.repeatMode}`} className={audio.playback.repeatMode !== 'off' ? 'active' : ''} onClick={audio.cycleRepeat} type="button"><Icon name={audio.playback.repeatMode === 'one' ? 'repeat-one' : 'repeat'} /></button>
            <button aria-label="Previous track" onClick={audio.previous} type="button"><Icon name="skip-back" /></button>
            <button aria-label={audio.playing ? 'Pause' : 'Play'} className="primary-player-button" onClick={audio.togglePlay} type="button">{audio.playing ? <Icon name="pause" /> : <Icon name="play" />}</button>
            <button aria-label="Next track" onClick={audio.next} type="button"><Icon name="skip-forward" /></button>
            <button aria-label="Shuffle" className={audio.playback.shuffle ? 'active' : ''} onClick={audio.toggleShuffle} type="button"><Icon name="shuffle" /></button>
          </div>
          <div className="volume-row">
            <button aria-label={audio.playback.muted ? 'Unmute' : 'Mute'} onClick={audio.toggleMute} type="button"><Icon name={audio.playback.muted ? 'volume-x' : 'volume'} size={18} /></button>
            <input aria-label="Volume" max="1" min="0" onChange={(event) => audio.setVolume(Number(event.target.value))} step="0.05" type="range" value={audio.playback.volume} />
          </div>
        </div>
      )}
      <div className="compact-player-row">
        <button aria-label={audio.playing ? 'Pause' : 'Play'} className="compact-play-button" disabled={audio.loading} onClick={audio.togglePlay} type="button">
          {audio.loading ? <span className="player-loader" /> : audio.playing ? <Icon name="pause" /> : <Icon name="play" />}
        </button>
        <div className="compact-track-copy">
          <span>{audio.playing ? 'Now playing' : audio.currentTrack ? 'Ready to play' : 'Audio Library'}</span>
          <strong>{audio.currentTrack?.title || audio.currentTrack?.fileName || 'Choose a track'}</strong>
        </div>
        <div className="compact-time">{formatTime(audio.progress)}</div>
        <button aria-label={expanded ? 'Collapse audio player' : 'Expand audio player'} className="player-expand-button" onClick={() => setExpanded((current) => !current)} type="button"><Icon name={expanded ? 'chevron-down' : 'chevron-up'} /></button>
      </div>
    </section>
  )
}
