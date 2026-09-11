import type { CSSProperties } from 'react';
import { ActivityIndicator } from 'react-native';

import { SymbolView, type SymbolViewProps } from '@/components/app-symbol';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';

export function formatPlayerTime(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function PlayerIconButton({ label, icon, onPress, active = false, size = 20, prominent = false, disabled = false, loading = false, style }: {
  label: string;
  icon: SymbolViewProps['name'];
  onPress: () => void;
  active?: boolean;
  size?: number;
  prominent?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: CSSProperties;
}) {
  const { colors } = useAppSettings();
  return <button type="button" className={`crimson-player-button${prominent ? ' is-prominent' : ''}`} aria-label={label} title={label}
    aria-pressed={active || undefined} disabled={disabled} onClick={onPress}
    style={{
      display: 'inline-flex', position: 'relative', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: prominent ? 44 : 36, height: prominent ? 44 : 36, padding: 0,
      border: 0, borderRadius: '50%', background: prominent ? '#F6F1FC' : 'transparent',
      color: prominent ? '#19131F' : active ? colors.accent : colors.text,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1,
      transition: 'background-color 150ms, transform 150ms', ...style,
    }}>
    {loading ? <ActivityIndicator color={prominent ? '#19131F' : colors.accent} size="small" />
      : <SymbolView name={icon} size={size} tintColor={prominent ? '#19131F' : active ? colors.accent : colors.text} />}
    {active && !prominent ? <span aria-hidden="true" style={{ position: 'absolute', bottom: 0, width: 3, height: 3, borderRadius: 3, background: colors.accent }} /> : null}
  </button>;
}

export function PlayerRange({ label, value, max, step = 1, onChange, style }: {
  label: string; value: number; max: number; step?: number; onChange: (value: number) => void; style?: CSSProperties;
}) {
  const { colors } = useAppSettings();
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(safeMax, value)) : 0;
  return <input className="crimson-player-range" type="range" aria-label={label} min={0} max={safeMax} step={step}
    value={safeValue} onChange={(event) => onChange(Number(event.target.value))}
    style={{
      width: '100%', minWidth: 0, height: 4, margin: '8px 0', border: 0, borderRadius: 8,
      cursor: 'pointer', accentColor: colors.accent,
      background: `linear-gradient(to right, ${colors.accent} ${safeValue / safeMax * 100}%, ${colors.border} ${safeValue / safeMax * 100}%)`,
      ...style,
    }} />;
}

export function WebTransport({ large = false }: { large?: boolean }) {
  const player = usePlayer();
  const status = usePlayerStatus();
  const sideButtonStyle = large ? { maxWidth: '18%', flexShrink: 1 } : undefined;
  return <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: large ? 'space-between' : 'center', gap: large ? 0 : 5 }}>
    <PlayerIconButton label={player.isShuffled ? 'Turn shuffle off' : 'Turn shuffle on'} icon="shuffle"
      onPress={player.toggleShuffle} active={player.isShuffled} size={large ? 22 : 18} style={sideButtonStyle} />
    <PlayerIconButton label="Previous song" icon="backward.fill" onPress={player.playPrevious} size={large ? 26 : 22} style={sideButtonStyle} />
    <PlayerIconButton label={player.playbackState === 'error' ? 'Retry playback' : status.isBuffering ? 'Cancel loading' : status.playing ? 'Pause' : 'Play'}
      icon={status.playing ? 'pause.fill' : 'play.fill'} prominent loading={status.isBuffering}
      onPress={player.playbackState === 'error' ? player.retryPlayback : player.togglePlay}
      size={large ? 29 : 22} style={large ? { width: 60, maxWidth: '24%', height: 'auto', aspectRatio: '1', flexShrink: 1 } : undefined} />
    <PlayerIconButton label="Next song" icon="forward.fill" onPress={player.playNext} size={large ? 26 : 22} style={sideButtonStyle} />
    <PlayerIconButton label={`Repeat ${player.repeatMode}`} icon={player.repeatMode === 'one' ? 'repeat.1' : 'repeat'}
      onPress={player.toggleRepeat} active={player.repeatMode !== 'none'} size={large ? 22 : 18} style={sideButtonStyle} />
  </div>;
}

export function WebVolume({ width = 78, fill = false }: { width?: number; fill?: boolean }) {
  const { volume, setVolume } = usePlayer();
  return <div style={{ display: 'flex', width: fill ? '100%' : undefined, minWidth: 0, alignItems: 'center', gap: fill ? 10 : 2 }}>
    <PlayerIconButton label={volume > 0 ? 'Mute' : 'Unmute'} icon={volume > 0 ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
      onPress={() => setVolume(volume > 0 ? 0 : 0.7)} size={19} />
    <PlayerRange label="Volume" value={volume} max={1} step={0.01} onChange={setVolume} style={fill ? { flex: 1, width: 'auto' } : { width }} />
  </div>;
}
