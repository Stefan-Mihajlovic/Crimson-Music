import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { disposeDeletedAccount } from '@/services/account-lifecycle';
import { belongsToAccount } from '@/services/account-storage';

export async function clearDeletedAccountData(uid: string) {
  if (!uid || !/^[a-zA-Z0-9_-]+$/.test(uid)) throw new Error('Invalid account cleanup target.');
  // Stop and drain in-flight download/cache work before removing local data.
  await disposeDeletedAccount(uid);
  const results = await Promise.allSettled([
    Promise.resolve().then(() => {
      if (Platform.OS !== 'web') {
        const directory = new Directory(Paths.document, 'crimson-downloads', uid);
        if (directory.exists) directory.delete();
      }
    }),
    (async () => {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) => belongsToAccount(key, uid));
      if (keys.length) await AsyncStorage.multiRemove(keys);
    })(),
  ]);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Some local data could not be removed. You are still connected so you can retry.');
  }
}
