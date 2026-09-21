import { Redirect } from 'expo-router';
import { SearchFiltersForm } from '@/components/advanced-search-filters';
import ResponsivePopup from '@/components/responsive-popup';
import { usePopupRoute } from '@/components/use-popup-session';
import { isPopupSessionActive } from '@/services/popup-sessions';

export default function SearchFiltersScreen() {
  const { session, dismiss } = usePopupRoute('search-filters');
  if (!session) return <Redirect href="/" />;
  return <ResponsivePopup label="Song filters" onDismiss={dismiss} width={520} expanded>
    <SearchFiltersForm value={session.payload.value} onClose={dismiss} onChange={(value) => {
      if (isPopupSessionActive(session)) session.payload.onChange(value);
    }} />
  </ResponsivePopup>;
}
