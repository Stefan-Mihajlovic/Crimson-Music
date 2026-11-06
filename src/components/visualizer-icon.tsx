import { memo } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { VisualizerStyle } from '@/services/player-visualizer';

/** Small silhouettes of the effects, drawn in the same 32-point coordinate space. */
export default memo(function VisualizerIcon({ style, color, size = 34 }: {
  style: VisualizerStyle; color: string; size?: number;
}) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>
    <G fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {style === 'aurora' ? <>
        <Path d="M4 24C6 13 13 27 17 12S24 3 28 7" strokeWidth={6} opacity={0.15} />
        <Path d="M4 22C7 8 12 26 17 11S24 4 28 6" strokeWidth={3} opacity={0.45} />
        <Path d="M4 18C9 5 12 24 17 9S24 6 28 4" />
        <Path d="M4 27C8 15 14 30 19 16S25 12 28 10" opacity={0.5} />
      </> : null}
      {style === 'spectrum' ? [9, 17, 25, 14, 20, 7].map((height, index) =>
        <Rect key={index} x={3 + index * 4.6} y={28 - height} width={2.4} height={height} rx={1.2} fill={color} stroke="none" opacity={0.5 + height / 50} />) : null}
      {style === 'orbit' ? <>
        <Circle cx={16} cy={16} r={13} opacity={0.4} />
        <Circle cx={16} cy={16} r={9} opacity={0.75} />
        <Circle cx={16} cy={16} r={5} />
        <Circle cx={25} cy={16} r={2} fill={color} stroke="none" />
      </> : null}
      {style === 'tides' ? <>
        <Path d="M3 11C7 3 12 3 16 11S25 19 29 11" />
        <Path d="M3 18C7 10 12 10 16 18S25 26 29 18" opacity={0.7} />
        <Path d="M3 25C7 17 12 17 16 25S25 33 29 25" opacity={0.35} />
      </> : null}
      {style === 'prism' ? <>
        <Path d="M16 27L3 8L9 4Z" fill={color} opacity={0.25} stroke="none" />
        <Path d="M16 27L13 2H19Z" fill={color} opacity={0.55} stroke="none" />
        <Path d="M16 27L23 4L29 8Z" fill={color} opacity={0.25} stroke="none" />
        <Path d="M4 5L16 27L28 5M16 27V3" />
      </> : null}
    </G>
  </Svg>;
});
