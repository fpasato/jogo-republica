import { useState, useEffect } from 'react';
import bgSound from '../assets/bg-sound.mp3';

let globalAudio: HTMLAudioElement | null = null;
let globalVolume = 0.3;
let globalIsMuted = false;

function getGlobalAudio(): HTMLAudioElement {
  if (!globalAudio) {
    globalAudio = new Audio(bgSound);
    globalAudio.loop = true;
    globalAudio.volume = globalIsMuted ? 0 : globalVolume;
    globalAudio.play().catch(console.error);
  }
  return globalAudio;
}

export function BackgroundAudio() {
  useEffect(() => {
    getGlobalAudio();
  }, []);

  return null;
}

export function VolumeControl() {
  const [volume, setVolume] = useState(globalVolume);
  const [isMuted, setIsMuted] = useState(globalIsMuted);

  useEffect(() => {
    const audio = getGlobalAudio();
    audio.volume = isMuted ? 0 : volume;
    globalVolume = volume;
    globalIsMuted = isMuted;
  }, [volume, isMuted]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      color: 'white',
      fontSize: '14px',
    }}>
      <button
        onClick={() => setIsMuted(!isMuted)}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0',
        }}
        title={isMuted ? 'Ativar som' : 'Silenciar'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        style={{
          width: '80px',
          cursor: 'pointer',
        }}
        title="Volume"
      />
      <span style={{ minWidth: '30px', fontSize: '12px' }}>
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}
