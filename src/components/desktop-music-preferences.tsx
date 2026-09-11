import type { ImageSource } from 'expo-image';
import type { RecommendationStyle } from '@/services/auth';

export type DesktopMusicPreferencesProps = {
  categories: readonly { id: string; label: string; image: ImageSource }[];
  recommendationOptions: readonly { id: RecommendationStyle; label: string }[];
  selectedCategories: string[];
  recommendationStyle: RecommendationStyle;
  onToggleCategory: (id: string) => void;
  onSelectRecommendation: (style: RecommendationStyle) => void;
  onSave: () => void;
  onClose?: () => void;
  saving: boolean;
  error: string;
  editing: boolean;
};

/** Touch devices keep the existing onboarding gestures. */
export default function DesktopMusicPreferences(_props: DesktopMusicPreferencesProps) {
  return null;
}
