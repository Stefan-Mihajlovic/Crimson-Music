// Expo's shared context is also used by its spectrum sampler. Creating a second
// MediaElementAudioSource for the same element would permanently silence it.
import { getAudioContext } from 'expo-audio/build/AudioUtils.web';
import { WebDeckGainControl } from '@/services/web-deck-gain';
import type { DeckGainControl } from '@/services/crossfade-player';
export function createDeckGainControl(): DeckGainControl | undefined {
  if (typeof navigator === 'undefined') return undefined;
  // One shared graph owns EQ, spectrum routing and crossfade on every browser.
  return new WebDeckGainControl(getAudioContext);
}
