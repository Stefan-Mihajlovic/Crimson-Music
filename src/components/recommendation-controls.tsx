import { useRef, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type SymbolViewProps } from '@/components/app-symbol';
import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useRecommendationFeedback } from '@/hooks/use-recommendation-feedback';
import { saveRecommendationFeedback } from '@/services/recommendation-feedback';
import type { FeedbackAction } from '@/services/recommendation-feedback-model';
import type { CrimsonSong } from '@/types/music';

type RecommendationAction = { icon: Extract<SymbolViewProps['name'], string>; label: string; selected: boolean; disabled: boolean; onPress: () => void };

export default function RecommendationControls({ song, ActionComponent }: { song: CrimsonSong; ActionComponent: ComponentType<RecommendationAction> }) {
  const { user } = useAuth();
  const { colors } = useAppSettings();
  const feedback = useRecommendationFeedback();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  if (!user?.uid || song.source === 'local') return null;
  const choose = async (action: FeedbackAction) => {
    if (busy.current) return;
    busy.current = true; setSaving(true);
    try { await saveRecommendationFeedback(user.uid, song, action); setMessage(''); }
    catch { setMessage('Could not save your preference. Please try again.'); }
    finally { busy.current = false; setSaving(false); }
  };
  const choices: { action: FeedbackAction; icon: Extract<SymbolViewProps['name'], string>; label: string; selected: boolean }[] = [
    { action: 'more', icon: 'sparkles', label: 'More like this', selected: Boolean(feedback.liked[song.id]) },
    { action: 'hide-song', icon: 'minus.circle', label: feedback.hiddenSongs.includes(song.id) ? 'Recommend this song again' : 'Don’t recommend this song', selected: feedback.hiddenSongs.includes(song.id) },
    ...(song.artistId ? [{ action: 'hide-artist' as const, icon: 'person' as const, label: feedback.hiddenArtists.includes(song.artistId) ? 'Recommend this artist again' : 'Don’t recommend this artist', selected: feedback.hiddenArtists.includes(song.artistId) }] : []),
  ];
  return <>
    {choices.map((choice) => <ActionComponent key={choice.action}
      icon={choice.icon} label={choice.label} selected={choice.selected} disabled={saving}
      onPress={() => void choose(choice.action)} />)}
    {message ? <View style={styles.error}><Text accessibilityLiveRegion="polite" style={{ color: colors.secondaryText }}>{message}</Text></View> : null}
  </>;
}
const styles = StyleSheet.create({ error: { paddingHorizontal: 22, paddingVertical: 12 } });
