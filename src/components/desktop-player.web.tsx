import { setDesktopPlayerPresented } from '@/services/desktop-player-presentation';
import ArtworkImage from '@/components/artwork-image';
import { useIsFocused, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { SymbolView } from '@/components/app-symbol';
import PlayerArtworkBackground from '@/components/player-artwork-background';
import DesktopPlayerPanel from '@/components/desktop-player-panel';
import type { PlayerDetailsTab } from '@/components/player-details-tabs.types';
import { formatPlayerTime, PlayerIconButton, PlayerRange, WebTransport, WebVolume } from '@/components/web-player-controls';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';

const DesktopArtworkBackground = memo(PlayerArtworkBackground);

export default function DesktopPlayer({ initialTab = 'queue' }: { initialTab?: PlayerDetailsTab }) {
  const router = useRouter();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const player = usePlayer();
  const status = usePlayerStatus();
  const { colors, isDark, reduceMotion } = useAppSettings();
  const { artistHref } = useDetailRoutes();
  const { width, height } = useWindowDimensions();
  const surface = useRef<HTMLElement>(null);
  const motion = useRef<Animation | null>(null);
  const closing = useRef(false);
  const alive = useRef(true);
  const artworkColumn = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const [artworkLoaded, setArtworkLoaded] = useState(0);
  const [availableArtwork, setAvailableArtwork] = useState<number | null>(null);
  const song = player.currentSong;
  const hasSong = Boolean(song);
  useLayoutEffect(() => {
    alive.current = true;
    if (hasSong && !reduceMotion && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      motion.current = surface.current?.animate?.([
        { transform: 'translateY(24px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' }) ?? null;
    }
    setDesktopPlayerPresented(hasSong);
    return () => { alive.current = false; motion.current?.cancel(); setDesktopPlayerPresented(false); };
  }, [hasSong, reduceMotion]);
  usePreventRemove(hasSong, ({ data }) => {
    if (closing.current) return;
    if (reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !surface.current?.animate) {
      navigation.dispatch(data.action);
      return;
    }
    closing.current = true;
    setDesktopPlayerPresented(false);
    // Start from the currently displayed position if the user closes mid-entry.
    const currentStyle = getComputedStyle(surface.current);
    const from = currentStyle.transform;
    const fromOpacity = currentStyle.opacity || 1;
    motion.current?.cancel();
    const animation = surface.current.animate([
      { transform: from === 'none' ? 'translateY(0)' : from, opacity: fromOpacity },
      { transform: 'translateY(24px)', opacity: 0 },
    ], { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    motion.current = animation;
    void animation.finished.then(() => {
      if (alive.current) navigation.dispatch(data.action);
    }).catch(() => { /* Unmounted or superseded animation. */ }).finally(() => { closing.current = false; });
  });
  useLayoutEffect(() => {
    if (!artworkColumn.current || !controls.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!artworkColumn.current || !controls.current) return;
      setAvailableArtwork(Math.max(140, artworkColumn.current.clientHeight - controls.current.offsetHeight - 50));
    });
    observer.observe(artworkColumn.current);
    observer.observe(controls.current);
    return () => observer.disconnect();
  }, [song?.id]);
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        if (router.canGoBack()) router.back(); else router.replace('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
  const artworkSize = Math.max(140, Math.min(460, (width - 340) * 0.48, availableArtwork ?? height - 425));
  if (!song) return <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 18, color: colors.text }}>
    <SymbolView name="music.note" size={48} tintColor={colors.accent} />
    <h1 style={{ margin: 0, fontSize: 25 }}>Nothing is playing</h1>
    <p style={{ color: colors.secondaryText, margin: 0 }}>Find a song and make yourself at home.</p>
    <button type="button" onClick={close} style={{ border: 0, background: colors.accent, color: '#FFFFFF', padding: '12px 24px', borderRadius: 22, cursor: 'pointer' }}>Browse music</button>
  </div>;
  const openActions = () => router.push(actionSheetHref({
    type: 'song', id: song.id, title: song.title, subtitle: song.creator,
    image: song.imageSmall || song.image, artistId: song.artistId, playerPresentation: 'modal',
  }));
  return <section ref={surface} aria-label="Now playing" style={{
    display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, overflow: 'hidden', color: colors.text,
    position: 'relative', isolation: 'isolate', background: colors.background,
  }}>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: -1 }}>
      <DesktopArtworkBackground active={focused} song={song} artworkLoaded={artworkLoaded} />
      {!isDark && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.82)' }} />}
    </div>
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, padding: '8px 28px', gap: 18, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <PlayerIconButton label="Minimize player" icon="chevron.down" onPress={close} size={20} />
        <div><div style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>Now playing</div>
          <div style={{ marginTop: 5, fontSize: 12, fontWeight: 600 }}>{player.source || 'Your music'}</div></div>
      </div>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 0.92fr)', gap: width >= 1280 ? 48 : 24,
      width: '100%', maxWidth: 1380, margin: '0 auto', padding: '0 32px 26px', boxSizing: 'border-box', minHeight: 0, flex: 1 }}>
      <div ref={artworkColumn} style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', padding: '12px 4px 8px', scrollbarWidth: 'thin' }}>
        <div style={{ width: artworkSize, maxWidth: '100%', margin: '0 auto' }}>
          <div style={{ width: '100%', aspectRatio: '1', marginBottom: 24, borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 48px rgba(0,0,0,.28)' }}>
            <ArtworkImage artwork={song.artwork} source={song.image || song.imageSmall || require('@/assets/images/home/default-song.webp')} contentFit="cover" onLoad={() => setArtworkLoaded((value) => value + 1)} transition={180} style={{ width: '100%', height: '100%' }} />
          </div>
          <div ref={controls}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 17 }}>
            <div style={{ flex: 1, minWidth: 0 }}><h1 style={{ margin: '0 0 7px', fontSize: width >= 1280 ? 25 : 21, lineHeight: 1.2, fontWeight: 780, letterSpacing: '-0.7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={song.title}>{song.title}</h1>
              <button type="button" disabled={!song.artistId} onClick={() => router.replace(artistHref(song.artistId))}
                style={{ maxWidth: '100%', padding: 0, border: 0, background: 'transparent', color: colors.secondaryText, fontSize: 14, cursor: song.artistId ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.creator}</button></div>
            <PlayerIconButton label={`More options for ${song.title}`} icon="ellipsis" onPress={openActions} />
            <PlayerIconButton label={player.isLiked ? 'Remove from favorites' : 'Add to favorites'} icon={player.isLiked ? 'heart.fill' : 'heart'} active={player.isLiked} onPress={() => void player.toggleLike()} size={23} />
          </div>
          <PlayerRange label="Playback position" value={status.currentTime} max={status.duration} onChange={player.seekTo} />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.secondaryText, fontSize: 11, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}><span>{formatPlayerTime(status.currentTime)}</span><span>{formatPlayerTime(status.duration)}</span></div>
          <div style={{ marginTop: 16 }}><WebTransport large /></div>
          <div style={{ marginTop: 17 }}><WebVolume fill /></div>
          {player.playbackError ? <div role="status" style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, marginTop: 14, fontSize: 12, color: colors.secondaryText, lineHeight: 1.6 }}>
            {player.playbackError}<div style={{ display: 'flex', gap: 14 }}>
              <button type="button" onClick={player.retryPlayback} style={{ border: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', padding: '10px 0' }}>Retry</button>
              <button type="button" onClick={player.playNext} style={{ border: 0, background: 'transparent', color: colors.accent, cursor: 'pointer', padding: '10px 0' }}>Skip song</button>
            </div>
          </div> : null}
          </div>
        </div>
      </div>
      <DesktopPlayerPanel key={initialTab} initialTab={initialTab} />
    </div>
  </section>;
}
