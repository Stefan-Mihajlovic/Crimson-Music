import MusicListState from '@/components/music-list-state';
import QueueTools, { QueueUndo } from '@/components/queue-tools';
import { queueOriginLabel } from '@/services/queue-entries';
import { useRecommendationFeedback } from '@/hooks/use-recommendation-feedback';
import { allowsRecommendation } from '@/services/recommendation-feedback-model';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import ArtworkImage from '@/components/artwork-image';

import { SymbolView } from '@/components/app-symbol';
import { formatPlayerTime, PlayerIconButton } from '@/components/web-player-controls';
import type { PlayerDetailsTab } from '@/components/player-details-tabs.types';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import { loadRelatedSongs, type CrimsonSong, type RelatedSong } from '@/services/music';

export default function DesktopPlayerPanel({ initialTab = 'queue' }: { initialTab?: PlayerDetailsTab }) {
  const router = useRouter();
  const feedback = useRecommendationFeedback();
  const player = usePlayer();
  const { colors } = useAppSettings();
  const [tab, setTab] = useState<PlayerDetailsTab>(initialTab === 'lyrics' ? 'queue' : initialTab);
  const [related, setRelated] = useState<RelatedSong[]>([]);
  const [loadedRequest, setLoadedRequest] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const currentRow = useRef<HTMLDivElement>(null);
  const songId = player.currentSong?.id;
  const requestKey = `${songId || ''}:${revision}:${feedback.updatedAt}`;
  const loading = tab === 'related' && loadedRequest !== requestKey;
  const upcoming = useMemo(() => player.queue.map((song, index) => ({ song, index })).slice(player.queueIndex + 1), [player.queue, player.queueIndex]);

  useEffect(() => {
    if (!songId || tab !== 'related') return;
    let active = true;
    void loadRelatedSongs(songId).then((songs) => {
      if (active) { setRelated(songs); setError(''); }
    }).catch(() => {
      if (active) setError('Related music could not be loaded.');
    }).finally(() => { if (active) setLoadedRequest(requestKey); });
    return () => { active = false; };
  }, [songId, tab, requestKey]);

  useEffect(() => { if (tab === 'queue') currentRow.current?.scrollIntoView?.({ block: 'nearest' }); }, [tab, player.queueIndex]);

  const openActions = (song: CrimsonSong) => router.push(actionSheetHref({
    type: 'song', id: song.id, title: song.title, subtitle: song.creator,
    image: song.imageSmall || song.image, artistId: song.artistId, source: song.source, playerPresentation: 'modal', reason: 'reason' in song ? String(song.reason) : undefined,
  }));
  const textButton: CSSProperties = { background: 'transparent', border: 0, color: colors.accent, cursor: 'pointer', fontSize: 12, fontWeight: 650, padding: '10px 4px' };

  return <section aria-label="Listening queue and related music" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}>
    <div role="tablist" aria-label="Player details" style={{ display: 'flex', gap: 28, borderBottom: `1px solid ${colors.border}`, padding: '0 12px', flexShrink: 0 }}>
      {([{ value: 'queue', label: 'Up Next', icon: 'music.note.list' }, { value: 'related', label: 'Related', icon: 'sparkles' }] as const).map((item) => <button
        key={item.value} type="button" role="tab" id={`player-tab-${item.value}`} aria-controls="player-detail-panel" aria-selected={tab === item.value} tabIndex={tab === item.value ? 0 : -1}
        onClick={() => setTab(item.value)} onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            const next = tab === 'queue' ? 'related' : 'queue';
            setTab(next);
            document.getElementById(`player-tab-${next}`)?.focus();
          }
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '18px 0 15px', border: 0, borderBottom: `2px solid ${tab === item.value ? colors.accent : 'transparent'}`, background: 'transparent', cursor: 'pointer', color: tab === item.value ? colors.text : colors.secondaryText, fontSize: 14, fontWeight: 700 }}>
        <SymbolView name={item.icon} size={17} tintColor={tab === item.value ? colors.text : colors.secondaryText} />
        {item.label}{item.value === 'queue' ? <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.55 }}>{upcoming.length}</span> : null}
      </button>)}
    </div>
    <div id="player-detail-panel" role="tabpanel" aria-labelledby={`player-tab-${tab}`} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 0 20px', scrollbarWidth: 'thin' }}>
      {tab === 'queue' ? <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '22px 12px 0' }}>
          <div style={{ minWidth: 0 }}><div style={{ color: colors.secondaryText, fontSize: 11 }}>Playing from</div>
            <div style={{ color: colors.text, marginTop: 5, fontSize: 19, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.source || 'Your queue'}</div></div>
          {upcoming.length ? <button type="button" style={textButton} onClick={() => setEditing(!editing)} aria-label={editing ? 'Finish editing queue' : 'Edit upcoming queue'}>{editing ? 'Done' : 'Edit queue'}</button> : null}
        </div>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: colors.background || colors.elevated }}><QueueUndo /></div>
        {editing ? <p style={{ color: colors.secondaryText, fontSize: 12, margin: '0 12px 12px', lineHeight: 1.5 }}>Drag songs to reorder, or use the arrows.</p> : null}
        {player.queue.map((song, index) => <div key={song.queueEntryId || `${song.id}:${index}`} ref={index === player.queueIndex ? currentRow : undefined} draggable={editing && index > player.queueIndex}
          onDragStart={(event) => { setDragIndex(index); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }}
          onDragOver={(event) => { if (editing && index > player.queueIndex && dragIndex !== null) event.preventDefault(); }}
          onDrop={(event) => { event.preventDefault(); if (editing && index > player.queueIndex && dragIndex !== null && dragIndex > player.queueIndex) player.moveQueueItem(dragIndex, index); setDragIndex(null); }}
          onDragEnd={() => setDragIndex(null)} style={{ opacity: dragIndex === index ? 0.45 : 1, contentVisibility: 'auto', containIntrinsicSize: 'auto 62px' }}>
          <DesktopQueueRow song={song} reason={queueOriginLabel(song)} active={index === player.queueIndex}
            onPlay={index === player.queueIndex ? player.togglePlay : () => player.playQueueIndex(index)} onMenu={() => openActions(song)}
            editing={editing && index > player.queueIndex} onRemove={index > player.queueIndex ? () => player.removeFromQueue(index) : undefined}
            onMoveUp={index > player.queueIndex + 1 ? () => player.moveQueueItem(index, index - 1) : undefined}
            onMoveDown={index < player.queue.length - 1 ? () => player.moveQueueItem(index, index + 1) : undefined} />
        </div>)}
        {!upcoming.length ? <div style={{ padding: '24px 12px', color: colors.secondaryText, fontSize: 13, lineHeight: 1.7 }}>
          No more songs in your queue.<br /><button type="button" style={textButton} onClick={() => setTab('related')}>Find something in Related</button>
        </div> : null}
        <QueueTools />
      </> : <>
        <div style={{ margin: '22px 12px 16px' }}><h3 style={{ color: colors.text, fontSize: 19, margin: '0 0 6px', fontWeight: 750 }}>Keep exploring</h3>
          <p style={{ color: colors.secondaryText, fontSize: 12, margin: 0 }}>More music inspired by this song.</p></div>
        {loading || error || !related.filter((song) => allowsRecommendation(song, feedback)).length
          ? <MusicListState loading={loading} title={error ? 'Let’s try that again' : 'A new direction awaits'} message={error || 'Try another song to discover more music.'} action={error ? 'Retry' : 'Back to queue'} onAction={() => error ? setRevision(revision + 1) : setTab('queue')} />
          : related.filter((song) => allowsRecommendation(song, feedback)).map((song) => <DesktopQueueRow key={song.id} song={song} reason={song.reason} onPlay={() => player.playSong(song, related.filter((item) => allowsRecommendation(item, feedback)), 'Related')} onMenu={() => openActions(song)} />)}
      </>}
    </div>
  </section>;
}

function DesktopQueueRowContent({ song, active, playing, reason, onPlay, onMenu, editing, onRemove, onMoveUp, onMoveDown }: {
  song: CrimsonSong; active?: boolean; playing?: boolean; reason?: string; onPlay: () => void; onMenu: () => void;
  editing?: boolean; onRemove?: () => void; onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  const { colors } = useAppSettings();
  const [hovered, setHovered] = useState(false);
  return <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10, background: active ? colors.accentSoft : hovered ? colors.elevated : 'transparent', minWidth: 0 }}>
    <button type="button" aria-label={`${playing ? 'Pause' : 'Play'} ${song.title} by ${song.creator}`} onClick={onPlay}
      style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 12, textAlign: 'left', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', color: colors.text }}>
      <span style={{ position: 'relative', display: 'block', flexShrink: 0, width: 44, height: 44, borderRadius: 8, overflow: 'hidden' }}>
        <ArtworkImage artwork={song.artwork} source={song.imageSmall || song.image || require('@/assets/images/home/default-song.webp')} contentFit="cover" style={{ width: 44, height: 44 }} />
        {active || hovered ? <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}><SymbolView name={playing ? 'pause.fill' : 'play.fill'} size={17} tintColor="#FFFFFF" /></span> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', color: active ? colors.accent : colors.text, fontSize: 13, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</span>
        <span style={{ display: 'block', color: colors.secondaryText, fontSize: 12, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.creator}{reason ? ` · ${reason}` : ''}</span></span>
    </button>
    {editing ? <div style={{ display: 'flex', alignItems: 'center' }}>
      <PlayerIconButton label={`Move ${song.title} up`} icon="arrow.up" onPress={onMoveUp || (() => {})} disabled={!onMoveUp} size={15} style={{ width: 28 }} />
      <PlayerIconButton label={`Move ${song.title} down`} icon="arrow.down" onPress={onMoveDown || (() => {})} disabled={!onMoveDown} size={15} style={{ width: 28 }} />
      <PlayerIconButton label={`Remove ${song.title} from queue`} icon="xmark" onPress={onRemove || (() => {})} size={15} style={{ width: 28 }} />
    </div> : <><span style={{ color: colors.secondaryText, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{formatPlayerTime(song.duration)}</span>
      {onRemove ? <PlayerIconButton label={`Remove ${song.title} from queue`} icon="xmark" onPress={onRemove} size={15} /> : null}
      <PlayerIconButton label={`More options for ${song.title}`} icon="ellipsis" onPress={onMenu} size={18} style={{ width: 28 }} /></>}
  </div>;
}

function DesktopQueueRow(props: ComponentProps<typeof DesktopQueueRowContent>) {
  return props.active ? <ActiveDesktopQueueRow {...props} /> : <DesktopQueueRowContent {...props} />;
}
function ActiveDesktopQueueRow(props: ComponentProps<typeof DesktopQueueRowContent>) {
  const { playing } = usePlayerStatus();
  return <DesktopQueueRowContent {...props} playing={playing} />;
}
