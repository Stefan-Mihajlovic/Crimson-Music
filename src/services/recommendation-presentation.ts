import type { RecommendationStyle } from '@/services/auth';

export const recommendationDetails = {
  familiar: { icon: 'heart.fill', description: 'More of the sounds you already love.' },
  balanced: { icon: 'shuffle', description: 'Favorite sounds, with fresh discoveries.' },
  surprise: { icon: 'sparkles', description: 'New artists and unexpected directions.' },
  underground: { icon: 'waveform', description: 'Niche scenes and hidden gems.' },
} as const;

export const recommendationOrder: RecommendationStyle[] = ['familiar', 'balanced', 'surprise', 'underground'];
