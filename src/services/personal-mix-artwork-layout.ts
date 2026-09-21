import type { PersonalMixId } from '@/services/personal-mixes';

export type MixArtworkShape = { path: string; x: number; y: number; width: number; height: number };
export const mixArtworkStyles: Record<PersonalMixId, { background: string; shadow: string; accent: string; title: string[]; shapes: MixArtworkShape[] }> = {
  daily: { background: '#AF5C55', shadow: '#5B293E', accent: '#F6C1A7', title: ['Daily', 'Mix'], shapes: [{ path: 'M286 105a98 98 0 1 1-196 0a98 98 0 1 1 196 0', x: 90, y: 7, width: 196, height: 196 }] },
  weekly: { background: '#7866A5', shadow: '#3E2D60', accent: '#CFBDEC', title: ['Weekly', 'Mix'], shapes: [{ path: 'M94 22C122 12 151 28 159 55L195 170C203 197 188 225 160 233C132 241 104 226 96 199L60 66C52 40 67 31 94 22Z', x: 58, y: 14, width: 140, height: 225 }, { path: 'M222 69C249 76 265 104 257 131L240 185C232 212 205 226 178 218C151 210 137 183 145 156L161 103C169 76 195 61 222 69Z', x: 141, y: 65, width: 120, height: 158 }] },
  monthly: { background: '#4E8E83', shadow: '#23534F', accent: '#AFE0C5', title: ['Monthly', 'Mix'], shapes: [{ path: 'M81 213V111a98 98 0 0 1 196 0v102Z', x: 81, y: 13, width: 196, height: 200 }] },
  'release-radar': { background: '#AE8745', shadow: '#665027', accent: '#F1D39C', title: ['Release', 'Radar'], shapes: [{ path: 'M175 45C211 0 270 29 250 80C306 98 293 164 239 170C237 227 169 238 150 185C100 207 62 151 103 113C61 75 120 11 158 54Z', x: 81, y: 17, width: 212, height: 207 }] },
  rediscover: { background: '#8B5D80', shadow: '#512E52', accent: '#E7BEDC', title: ['Rediscover'], shapes: [{ path: 'M133 16C212 -8 293 36 271 91C255 131 204 113 188 146C165 196 198 221 144 225C70 231 49 160 67 112C86 62 71 35 133 16Z', x: 60, y: 7, width: 221, height: 222 }] },
  'hidden-gems': { background: '#537A9C', shadow: '#293F68', accent: '#BEDBEA', title: ['Hidden', 'Gems'], shapes: [{ path: 'M177 14C234 9 285 56 281 111C277 155 232 194 184 210C134 227 77 204 63 164C43 111 110 21 177 14Z', x: 58, y: 12, width: 225, height: 206 }] },
};

