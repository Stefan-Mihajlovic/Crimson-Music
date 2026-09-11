import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { View } from 'react-native';

/** Navigation chrome lives above the root stack, including collection/player routes. */
export default function AppTabs() {
  return (
    <Tabs style={{ flex: 1, minHeight: 0 }}>
      <TabSlot style={{ flex: 1, minHeight: 0 }} />
      <TabList asChild>
        <View style={{ display: 'none' }}>
          <TabTrigger name="home" href="/(app)/(home)" />
          <TabTrigger name="search" href="/(app)/(search)/search" />
          <TabTrigger name="library" href="/(app)/(library)/library" />
          <TabTrigger name="account" href="/(app)/(account)/account" />
        </View>
      </TabList>
    </Tabs>
  );
}
