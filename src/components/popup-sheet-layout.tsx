import type { ReactElement, ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * iOS resizes the sheet's scroll view independently of React sibling layout.
 * Put its heading INSIDE that scroll view (or ListHeaderComponent) so both are
 * always laid out together, including the first frame and detent changes.
 * Other platforms keep the heading outside their ordinary flex scroll area.
 */
export default function PopupSheetLayout({ children, header, style }: {
  children: (inlineHeader: ReactElement | null) => ReactNode;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  if (Platform.OS === 'ios') return <>{children(header ? <>{header}</> : null)}</>;
  return <View style={[{ flex: 1, minHeight: 0 }, style]}>
    {header}
    {children(null)}
  </View>;
}
