import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadFailure from '@/components/load-failure';
import DetailSongRow from '@/components/detail-song-row';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import { CrimsonEvent, loadEventDetail } from '@/services/music';

const fallbackArtwork = require('@/assets/images/categories/events.jpg');

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { artistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();
  const { colors, reduceMotion } = useAppSettings();
  const [event, setEvent] = useState<CrimsonEvent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setLoadError(false);
        setEvent(null);
      }
    });
    loadEventDetail(String(id))
      .then((value) => {
        if (active) setEvent(value);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  if (!event)
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        {loadError ? (
          <LoadFailure
            title="Event unavailable"
            onRetry={() => setRetry((value) => value + 1)}
          />
        ) : (
          <ActivityIndicator color={colors.accent} size="large" />
        )}
      </View>
    );

  const deadline =
    event.endDate && Number.isFinite(Date.parse(event.endDate))
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
          new Date(event.endDate),
        )
      : 'No closing date';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Event' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image
            source={event.image ? { uri: event.image } : fallbackArtwork}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', 'rgba(11,8,16,0.65)', colors.background]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.overline}>
              AUDIUS{' '}
              {event.type === 'remix_contest' ? 'REMIX CONTEST' : 'EVENT'}
            </Text>
            <Text style={styles.title}>{event.title}</Text>
            <Pressable
              disabled={!event.hostId}
              onPress={() =>
                event.hostId && router.push(artistHref(event.hostId))
              }
            >
              <Text style={styles.host}>Hosted by {event.hostName}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.stats}>
            <Stat icon="calendar" label="Deadline" value={deadline} />
            <Stat
              icon="music.note.list"
              label="Entries"
              value={String(event.entryCount)}
            />
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(event.permalink)}
            style={({ pressed }) => [
              styles.openButton,
              { backgroundColor: colors.accent },
              pressed && styles.pressed,
              pressed && !reduceMotion && styles.pressedScale,
            ]}
          >
            <Text style={styles.openButtonText}>Open event on Audius</Text>
            <SymbolView
              name="arrow.up.right"
              size={17}
              tintColor="#FFFFFF"
              weight="bold"
            />
          </Pressable>

          {event.prizeInfo ? (
            <Section title="Prizes" body={event.prizeInfo} />
          ) : null}
          {event.description ? (
            <Section title="About" body={event.description} />
          ) : null}
          {event.track ? (
            <View style={styles.trackSection}>
              <Text style={[styles.heading, { color: colors.text }]}>
                Source track
              </Text>
              <DetailSongRow
                song={event.track}
                onPress={() =>
                  event.track &&
                  playSong(event.track, [event.track], event.title)
                }
                onLongPress={() =>
                  event.track &&
                  router.push(
                    actionSheetHref({
                      type: 'song',
                      id: event.track.id,
                      title: event.track.title,
                      subtitle: event.track.creator,
                      image: event.track.imageSmall || event.track.image,
                      artistId: event.track.artistId,
                    }),
                  )
                }
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: 'calendar' | 'music.note.list';
  label: string;
  value: string;
}) {
  const { colors } = useAppSettings();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <SymbolView
        name={icon}
        size={18}
        tintColor={colors.accent}
        weight="semibold"
      />
      <Text style={[styles.statLabel, { color: colors.secondaryText }]}>
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={[styles.statValue, { color: colors.text }]}
      >
        {value}
      </Text>
    </View>
  );
}

function Section({ body, title }: { body: string; title: string }) {
  const { colors } = useAppSettings();
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.bodyText, { color: colors.secondaryText }]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 390, justifyContent: 'flex-end', backgroundColor: '#211C28' },
  heroCopy: { paddingHorizontal: 22, paddingBottom: 24 },
  overline: {
    color: '#D5B7FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 7,
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1.1,
  },
  host: { marginTop: 10, color: '#D4CDD9', fontSize: 14, fontWeight: '700' },
  body: { paddingHorizontal: 18 },
  stats: { marginTop: 18, flexDirection: 'row', gap: 10 },
  stat: {
    minHeight: 94,
    flex: 1,
    padding: 13,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { marginTop: 7, fontSize: 11, fontWeight: '700' },
  statValue: { marginTop: 3, fontSize: 14, fontWeight: '800' },
  openButton: {
    minHeight: 52,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
  },
  openButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  section: { marginTop: 26 },
  trackSection: { marginTop: 26, marginHorizontal: -6 },
  heading: { marginBottom: 9, fontSize: 23, fontWeight: '900' },
  bodyText: { fontSize: 15, lineHeight: 22 },
  pressed: { opacity: 0.8 },
  pressedScale: { transform: [{ scale: 0.98 }] },
});
