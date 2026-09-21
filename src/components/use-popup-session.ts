import { useLayoutEffect, useRef, useState } from 'react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { releaseWebNavigationFocus } from '@/services/navigation-focus';
import { createPopupSession, getPopupSession, isPopupSessionActive, mountPopupSession, revokePopupSession, type PopupKind, type PopupSession } from '@/services/popup-sessions';

export function usePopupLauncher(uid: string | undefined) {
  const router = useRouter();
  const current = useRef<PopupSession | undefined>(undefined);
  const [openSession, setOpenSession] = useState<PopupSession | undefined>(undefined);
  useLayoutEffect(() => () => {
    if (current.current) revokePopupSession(current.current.id);
    current.current = undefined;
  }, [uid]);

  function launch<K extends PopupKind>(kind: K, payload: PopupSession<K>['payload']) {
    if (!uid || (current.current && isPopupSessionActive(current.current))) return;
    const session = createPopupSession(uid, kind, payload, () => {
      if (current.current !== session) return;
      current.current = undefined;
      setOpenSession(undefined);
    });
    current.current = session;
    setOpenSession(session);
    releaseWebNavigationFocus();
    router.push({ pathname: `/${kind}`, params: { session: session.id } } as Href);
  }
  return { launch, open: Boolean(openSession && openSession.uid === uid && isPopupSessionActive(openSession)) };
}

export function usePopupRoute<K extends PopupKind>(kind: K) {
  const { session: id } = useLocalSearchParams<{ session?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const session = getPopupSession(String(id || ''), user?.uid, kind);
  useLayoutEffect(() => session ? mountPopupSession(session) : undefined, [session]);
  const dismiss = () => {
    releaseWebNavigationFocus();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return { session, dismiss };
}
