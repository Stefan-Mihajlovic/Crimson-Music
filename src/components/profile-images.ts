import { ImageSource } from 'expo-image';

export const profilePresets: Record<string, ImageSource> = {
  '1': require('@/assets/images/home/profiles/1.png'),
  '2': require('@/assets/images/home/profiles/2.png'),
  '3': require('@/assets/images/home/profiles/3.png'),
  '4': require('@/assets/images/home/profiles/4.png'),
  '5': require('@/assets/images/home/profiles/5.png'),
  '6': require('@/assets/images/home/profiles/6.png'),
};

export function profileImageSource(value: string): ImageSource {
  return profilePresets[value] || { uri: value };
}
