export type ArtworkSet = {
  small: string;
  medium: string;
  large: string;
  mirrors: string[];
};

export type CrimsonSong = {
  id: string;
  source: 'audius';
  title: string;
  creator: string;
  artistId: string;
  artistHandle: string;
  image: string;
  imageSmall: string;
  artwork: ArtworkSet;
  url: string;
  color: string;
  categories: string;
  genre: string;
  mood: string;
  tags: string[];
  duration: number;
  description: string;
  permalink: string;
  releaseDate: string;
  playCount: number;
  favoriteCount: number;
  streamable: boolean;
  downloadable: boolean;
};

export type CrimsonPlaylist = {
  id: string;
  source: 'audius' | 'crimson';
  title: string;
  description?: string;
  artists: string;
  ownerId?: string;
  ownerName?: string;
  image: string;
  imageSmall: string;
  coverImages?: string[];
  coverImagesSmall?: string[];
  artwork?: ArtworkSet;
  likes: string;
  songs: string[];
  category: string;
  visibility?: 'public' | 'private';
  owned?: boolean;
};

export type CrimsonCategory = {
  id: string;
  name: string;
  color: string;
  image: string;
  imageSmall: string;
  localImage?: number;
};

export type CrimsonEvent = {
  id: string;
  type: 'remix_contest' | 'live_event' | 'new_release';
  title: string;
  description: string;
  prizeInfo: string;
  endDate: string;
  createdAt: string;
  hostId: string;
  hostName: string;
  hostImage: string;
  entityId: string;
  image: string;
  permalink: string;
  entryCount: number;
  track?: CrimsonSong;
};

export type CrimsonProfile = {
  id: string;
  username: string;
  image: string;
};

export type CrimsonArtist = {
  id: string;
  source: 'audius';
  handle: string;
  name: string;
  image: string;
  imageSmall: string;
  artwork: ArtworkSet;
  aboutImage: string;
  followers: string;
  trackCount: number;
  description: string;
  twitterHandle: string;
  instagramHandle: string;
  tiktokHandle: string;
  website: string;
};

export type MusicCatalog = {
  songs: CrimsonSong[];
  artists: CrimsonArtist[];
};

export type DiscoveryCatalog = MusicCatalog & {
  playlists: CrimsonPlaylist[];
  categories: CrimsonCategory[];
  profiles: CrimsonProfile[];
  events: CrimsonEvent[];
};

export type LibraryFeed = {
  playlists: CrimsonPlaylist[];
  likedPlaylists: CrimsonPlaylist[];
  followedArtists: CrimsonArtist[];
};

export type ArtistDetail = {
  artist: CrimsonArtist;
  songs: CrimsonSong[];
  relatedArtists: CrimsonArtist[];
  appearsOn: CrimsonPlaylist[];
  hasMoreTracks: boolean;
};

export type PlaylistDetail = {
  playlist: CrimsonPlaylist;
  songs: CrimsonSong[];
};

export type CategoryDetail = {
  category: CrimsonCategory;
  songs: CrimsonSong[];
  playlists: CrimsonPlaylist[];
  events: CrimsonEvent[];
};

export type RelatedSong = CrimsonSong & {
  reason: 'Artist' | 'Similar vibe' | 'For you';
};
