import type { CrimsonSong } from '@/types/music';

export type LocalAudioFile = {
  id: string;
  uri: string;
  filename: string;
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  size?: number;
  modifiedAt?: number;
  kind: 'import' | 'device';
};
export const LOCAL_MUSIC_ID = 'local-music';
export const isLocalTrackId = (id: string) => id.startsWith('local:');
export const isAudioFilename = (name: string) => /\.(mp3|mp2|m4a|m4b|m4r|aac|wav|wave|flac|ogg|oga|opus|aif|aiff|aifc|alac|wma|amr|mka|au|snd)$/i.test(name);

export function localAudioSong(file: LocalAudioFile): CrimsonSong {
  const image = file.artwork || '';
  return {
    id: `local:${file.id}`, source: 'local', local: { kind: file.kind, filename: file.filename, size: file.size },
    title: file.title?.trim() || file.filename.replace(/\.[^.]+$/, ''),
    creator: file.artist?.trim() || 'Unknown artist', artistId: '', artistHandle: '',
    image, imageSmall: image, artwork: { small: image, medium: image, large: image, mirrors: [] },
    url: file.uri, color: '#234D5A', categories: 'Local Music', genre: '', mood: '', tags: [],
    duration: Number.isFinite(file.duration) ? Math.max(0, file.duration!) : 0,
    description: file.album || '', permalink: '', releaseDate: file.modifiedAt && Number.isFinite(file.modifiedAt) ? new Date(file.modifiedAt).toISOString() : '',
    playCount: 0, favoriteCount: 0, streamable: true, downloadable: false,
  };
}

/** A successful device scan replaces stale device entries, while keeping imported copies. */
export function mergeLocalMusic(current: CrimsonSong[], incoming: CrimsonSong[], replaceDevice = false) {
  return [...new Map([
    ...current.filter((song) => song.source === 'local' && (!replaceDevice || song.local?.kind !== 'device')),
    ...incoming.filter((song) => song.source === 'local'),
  ].map((song) => [song.id, song])).values()].sort((a, b) => a.title.localeCompare(b.title));
}
