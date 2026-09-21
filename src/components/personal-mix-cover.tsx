import { useEffect, useId, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useAppSettings } from '@/providers/settings-provider';
import { resolvePersonalMixArtwork } from '@/services/personal-mix-artwork';
import { mixArtworkStyles } from '@/services/personal-mix-artwork-layout';
import type { PersonalMix, PersonalMixId } from '@/services/personal-mixes';
import type { CrimsonSong } from '@/types/music';

/** Shared curved artwork for Home, Library, and title-free detail heroes. */
export function PersonalMixArtwork({ id, images, showTitle = true }: {
  id: PersonalMixId; images: string[]; showTitle?: boolean;
}) {
  const identifier = useId().replace(/[^a-zA-Z0-9]/g, '');
  const theme = mixArtworkStyles[id];
  return <Svg width="100%" height="100%" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice">
    <Defs>
      <LinearGradient id={`${identifier}background`} x1="0" y1="0" x2="0.9" y2="1"><Stop offset="0" stopColor={theme.background} /><Stop offset="1" stopColor={theme.shadow} /></LinearGradient>
      <LinearGradient id={`${identifier}shade`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0.58" stopColor={theme.shadow} stopOpacity="0" /><Stop offset="1" stopColor={theme.shadow} stopOpacity="0.8" /></LinearGradient>
      {theme.shapes.map((shape, index) => <ClipPath key={index} id={`${identifier}photo${index}`}><Path d={shape.path} /></ClipPath>)}
    </Defs>
    <Rect width="300" height="300" fill={`url(#${identifier}background)`} />
    {theme.shapes.map((shape, index) => <G key={index}>
      <Path d={shape.path} fill={theme.accent} transform="translate(-10 7)" />
      <Path d={shape.path} fill={theme.shadow} />
      {images.length ? <SvgImage href={{ uri: images[index % images.length] }} x={shape.x} y={shape.y} width={shape.width} height={shape.height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${identifier}photo${index})`} /> : null}
    </G>)}
    <Rect width="300" height="300" fill={`url(#${identifier}shade)`} />
    {showTitle ? theme.title.map((line, index) => <SvgText key={line} x="24" y={270 - (theme.title.length - index - 1) * 42} fontSize="38" fontWeight="700" letterSpacing="-1" fill="#FFF9FC">{line}</SvgText>) : null}
  </Svg>;
}

export default function PersonalMixCover({ id, mix, songs = mix?.songs || [], size = 142, style, borderRadius = 17, showTitle = true }: {
  id: PersonalMixId; mix?: PersonalMix; songs?: CrimsonSong[]; size?: number; style?: StyleProp<ViewStyle>; borderRadius?: number; showTitle?: boolean;
}) {
  const { dataSaver } = useAppSettings();
  const small = dataSaver || size <= 200;
  const photoCount = mixArtworkStyles[id].shapes.length;
  const sourceKey = `${id}:${small}:${songs.slice(0, 2).map((song) => `${song.image}|${song.imageSmall}`).join(',')}`;
  const [displayArtwork, setDisplayArtwork] = useState<{ key: string; images: string[] } | null>(null);
  useEffect(() => {
    let current = true;
    if (songs.length) void resolvePersonalMixArtwork(songs, photoCount, small).then((images) => {
      if (current) setDisplayArtwork({ key: sourceKey, images });
    }).catch(() => { /* Keep the designed empty mask when every source is unavailable. */ });
    return () => { current = false; };
  }, [songs, photoCount, small, sourceKey]);
  return <View accessibilityLabel={`${mixArtworkStyles[id].title.join(' ')} cover`} style={[styles.cover, { width: size, height: size, borderRadius }, style]}>
      <PersonalMixArtwork id={id} images={displayArtwork?.key === sourceKey ? displayArtwork.images : []} showTitle={showTitle} />
    </View>;
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', backgroundColor: '#24143B' },
});
