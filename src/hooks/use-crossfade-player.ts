import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createDeckGainControl } from '@/services/deck-gain';
import { CrossfadePlayer } from '@/services/crossfade-player';
import { useAppSettings } from '@/providers/settings-provider';
import { applyEqualizer } from '@/services/equalizer-platform';
import { DEFAULT_EQUALIZER } from '@/services/equalizer';

export function useCrossfadePlayer() {
  const { equalizer = DEFAULT_EQUALIZER, playbackSpeed = 1, preservePitch = true, loudnessNormalization = false } = useAppSettings();
  const first = useAudioPlayer(null, { keepAudioSessionActive: true, preferredForwardBufferDuration: 8, updateInterval: 100, crossOrigin: 'anonymous' });
  const second = useAudioPlayer(null, { keepAudioSessionActive: true, preferredForwardBufferDuration: 8, updateInterval: 100, crossOrigin: 'anonymous' });
  const firstStatus = useAudioPlayerStatus(first);
  const secondStatus = useAudioPlayerStatus(second);
  const mixer = useMemo(() => new CrossfadePlayer(first, second, createDeckGainControl()), [first, second]);
  const index = useSyncExternalStore(mixer.subscribe, mixer.getSnapshot, mixer.getSnapshot);
  const status = index === 0 ? firstStatus : secondStatus;
  useEffect(() => { applyEqualizer([first, second], equalizer); }, [first, second, equalizer]);
  useEffect(() => {
    for (const player of [first, second]) {
      player.shouldCorrectPitch = preservePitch;
      player.setPlaybackRate(playbackSpeed, preservePitch ? 'high' : 'medium');
      (player as unknown as { setCrimsonNormalization?: (enabled: boolean) => void }).setCrimsonNormalization?.(loudnessNormalization);
    }
  }, [first, second, playbackSpeed, preservePitch, loudnessNormalization, firstStatus.isLoaded, secondStatus.isLoaded]);
  useEffect(() => { mixer.tick(); }, [mixer, status.currentTime]);
  useEffect(() => () => mixer.dispose(), [mixer]);
  return { audioPlayer: mixer.player, status, mixer };
}
