import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { NativeModules, Platform } from 'react-native';

const chime = require('@/assets/audio/pull-complete.wav');

/** One controller per onboarding screen. Audio survives navigation long enough
 * to finish its short tail; cancellation never plays the completion sound. */
export function createOnboardingFeedback() {
  const native = Platform.OS === 'ios' ? NativeModules.CrimsonRemoteControls : undefined;
  let disposed = false;
  let prepared = false;
  let preparing = false;
  let pulling = false;
  let lastTick = 0;
  let audio: AudioPlayer | undefined;
  let chiming = false;
  const stop = () => {
    pulling = false;
    native?.stopOnboardingPull?.();
  };
  return {
    async prepare() {
      if (disposed || prepared || preparing) return;
      preparing = true;
      try {
        const asset = await Asset.fromModule(chime).downloadAsync();
        if (disposed) return;
        if (native?.prepareOnboardingFeedback) native.prepareOnboardingFeedback(asset.localUri ?? asset.uri);
        else {
          audio = createAudioPlayer(chime, { keepAudioSessionActive: false });
          audio.volume = 0.65;
        }
        prepared = true;
      } catch { /* Feedback must never block completing setup. */ }
      finally { preparing = false; }
    },
    start() {
      if (disposed) return;
      pulling = true;
      lastTick = 0;
      native?.startOnboardingPull?.();
    },
    update(progress: number) {
      if (!pulling || disposed) return;
      const strength = Math.max(0, Math.min(1, progress / 0.76));
      if (native?.updateOnboardingPull) native.updateOnboardingPull(strength);
      else if (Platform.OS !== 'web' && Date.now() - lastTick > 160 - strength * 75) {
        lastTick = Date.now();
        void impactAsync(strength < 0.35 ? ImpactFeedbackStyle.Light : strength < 0.72 ? ImpactFeedbackStyle.Medium : ImpactFeedbackStyle.Heavy).catch(() => undefined);
      }
    },
    stop,
    complete() {
      if (disposed || chiming) return;
      stop();
      chiming = true;
      try {
        if (native?.completeOnboardingPull) native.completeOnboardingPull();
        else if (audio) {
          const sound = audio;
          sound.play();
          setTimeout(() => { sound.remove(); if (audio === sound) audio = undefined; }, 900);
        }
      } catch { audio?.remove(); audio = undefined; }
    },
    dispose() {
      disposed = true;
      stop();
      if (!chiming) { audio?.remove(); audio = undefined; }
    },
  };
}
