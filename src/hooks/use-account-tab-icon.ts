import { useEffect, useMemo, useState } from 'react';
import { Image as NativeImage, type ImageSourcePropType, NativeModules, Platform } from 'react-native';

import { profileImageSource } from '@/components/profile-images';
import { useAuth } from '@/providers/auth-provider';
import { reportError } from '@/services/telemetry';

const preparedIcons = new Map<string, ImageSourcePropType>();
const pendingIcons = new Map<string, Promise<ImageSourcePropType>>();
// A transparent pixel also keeps older development binaries safe until rebuilt
// with the circular placeholder constant. Never expose the uncropped photo to iOS.
const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const fallbackIcon: ImageSourcePropType = {
  uri: NativeModules.CrimsonRemoteControls?.accountTabFallbackIcon || transparentPixel,
  width: 28, height: 28, scale: 3,
};

export function useAccountTabIcon(): ImageSourcePropType {
  const { user } = useAuth();
  const photo = user?.ProfilePhoto || '1';
  const source = useMemo(() => {
    const image = profileImageSource(photo) as ImageSourcePropType;
    const resolved = NativeImage.resolveAssetSource(image);
    return resolved ? { ...resolved, width: 28, height: 28 } : image;
  }, [photo]);
  const [prepared, setPrepared] = useState<{ photo: string; source: ImageSourcePropType }>();

  useEffect(() => {
    const createIcon = NativeModules.CrimsonRemoteControls?.createCircularTabIcon as
      ((uri: string) => Promise<string>) | undefined;
    if (Platform.OS !== 'ios' || !createIcon) return;
    const cached = preparedIcons.get(photo);
    if (cached) return;
    const resolved = NativeImage.resolveAssetSource(source);
    if (!resolved?.uri) return;
    let active = true;
    let pending = pendingIcons.get(photo);
    if (!pending) {
      pending = createIcon(resolved.uri).then((uri) => {
        const icon = { uri, width: 28, height: 28, scale: 3 };
        preparedIcons.set(photo, icon);
        return icon;
      }).finally(() => pendingIcons.delete(photo));
      pendingIcons.set(photo, pending);
    }
    void pending.then((icon) => {
      if (active) setPrepared({ photo, source: icon });
    }).catch((error) => reportError(error, 'account.tab-icon'));
    return () => { active = false; };
  }, [photo, source]);

  // react-native-screens loads source changes asynchronously without cancelling
  // previous loads. A raw photo can finish after the PNG and restore square edges.
  // Both the first source and every replacement must therefore already be round.
  return prepared?.photo === photo ? prepared.source : preparedIcons.get(photo) || (Platform.OS === 'ios' ? fallbackIcon : source);
}
