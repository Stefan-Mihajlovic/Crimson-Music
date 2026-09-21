/** Filter values and REST parameter names from https://api.audius.co/v1/swagger.yaml. */
export type AdvancedSearchFilters = {
  genre?: string;
  mood?: string;
  bpmMin?: number;
  bpmMax?: number;
  musicalKey?: string;
  downloadableOnly?: boolean;
};

export const searchGenres = ['Electronic', 'Hip-Hop/Rap', 'Pop', 'R&B/Soul', 'Rock', 'Alternative', 'Ambient', 'Jazz', 'Classical', 'House', 'Tech House', 'Deep House', 'Techno', 'Drum & Bass', 'Dubstep', 'Trap', 'Lo-Fi', 'Downtempo', 'Disco', 'Trance', 'Metal', 'Punk', 'Folk', 'Acoustic', 'Funk', 'Reggae', 'Country', 'Blues', 'Latin', 'World', 'Experimental', 'Soundtrack', 'Hyperpop', 'Dancehall', 'Electro', 'Jungle', 'Progressive House', 'Hardstyle', 'Glitch Hop', 'Future Bass', 'Future House', 'Tropical House', 'Jersey Club', 'Vaporwave', 'Moombahton', 'Devotional', 'Podcasts', 'Spoken Word', 'Comedy', 'Kids', 'Audiobooks'];
export const searchMoods = ['Peaceful', 'Romantic', 'Sentimental', 'Tender', 'Easygoing', 'Yearning', 'Sophisticated', 'Sensual', 'Cool', 'Gritty', 'Melancholy', 'Serious', 'Brooding', 'Fiery', 'Defiant', 'Aggressive', 'Rowdy', 'Excited', 'Energizing', 'Empowering', 'Stirring', 'Upbeat', 'Other'];
export const searchKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];

export function normalizeSearchFilters(filters: AdvancedSearchFilters = {}): AdvancedSearchFilters {
  const bpm = (value?: number) => value !== undefined && Number.isFinite(value) && value >= 1 && value <= 999 ? Math.round(value) : undefined;
  const bpmMin = bpm(filters.bpmMin);
  const bpmMax = bpm(filters.bpmMax);
  if (bpmMin !== undefined && bpmMax !== undefined && bpmMin > bpmMax) throw new Error('Minimum BPM must be lower than maximum BPM.');
  return {
    ...(searchGenres.includes(filters.genre || '') ? { genre: filters.genre } : {}),
    ...(searchMoods.includes(filters.mood || '') ? { mood: filters.mood } : {}),
    ...(searchKeys.includes(filters.musicalKey || '') ? { musicalKey: filters.musicalKey } : {}),
    ...(bpmMin !== undefined ? { bpmMin } : {}),
    ...(bpmMax !== undefined ? { bpmMax } : {}),
    ...(filters.downloadableOnly ? { downloadableOnly: true } : {}),
  };
}

export function searchFilterParams(filters: AdvancedSearchFilters = {}) {
  const normalized = normalizeSearchFilters(filters);
  return {
    genre: normalized.genre,
    mood: normalized.mood,
    key: normalized.musicalKey,
    bpm_min: normalized.bpmMin,
    bpm_max: normalized.bpmMax,
    only_downloadable: normalized.downloadableOnly ? true : undefined,
  };
}

export function hasSearchFilters(filters: AdvancedSearchFilters = {}) {
  return Object.keys(normalizeSearchFilters(filters)).length > 0;
}
