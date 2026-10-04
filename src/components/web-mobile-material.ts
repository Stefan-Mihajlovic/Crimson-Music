/** Shared browser material for the dock, navigation, and moving player surface. */
export function webMobileMaterial(isDark: boolean, performanceMode: boolean, solidColor: string) {
  const blur = performanceMode ? undefined : 'blur(12px) saturate(1.3)';
  return {
    backgroundColor: performanceMode ? solidColor : isDark ? 'rgba(31,26,40,.72)' : 'rgba(250,246,255,.80)',
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
  };
}
