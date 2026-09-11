import { Platform } from 'react-native';

/** Release the old scene before navigation applies aria-hidden to it. */
export function releaseWebNavigationFocus() {
  if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
