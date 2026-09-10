// Shared with non-React network services; hydrated before app screens mount.
let dataSaver = false;
const listeners = new Set<() => void>();

export const getDataSaverEnabled = () => dataSaver;

export function setDataSaverEnabled(enabled: boolean) {
  if (dataSaver === enabled) return;
  dataSaver = enabled;
  listeners.forEach((listener) => listener());
}

export function subscribeToDataSaver(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function discoveryRequestLimits() {
  return dataSaver
    ? { tracks: 24, artists: 12, extraArtists: 0, playlists: 6, vaultGenres: 2, vaultTracks: 20 }
    : { tracks: 60, artists: 24, extraArtists: 18, playlists: 12, vaultGenres: 3, vaultTracks: 35 };
}

export function downloadsRequireWifi(wifiOnly: boolean) {
  return wifiOnly || dataSaver;
}
