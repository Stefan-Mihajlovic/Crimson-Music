export const PERSONALIZATION_CATEGORY_IDS = [
  'electronic', 'hip-hop-rap', 'pop', 'r-b-soul', 'rock',
  'ambient', 'jazz', 'classical', 'reggae', 'podcasts',
] as const;
export type PersonalizationCategoryId = typeof PERSONALIZATION_CATEGORY_IDS[number];
export const MINIMUM_PERSONALIZATION_CATEGORIES = 2;

/** Accept existing stored IDs and display labels, but never count duplicates or unknown genres. */
export function normalizeFavoriteCategories(value: unknown): PersonalizationCategoryId[] {
  if (!Array.isArray(value)) return [];
  const result = new Set<PersonalizationCategoryId>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if ((PERSONALIZATION_CATEGORY_IDS as readonly string[]).includes(id)) result.add(id as PersonalizationCategoryId);
  }
  return [...result];
}

export function hasSavedPersonalization(value: { FavoriteCategories?: unknown; OnboardingComplete?: unknown } | null | undefined) {
  // Older installations saved the final selections without a completion flag.
  return !!value && (value.OnboardingComplete === undefined || value.OnboardingComplete === true)
    && normalizeFavoriteCategories(value.FavoriteCategories).length >= MINIMUM_PERSONALIZATION_CATEGORIES;
}
