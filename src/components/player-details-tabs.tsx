import PillSegmentedControl from '@/components/pill-segmented-control';
import { PlayerDetailsTabsProps } from '@/components/player-details-tabs.types';
import { POPUP_CLOSE_CLEARANCE, POPUP_MOBILE_INSET } from '@/components/popup-layout';
import { Platform } from 'react-native';

export default function PlayerDetailsTabs({ onChange, value }: PlayerDetailsTabsProps) {
  return <PillSegmentedControl
    options={[{ label: 'UP NEXT', value: 'queue' }, { label: 'RELATED', value: 'related' }]}
    value={value === 'lyrics' ? 'queue' : value} onChange={onChange}
    style={[
      { marginTop: 14, marginHorizontal: 20, marginBottom: 8 },
      Platform.OS === 'web' && { marginTop: POPUP_MOBILE_INSET, marginHorizontal: POPUP_MOBILE_INSET, marginRight: POPUP_MOBILE_INSET + POPUP_CLOSE_CLEARANCE },
    ]}
  />;
}
