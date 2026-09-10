import { Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassPressable from '@/components/glass-pressable';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';

export default function OfflineModeBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { downloadedCount, ready } = useDownloads();
  const { isOffline } = useNetwork();

  if (!isOffline || !user) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <GlassPressable
        accessibilityLabel={`Offline mode. ${downloadedCount} songs available.`}
        contentStyle={styles.content}
        height={42}
        onPress={() => router.push('/(app)/(home)/offline-listening' as Href)}
        prominent
        shape="capsule"
        style={[styles.banner, { top: insets.top + 6 }]}
        tintColor="rgba(104, 53, 157, 0.42)">
        <SymbolView name="wifi.slash" size={15} tintColor="#FFFFFF" weight="semibold" />
        <Text style={styles.label}>OFFLINE MODE</Text>
        <View style={styles.divider} />
        <Text style={styles.count}>{ready ? `${downloadedCount} saved` : 'Loading…'}</Text>
        <SymbolView name="chevron.right" size={11} tintColor="rgba(255,255,255,0.72)" weight="semibold" />
      </GlassPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1000,
    width: 252,
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  label: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  divider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: 'rgba(255,255,255,0.35)' },
  count: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700' },
});
