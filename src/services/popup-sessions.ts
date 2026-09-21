import type { AdvancedSearchFilters } from '@/services/search-filters';
import type { CrimsonPlaylist, CrimsonSong } from '@/types/music';

type PopupPayloads = {
  'search-filters': {
    value: AdvancedSearchFilters;
    onChange: (filters: AdvancedSearchFilters) => void;
  };
  'playlist-editor': {
    playlist: CrimsonPlaylist;
    songs: CrimsonSong[];
    onSaved: (playlist: CrimsonPlaylist) => void;
    onDeleted: () => void;
  };
};
export type PopupKind = keyof PopupPayloads;
export type PopupSession<K extends PopupKind = PopupKind> = {
  id: string;
  uid: string;
  kind: K;
  payload: PopupPayloads[K];
  onClose: () => void;
  completion?: () => void;
  mount: number;
};

const sessions = new Map<string, PopupSession>();
let nextSession = 0;

/** Routes carry only an opaque ID; callbacks and account data stay in memory. */
export function createPopupSession<K extends PopupKind>(uid: string, kind: K, payload: PopupPayloads[K], onClose: () => void) {
  const session: PopupSession<K> = { id: `popup-${Date.now().toString(36)}-${++nextSession}`, uid, kind, payload, onClose, mount: 0 };
  sessions.set(session.id, session);
  return session;
}

export function getPopupSession<K extends PopupKind>(id: string, uid: string | undefined, kind: K): PopupSession<K> | undefined {
  const session = sessions.get(id);
  return session && session.uid === uid && session.kind === kind ? session as PopupSession<K> : undefined;
}

export function isPopupSessionActive(session: PopupSession) {
  return sessions.get(session.id) === session;
}

/** Owner unmount/account changes revoke callbacks, including in-flight writes. */
export function revokePopupSession(id: string) {
  sessions.delete(id);
}

export function completePopupSession(session: PopupSession, completion: () => void) {
  if (isPopupSessionActive(session)) session.completion = completion;
}

/** Notify the source only after navigation has removed the sheet. */
export function mountPopupSession(session: PopupSession) {
  const mount = ++session.mount;
  return () => {
    // React Strict Mode immediately mounts effects again; this isn't dismissal.
    void Promise.resolve().then(() => {
      if (session.mount !== mount || !isPopupSessionActive(session)) return;
      sessions.delete(session.id);
      session.onClose();
      session.completion?.();
    });
  };
}
