import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { LocalAudioFile } from '@/services/local-music-model';
import type { CrimsonSong } from '@/types/music';

type LocalMusicModule = {
  scanDevice(): Promise<{ files: LocalAudioFile[]; skipped: number }>;
  listImported(): Promise<LocalAudioFile[]>;
  importAudio(): Promise<{ files: LocalAudioFile[]; skipped: number }>;
  removeImport(uri: string): Promise<void>;
  resolveUri(uri: string): Promise<string>;
};
function native(): LocalMusicModule {
  const module = NativeModules.CrimsonLocalMusic as LocalMusicModule | undefined;
  if (!module) throw new Error('Local Music needs the latest Crimson app build.');
  return module;
}
export async function scanDeviceAudio() {
  if (Platform.OS === 'android') {
    const permission = Number(Platform.Version) >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const result = await PermissionsAndroid.request(permission);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Allow Music and audio access in system Settings to scan your device. You can also import individual files.');
    }
  }
  return native().scanDevice();
}
export const listImportedAudio = () => native().listImported();
export const pickLocalAudio = (_folder = false) => native().importAudio();
export const removeImportedAudio = (song: CrimsonSong) => native().removeImport(song.url);
export const resolveLocalAudioUri = (song: Pick<CrimsonSong, 'id' | 'url'>) => native().resolveUri(song.url);
