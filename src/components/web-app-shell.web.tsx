import { Image } from 'expo-image';
import { type Href, usePathname, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PropsWithChildren } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolView, type SymbolViewProps } from '@/components/app-symbol';
import ArtworkImage from '@/components/artwork-image';
import MainHeaderActions from '@/components/main-header-actions';
import PerformanceTabs from '@/components/performance-tabs';
import PlaylistCover from '@/components/playlist-cover';
import { profileImageSource } from '@/components/profile-images';
import WebPlayerBar from '@/components/web-player-bar';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { createDetailRoutes, releaseWebNavigationFocus, type AppRouteGroup } from '@/services/action-sheet';
import { buildLibraryCollection, filterLibraryCollection, type LibraryCollectionItem } from '@/services/library-collection';
import { loadLibraryFeed, readLocalListeningEvents, readOfflineData, type LibraryFeed } from '@/services/music';
import { getSearchQuery, requestSearchQuery, subscribeToLibraryRefresh, subscribeToSearchFocus, subscribeToSearchQuery } from '@/services/navigation-events';
import { webShellStyles } from '@/styles/web-shell';

const tabs: { group: AppRouteGroup; label: string; icon: SymbolViewProps['name']; href: Href }[] = [
  { group: '(home)', label: 'Home', icon: 'house.fill', href: '/(app)/(home)' },
  { group: '(search)', label: 'Search', icon: 'magnifyingglass', href: '/(app)/(search)/search' },
  { group: '(library)', label: 'Library', icon: 'folder', href: '/(app)/(library)/library' },
];
const libraryRoutes = createDetailRoutes('(library)');
const favoritesArtwork = require('@/assets/images/onboarding/favorites.webp');
const brandArtwork = require('@/assets/images/icon.png');
const emptyItems: LibraryCollectionItem[] = [{ key: 'favorites', kind: 'favorites' }];
type RouteState = { index?: number; routes: readonly { name: string; state?: RouteState }[] };
function selectedAppGroup(state?: RouteState): string | undefined {
  if (!state) return undefined;
  const route = state?.routes[state.index ?? 0];
  if (route && ['(home)', '(search)', '(library)', '(account)'].includes(route.name)) return route.name;
  return selectedAppGroup(route?.state) || selectedAppGroup(state?.routes.find((item) => item.name === '(app)')?.state);
}

export default function WebAppShell({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { colors, isDark, performanceMode, reduceMotion } = useAppSettings();
  const { currentSong } = usePlayer();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigate = (href: Href) => { releaseWebNavigationFocus(); router.navigate(href); };
  const pathname = usePathname();
  const segments = useSegments();
  const rootState = useRootNavigationState();
  const desktop = width >= 960;
  const modalRoute = pathname === '/action-sheet' || pathname === '/player-details';
  const [lastPage, setLastPage] = useState(pathname);
  if (!modalRoute && lastPage !== pathname) setLastPage(pathname);
  const baseRoute = rootState?.routes.slice(0, (rootState.index ?? 0) + 1).findLast((route) => !['action-sheet', 'player-details'].includes(route.name));
  const fullPlayer = pathname === '/player' || (desktop && pathname === '/player-details') || (modalRoute && (baseRoute?.name === 'player' || lastPage === '/player'));
  const activeGroup = segments.find((value) => ['(home)', '(search)', '(library)', '(account)'].includes(value));
  const selectedGroup = activeGroup || selectedAppGroup(rootState) || '(home)';
  const showShell = Boolean(user) && !['/welcome', '/sign-in', '/register', '/reset-password', '/onboarding', '/oauth/callback'].includes(pathname);
  const [query, setQuery] = useState(getSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabBottom = Math.max(12, insets.bottom);
  const theme = {
    '--crimson-bg': colors.background,
    '--crimson-panel': colors.elevated,
    '--crimson-surface': colors.surface,
    '--crimson-text': colors.text,
    '--crimson-muted': colors.secondaryText,
    '--crimson-border': colors.border,
    '--crimson-accent': colors.accent,
    '--crimson-active': colors.accentSoft,
    '--crimson-hover': isDark ? 'rgba(255,255,255,.06)' : 'rgba(20,12,30,.055)',
    colorScheme: isDark ? 'dark' : 'light',
  } as CSSProperties;

  useEffect(() => {
    if (!showShell || !desktop) return;
    return subscribeToSearchQuery(setQuery);
  }, [desktop, showShell]);

  useEffect(() => {
    if (!showShell || !desktop) return;
    return subscribeToSearchFocus(() => inputRef.current?.focus());
  }, [desktop, showShell]);

  useEffect(() => {
    if (!showShell || !desktop) return;
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [desktop, showShell]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    requestSearchQuery(query.trim());
    if (pathname !== '/search') navigate('/(app)/(search)/search');
    inputRef.current?.focus();
  };
  return (
    <>
      <style>{webShellStyles}</style>
      {showShell ? (
        <div className={`crimson-shell ${desktop ? 'is-desktop' : 'is-mobile'} ${fullPlayer ? 'is-player' : ''} ${currentSong && !fullPlayer ? 'has-player' : ''} ${performanceMode || reduceMotion ? 'reduce-motion' : ''}`} style={theme}>
          {desktop && (
            <aside className="crimson-sidebar" aria-label="Main navigation and library">
              <button className="crimson-brand" onClick={() => navigate('/(app)/(home)')} aria-label="Crimson Music Home">
                <Image source={brandArtwork} style={{ width: 34, height: 34, borderRadius: 10 }} />
                <span>Crimson<span className="crimson-brand-light"> Music</span></span>
              </button>
              <nav className="crimson-primary-nav" aria-label="Main navigation">
                {tabs.map((tab) => (
                  <button key={tab.group} className={`crimson-nav-item ${selectedGroup === tab.group ? 'is-active' : ''}`} aria-current={selectedGroup === tab.group ? 'page' : undefined} onClick={() => navigate(tab.href)}>
                    <SymbolView name={tab.icon} size={21} tintColor={selectedGroup === tab.group ? colors.accent : colors.secondaryText} />
                    {tab.label}
                  </button>
                ))}
              </nav>
              <SidebarLibrary key={user!.uid} uid={user!.uid} />
              <button className={`crimson-account ${selectedGroup === '(account)' ? 'is-active' : ''}`} onClick={() => navigate('/(app)/(account)/account')} aria-label="Open account">
                <Image source={profileImageSource(user!.ProfilePhoto || '1')} style={{ width: 34, height: 34, borderRadius: 17 }} />
                <span><strong>{user!.DisplayName || user!.Username || 'Your account'}</strong><small>Account & settings</small></span>
                <SymbolView name="chevron.right" size={15} tintColor={colors.secondaryText} />
              </button>
            </aside>
          )}
          <div className="crimson-workspace">
            {desktop && (
              <header className="crimson-toolbar">
                <div className="crimson-history-buttons">
                  <button className="crimson-icon-button" aria-label="Go back" disabled={!router.canGoBack()} onClick={() => { releaseWebNavigationFocus(); router.back(); }}><SymbolView name="chevron.left" size={19} tintColor={colors.text} /></button>
                  <button className="crimson-icon-button" aria-label="Go forward" onClick={() => { releaseWebNavigationFocus(); window.history.forward(); }}><SymbolView name="chevron.right" size={19} tintColor={colors.text} /></button>
                </div>
                <form className="crimson-global-search" role="search" onSubmit={submitSearch}
                  onClick={(event) => { if (!(event.target instanceof Element) || !event.target.closest('button')) inputRef.current?.focus(); }}>
                  <SymbolView name="magnifyingglass" size={21} tintColor={colors.secondaryText} />
                  <input ref={inputRef} aria-label="Search music" placeholder="Search songs, artists, playlists" value={query} onChange={(event) => requestSearchQuery(event.target.value)} />
                  {query ? <button type="button" aria-label="Clear search" onClick={() => { requestSearchQuery(''); inputRef.current?.focus(); }}><SymbolView name="xmark" size={16} tintColor={colors.secondaryText} /></button> : <kbd>⌘ K</kbd>}
                </form>
                <div className="crimson-toolbar-actions">
                <MainHeaderActions placement="toolbar" />
                <button className="crimson-icon-button crimson-toolbar-account" aria-label="Open account settings" onClick={() => navigate('/(app)/(account)/account')}>
                  <Image source={profileImageSource(user!.ProfilePhoto || '1')} style={{ width: 32, height: 32, borderRadius: 16 }} />
                </button>
                </div>
              </header>
            )}
            <main id="crimson-main-content" className="crimson-main-content">{children}</main>
          </div>
          {!desktop && !fullPlayer && <PerformanceTabs bottom={tabBottom} />}
          <WebPlayerBar desktopLeft={280} mobileBottom={tabBottom + 68} hidden={fullPlayer} />
        </div>
      ) : children}
    </>
  );
}

function SidebarLibrary({ uid }: { uid: string }) {
  const { colors } = useAppSettings();
  const router = useRouter();
  const navigate = (href: Href) => { releaseWebNavigationFocus(); router.navigate(href); };
  const [items, setItems] = useState<LibraryCollectionItem[]>(emptyItems);
  const [filter, setFilter] = useState<'all' | 'playlists' | 'artists'>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const revision = useRef(0);
  const reload = useCallback(() => {
    const request = ++revision.current;
    return Promise.all([readOfflineData<LibraryFeed>(`library:${uid}`), readLocalListeningEvents(uid)]).then(async ([cached, events]) => {
      if (request !== revision.current) return;
      setFailed(false);
      if (cached) setItems(buildLibraryCollection(cached, events));
      const feed = await loadLibraryFeed(uid);
      if (request === revision.current) setItems(buildLibraryCollection(feed, events));
    }).catch(() => {
      if (request === revision.current) setFailed(true);
    });
  }, [uid]);
  useEffect(() => {
    void reload();
    const unsubscribe = subscribeToLibraryRefresh(() => void reload());
    return () => { revision.current += 1; unsubscribe(); };
  }, [reload]);
  const visibleItems = useMemo(() => filterLibraryCollection(items, query, { filter }), [filter, items, query]);
  return (
    <section className="crimson-library-panel" aria-label="Your library">
      <div className="crimson-library-heading"><span>Your library</span><div>
        <button className="crimson-small-button" aria-label="Search your library" title="Search your library" onClick={() => setSearching((value) => !value)}><SymbolView name="magnifyingglass" size={17} tintColor={colors.secondaryText} /></button>
        <button className="crimson-small-button" aria-label="Create playlist" title="Create playlist" onClick={() => navigate('/(app)/(library)/create-playlist')}><SymbolView name="plus" size={20} tintColor={colors.secondaryText} /></button>
      </div></div>
      <div className="crimson-library-filters" aria-label="Library filters">
        {(['all', 'playlists', 'artists'] as const).map((item) => <button key={item} aria-pressed={filter === item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item === 'playlists' ? 'Playlists' : 'Artists'}</button>)}
      </div>
      {searching && <input className="crimson-library-search" autoFocus aria-label="Find in your library" placeholder="Find in your library" value={query} onChange={(event) => setQuery(event.target.value)} />}
      <div className="crimson-library-items">
        {visibleItems.map((item) => {
          const title = item.kind === 'favorites' ? 'Favorites' : item.kind === 'artist' ? item.artist.name : item.playlist.title;
          const subtitle = item.kind === 'favorites' ? 'Your favorite songs' : item.kind === 'artist' ? 'Artist' : item.owned ? 'Your playlist' : 'Playlist';
          const href = item.kind === 'favorites' ? libraryRoutes.favoritesHref() : item.kind === 'artist' ? libraryRoutes.artistHref(item.artist.id) : libraryRoutes.playlistHref(item.playlist.id, item.owned, item.playlist.source, item.playlist.title);
          return <button key={item.key} className="crimson-library-item" onClick={() => navigate(href)} aria-label={`Open ${title}`}>
            {item.kind === 'playlist' ? <PlaylistCover playlist={item.playlist} borderRadius={7} showPlayingIndicator={false} style={{ width: 43, height: 43, flexShrink: 0 }} /> : <ArtworkImage source={item.kind === 'favorites' ? favoritesArtwork : { uri: item.artist.imageSmall || item.artist.image }} artwork={item.kind === 'artist' ? item.artist.artwork : undefined} style={{ width: 43, height: 43, borderRadius: item.kind === 'artist' ? 22 : 7 }} />}
            <span><strong>{title}</strong><small>{subtitle}</small></span>
          </button>;
        })}
        {!visibleItems.length && <p className="crimson-library-empty">No matches in your library.</p>}
        {failed && <button className="crimson-library-retry" onClick={() => void reload()}>Couldn’t refresh library · Retry</button>}
      </div>
    </section>
  );
}
