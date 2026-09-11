import { PlayerRange } from '@/components/web-player-controls';
import type { WebPlayerSeekProps } from '@/components/web-player-seek';

export default function WebPlayerSeek({ value, duration, onSeek }: WebPlayerSeekProps) {
  return <div style={{ display: 'flex', alignItems: 'center', height: 32 }}>
    <PlayerRange label="Playback position" value={value} max={duration} onChange={onSeek}
      style={{ height: 7, background: `linear-gradient(to right, #A66BFF ${duration > 0 ? value / duration * 100 : 0}%, rgba(255,255,255,.14) ${duration > 0 ? value / duration * 100 : 0}%)` }} />
  </div>;
}
