import { Image } from 'expo-image';
import {
  TabList,
  TabListProps,
  TabSlot,
  Tabs,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { profileImageSource } from '@/components/profile-images';
import { useAuth } from '@/providers/auth-provider';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  const { user } = useAuth();
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <CustomTabList>
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
            <TabButton icon={<Image contentFit="cover" source={profileImageSource(user?.ProfilePhoto || '1')} style={styles.avatar} />}>Account</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, icon, isFocused, ...props }: TabTriggerSlotProps & { icon?: ReactNode }) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButton,
        isFocused && styles.tabButtonFocused,
        pressed && styles.pressed,
      ]}>
      {icon}
      <Text style={[styles.tabText, isFocused && styles.tabTextFocused]}>{children}</Text>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        <Text style={styles.brand}>Crimson Music</Text>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 24,
    padding: Spacing.two,
    backgroundColor: Colors.dark.backgroundElement,
  },
  brand: {
    color: Colors.dark.text,
    fontWeight: '700',
    marginHorizontal: Spacing.two,
    marginRight: 'auto',
  },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabButtonFocused: {
    backgroundColor: Colors.dark.backgroundSelected,
  },
  tabText: {
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  tabTextFocused: {
    color: Colors.dark.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
