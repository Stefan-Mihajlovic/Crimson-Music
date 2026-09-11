import { Image } from 'expo-image';
import {
  TabList,
  TabSlot,
  Tabs,
  TabTrigger,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { profileImageSource } from '@/components/profile-images';
import WebPlayerBar from '@/components/web-player-bar';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
export default function AppTabs() {
  const { user } = useAuth();
  const { colors } = useAppSettings();
  const { currentSong } = usePlayer();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const playerHeight = currentSong ? 104 : 0;
  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          paddingLeft: desktop ? 210 : 0,
          paddingTop: desktop ? 0 : 64,
          paddingBottom: playerHeight,
        }}
      >
        <TabSlot style={{ flex: 1 }} />
      </View>
      <TabList asChild>
        <View
          style={[
            styles.navigation,
            desktop
              ? {
                  top: 0,
                  left: 0,
                  bottom: playerHeight,
                  width: 210,
                  paddingTop: 32,
                  flexDirection: 'column',
                }
              : { top: 0, left: 0, right: 0, height: 64, flexDirection: 'row' },
            { backgroundColor: colors.elevated, borderColor: colors.border },
          ]}
        >
          {desktop ? (
            <Text style={[styles.brand, { color: colors.text }]}>
              Crimson Music
            </Text>
          ) : null}
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="search" href="/search" asChild>
            <TabButton>Search</TabButton>
          </TabTrigger>
          <TabTrigger name="library" href="/library" asChild>
            <TabButton>Library</TabButton>
          </TabTrigger>
          <TabTrigger name="account" href="/(app)/(account)/account" asChild>
            <TabButton
              icon={
                <Image
                  source={profileImageSource(user?.ProfilePhoto || '1')}
                  style={styles.avatar}
                />
              }
            >
              Account
            </TabButton>
          </TabTrigger>
        </View>
      </TabList>
      <WebPlayerBar />
    </Tabs>
  );
}
function TabButton({
  children,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon?: ReactNode }) {
  const { colors } = useAppSettings();
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={[
        styles.tab,
        { backgroundColor: isFocused ? colors.accentSoft : 'transparent' },
      ]}
    >
      {icon}
      <Text
        style={{
          color: isFocused ? colors.accent : colors.secondaryText,
          fontWeight: '700',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  navigation: {
    position: 'absolute',
    padding: 12,
    gap: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    fontWeight: '800',
    fontSize: 23,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  tab: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  avatar: { height: 22, width: 22, borderRadius: 11 },
});
