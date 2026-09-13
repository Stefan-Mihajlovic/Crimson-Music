/** Shared violet accents, matched to the graded Vault animation. */
export const BrandAccent = {
  light: '#6D28D9',
  dark: '#965CFF',
  glow: '#7C3AED',
  highlight: '#B18AFF',
} as const;

export function brandAccentTint(opacity: number, theme: 'light' | 'dark' = 'dark') {
  const color = BrandAccent[theme];
  const rgb = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16)).join(',');
  return `rgba(${rgb},${opacity})`;
}
