import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Href, useRouter } from 'expo-router';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import Reanimated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MainNativeHeader from '@/components/main-native-header';
import MainScreenBackground from '@/components/main-screen-background';
import MainHeaderOverlay, { MainHeaderSpacer } from '@/components/main-header-overlay';
import { useMainHeaderScroll } from '@/hooks/use-main-header-scroll';
import { profileImageSource } from '@/components/profile-images';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { AppThemeMode, useAppSettings } from '@/providers/settings-provider';
import { CrimsonAuthError } from '@/services/auth';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerScroll = useMainHeaderScroll();
  const { disconnectAndClearLocalData, signOut, updateTheme, user } = useAuth();
  const downloads = useDownloads();
  const { colors, dataSaver, performanceMode, reduceMotion, theme, updateSettings } = useAppSettings();
  const [clearingLocalData, setClearingLocalData] = useState(false);
  const photo = user?.ProfilePhoto || '1';
  const profileSource = profileImageSource(photo);

  const selectTheme = (nextTheme: AppThemeMode) => {
    updateSettings({ theme: nextTheme });
    void updateTheme(nextTheme).catch(() => Alert.alert('Could not save theme', 'Please try selecting your theme again.'));
  };

  const confirmSignOut = () => Alert.alert('Log out of Audius in Crimson?', 'Your downloaded music and device preferences stay on this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log Out', style: 'destructive', onPress: () => void signOut().catch(() => Alert.alert('Could not log out', 'Please try again.')) },
  ]);

  const clearAccountData = async () => {
    if (clearingLocalData) return;
    setClearingLocalData(true);
    try {
      await disconnectAndClearLocalData();
      router.replace('/welcome');
    } catch (error) {
      Alert.alert(
        'Could not clear local data',
        error instanceof CrimsonAuthError
          ? error.message
          : 'Some device data could not be removed. Please try again.',
      );
    } finally {
      setClearingLocalData(false);
    }
  };

  const confirmLocalDataClear = () => Alert.alert(
    'Disconnect and clear this device?',
    'Remove this account’s downloads, listening history, cached library, and preferences from this device, then log out. Your Audius account and library are unchanged.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear & Disconnect',
        style: 'destructive',
        onPress: () => void clearAccountData(),
      },
    ],
  );

  return (
    <MainScreenBackground>
      <MainNativeHeader title="Account" offset={headerScroll.offset} />
      <Reanimated.ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        directionalLockEnabled
        showsVerticalScrollIndicator={false}>
        <MainHeaderSpacer />
        <Text style={[styles.sectionLabel, styles.firstSectionLabel, { color: colors.mutedText }]}>ACCOUNT</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View your Audius profile"
          onPress={() => router.push('/(app)/(account)/profile')}
          style={({ pressed }) => [
            styles.account,
            pressed && [styles.rowPressed, { backgroundColor: colors.accentSoft }],
          ]}>
          <Image contentFit="cover" source={profileSource} style={styles.avatar} />
          <View style={styles.accountCopy}>
            <Text style={[styles.accountName, { color: colors.text }]}>{user?.DisplayName || user?.Username}</Text>
            <Text numberOfLines={1} style={[styles.accountEmail, { color: colors.secondaryText }]}>@{user?.Username} · Audius</Text>
          </View>
          <SymbolView name="chevron.right" size={16} tintColor={colors.mutedText} weight="semibold" />
        </Pressable>
          <Divider />
          <SettingsLink
            icon="clock.arrow.circlepath"
            title="Listening History"
            subtitle="Revisit music you have played in Crimson."
            onPress={() => router.push('/(app)/(account)/history' as Href)}
          />
          <Divider />
          <SettingsLink
            icon="wand.and.stars"
            title="Music Preferences"
            subtitle="Choose genres and discovery preferences for this device."
            onPress={() => router.push({ pathname: '/onboarding', params: { mode: 'edit' } })}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>APPEARANCE</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <View style={styles.themeHeader}><SymbolView name="circle.lefthalf.filled" size={21} tintColor={colors.accent} /><Text style={[styles.rowTitle, { color: colors.text }]}>Theme</Text></View>
          <View style={[styles.segmented, { backgroundColor: colors.surfaceStrong }]}>
            {(['Light', 'Dark', 'Auto'] as AppThemeMode[]).map((item) => (
              <Pressable key={item} onPress={() => selectTheme(item)} style={[styles.segment, theme === item && [styles.segmentActive, { backgroundColor: colors.accent }]]}>
                <Text style={[styles.segmentText, { color: colors.secondaryText }, theme === item && styles.segmentTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>PLAYBACK & EXPERIENCE</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <SettingsToggle icon="antenna.radiowaves.left.and.right" title="Data Saver" subtitle="Uses smaller artwork, loads less discovery data, and saves offline music only over Wi-Fi. Streaming audio quality stays the same." value={dataSaver} onValueChange={(value) => updateSettings({ dataSaver: value })} />
          <Divider />
          <SettingsToggle icon="figure.walk.motion" title="Reduce Motion" subtitle="Minimizes player movement and animated transitions." value={reduceMotion} onValueChange={(value) => updateSettings({ reduceMotion: value })} />
          <Divider />
          <SettingsToggle icon="bolt.fill" title="Performance Mode" subtitle="Uses solid controls and navigation, and reduces animated artwork and visual effects." value={performanceMode} onValueChange={(value) => updateSettings({ performanceMode: value })} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>OFFLINE LISTENING</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <SettingsToggle
            disabled={!downloads.supported}
            icon="icloud.and.arrow.down.fill"
            title="Offline Listening"
            subtitle={downloads.supported
              ? 'Save any available stream and listen without a connection.'
              : 'Offline listening is available in the iOS and Android apps.'}
            value={downloads.enabled}
            onValueChange={downloads.setEnabled}
          />
          <Divider />
          <SettingsLink
            disabled={!downloads.supported}
            icon="slider.horizontal.3"
            title="Offline Listening Settings"
            subtitle={downloads.downloadedCount
              ? `Manage ${downloads.downloadedCount} saved ${downloads.downloadedCount === 1 ? 'song' : 'songs'}, automation and storage.`
              : 'Manage saved music, automation and storage.'}
            onPress={() => router.push('/(app)/(account)/offline-listening-settings' as Href)}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>SUPPORT & ABOUT</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <SettingsLink icon="doc.text.fill" title="Licenses & Attribution" subtitle="Artwork credits and open-source licenses." onPress={() => router.push('/(app)/(account)/licenses')} />
          <Divider />
          <SettingsLink external icon="chevron.left.forwardslash.chevron.right" title="GitHub" subtitle="View the Crimson Music project." onPress={() => void Linking.openURL('https://github.com/Stefan-Mihajlovic/Crimson-Music')} />
        </View>

        <Text style={[styles.sectionLabel, { color: '#FF6476' }]}>THIS DEVICE</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: 'rgba(255,100,118,0.34)' }]}>
          <Pressable
            accessibilityRole="button"
            disabled={clearingLocalData}
            onPress={confirmSignOut}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.deletePressed,
              clearingLocalData && styles.disabled,
            ]}>
            <SymbolView name="rectangle.portrait.and.arrow.right" size={21} tintColor="#FF6476" />
            <View style={styles.rowCopy}>
              <Text style={styles.deleteTitle}>Log Out</Text>
              <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>
                Log out of Audius in Crimson on this device.
              </Text>
            </View>
            <SymbolView name="chevron.right" size={15} tintColor="#FF6476" weight="semibold" />
          </Pressable>
          <Divider />
          <Pressable
            accessibilityRole="button"
            disabled={clearingLocalData}
            onPress={confirmLocalDataClear}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.deletePressed,
              clearingLocalData && styles.disabled,
            ]}>
            <SymbolView name="trash.fill" size={21} tintColor="#FF6476" />
            <View style={styles.rowCopy}>
              <Text style={styles.deleteTitle}>Clear Data & Disconnect</Text>
              <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>
                Remove downloaded music and local account data from this device.
              </Text>
            </View>
            {clearingLocalData
              ? <ActivityIndicator color="#FF6476" size="small" />
              : <SymbolView name="chevron.right" size={15} tintColor="#FF6476" weight="semibold" />}
          </Pressable>
        </View>

        <View style={styles.version}>
          <Text style={[styles.versionTitle, { color: colors.accent }]}>CRIMSON MUSIC®</Text>
          <Text style={[styles.versionText, { color: colors.mutedText }]}>Version {Constants.expoConfig?.version || '1.0.0'} · Copyright © {new Date().getFullYear()}</Text>
        </View>
      </Reanimated.ScrollView>
      <MainHeaderOverlay title="Account" offset={headerScroll.offset} />
    </MainScreenBackground>
  );
}

function Divider() {
  const { colors } = useAppSettings();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function SettingsToggle({ disabled, icon, onValueChange, subtitle, title, value }: { disabled?: boolean; icon: SymbolViewProps['name']; onValueChange: (value: boolean) => void; subtitle: string; title: string; value: boolean }) {
  const { colors } = useAppSettings();
  return <View style={[styles.row, disabled && styles.disabled]}><SymbolView name={icon} size={21} tintColor={colors.accent} /><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text></View><View style={styles.toggleSlot}><Switch disabled={disabled} onValueChange={onValueChange} trackColor={{ false: colors.surfaceStrong, true: colors.accent }} value={value} /></View></View>;
}

function SettingsLink({ disabled, external, icon, onPress, subtitle, title }: { disabled?: boolean; external?: boolean; icon: SymbolViewProps['name']; onPress: () => void; subtitle: string; title: string }) {
  const { colors } = useAppSettings();
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, disabled && styles.disabled, pressed && [styles.rowPressed, { backgroundColor: colors.accentSoft }]]}><SymbolView name={icon} size={21} tintColor={colors.accent} /><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text></View><SymbolView name={external ? 'arrow.up.right' : 'chevron.right'} size={15} tintColor={colors.mutedText} weight="semibold" /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 180 },
  account: { minHeight: 92, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#29232F', borderWidth: 2, borderColor: 'rgba(213,187,255,0.72)' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: '#F6F1FF', fontSize: 20, fontWeight: '700' },
  accountEmail: { marginTop: 3, color: '#9992A2', fontSize: 13 },
  sectionLabel: { marginTop: 28, marginBottom: 8, marginLeft: 14, color: '#8E8796', fontSize: 12, fontWeight: '600' },
  firstSectionLabel: { marginTop: 0 },
  group: { overflow: 'hidden', borderRadius: 22, backgroundColor: '#1C1921', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  themeHeader: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  segmented: { height: 44, marginHorizontal: 12, marginBottom: 12, flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: '#302B36' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: '#5F3B8D' },
  segmentText: { color: '#A59DAD', fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: '#FFFFFF' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 10 },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  rowCopy: { flex: 1, minWidth: 0 },
  toggleSlot: { alignSelf: 'stretch', justifyContent: 'center' },
  rowTitle: { color: '#F4EFFF', fontSize: 16, fontWeight: '600' },
  rowSubtitle: { marginTop: 3, color: '#928B9B', fontSize: 12, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 50, backgroundColor: 'rgba(255,255,255,0.12)' },
  version: { alignItems: 'center', gap: 5, paddingVertical: 28 },
  versionTitle: { color: '#A978FA', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  versionText: { color: '#77717F', fontSize: 11 },
  deleteTitle: { color: '#FF6476', fontSize: 16, fontWeight: '700' },
  deletePressed: { backgroundColor: 'rgba(255,100,118,0.09)' },
  disabled: { opacity: 0.58 },
});
