import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

export function useMainHeaderScroll() {
  const offset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.y;
    },
  });
  return { offset, onScroll };
}
