import { Redirect } from 'expo-router';
import PlaylistEditor from '@/components/playlist-editor';
import { usePopupRoute } from '@/components/use-popup-session';
import { completePopupSession, isPopupSessionActive } from '@/services/popup-sessions';

export default function PlaylistEditorScreen() {
  const { session, dismiss } = usePopupRoute('playlist-editor');
  if (!session) return <Redirect href="/" />;
  return <PlaylistEditor uid={session.uid} playlist={session.payload.playlist} songs={session.payload.songs}
    isActive={() => isPopupSessionActive(session)} onClose={dismiss}
    onSaved={(playlist) => completePopupSession(session, () => session.payload.onSaved(playlist))}
    onDeleted={() => completePopupSession(session, session.payload.onDeleted)} />;
}
