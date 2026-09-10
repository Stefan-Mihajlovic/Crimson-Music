import { audiusRequest, AudiusSessionError, getCurrentAudiusUserId, subscribeAudiusSession } from '@/services/audius-session';

type RecordValue = Record<string, unknown>;
type Entity = { id?: string; name?: string; handle?: string; title?: string; playlist_name?: string; user?: Entity; artwork?: Record<string, unknown>; profile_picture?: Record<string, unknown> };
type Related = { users?: Entity[]; tracks?: Entity[]; playlists?: Entity[] };
type RawNotification = { type?: string; group_id?: string; is_seen?: boolean; actions?: { timestamp?: number; data?: RecordValue }[] };
type NotificationResponse = { data?: { notifications?: RawNotification[]; unread_count?: number }; related?: Related };

export type NotificationTarget = { type: 'artist' | 'playlist' | 'track'; id: string } | { type: 'audius'; url: string };
export type AudiusNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: number;
  unread: boolean;
  image: string;
  target: NotificationTarget;
};
export type NotificationsCursor = { timestamp: number; groupId: string };
export type NotificationsPage = { items: AudiusNotification[]; unreadCount: number; cursor: NotificationsCursor | null; hasMore: boolean };

const pageSize = 20;
const listeners = new Set<() => void>();
let revision = 0;
let firstPage: { uid: string; page: NotificationsPage; loadedAt: number } | null = null;
let pending: { uid: string; promise: Promise<NotificationsPage> } | null = null;
let lastFailure: { uid: string; error: unknown; failedAt: number } | null = null;

subscribeAudiusSession(() => {
  revision += 1;
  firstPage = null;
  pending = null;
  lastFailure = null;
  listeners.forEach((listener) => listener());
});

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const id = (value: unknown) => text(value);
const imageUrl = (value: unknown) => /^https?:\/\//.test(text(value)) ? text(value) : '';
const picture = (entity?: Entity) => imageUrl(entity?.profile_picture?.['150x150'] || entity?.artwork?.['150x150'] || entity?.profile_picture?.['480x480'] || entity?.artwork?.['480x480']);
const entityName = (entity?: Entity) => text(entity?.name) || text(entity?.handle);

function audiusUrl(route: unknown) {
  try {
    const url = new URL(text(route) || '/notifications', 'https://audius.co');
    if (url.protocol === 'https:' && url.hostname === 'audius.co' && !url.username && !url.password) return url.toString();
  } catch { /* Fall back to the official inbox for an unsupported destination. */ }
  return 'https://audius.co/notifications';
}

/** REST schema: https://api.audius.co/v1/swagger.yaml (notifications + related entities). */
export function mapAudiusNotification(raw: RawNotification, related: Related = {}): AudiusNotification | null {
  if (!raw.group_id || !raw.type || !Array.isArray(raw.actions) || raw.actions.length === 0) return null;
  const actions = [...raw.actions].filter((action) => Number.isFinite(action.timestamp)).sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  const latest = actions[0];
  if (!latest || Number(latest.timestamp) <= 0) return null;
  const data = latest.data || {};
  const kind = text(data.type || data.content_type).toLowerCase();
  const itemId = id(data.save_item_id || data.repost_item_id || data.save_of_repost_item_id || data.repost_of_repost_item_id || data.content_id || data.entity_id || data.tastemaker_item_id);
  const playlistId = id(data.playlist_id) || (['playlist', 'album'].includes(kind) ? itemId : '');
  const trackId = id(data.track_id) || (!['playlist', 'album'].includes(kind) ? itemId : '');
  const track = related.tracks?.find((item) => item.id === trackId);
  const playlist = related.playlists?.find((item) => item.id === playlistId);
  const actorId = id(data.follower_user_id || data.comment_user_id || data.reacter_user_id || data.sender_user_id || data.buyer_user_id || data.playlist_owner_id || data.track_owner_id || data.inviter_user_id || data.entity_user_id || data.user_id);
  const actor = related.users?.find((item) => item.id === actorId) || (raw.type === 'create' || raw.type === 'remix' ? track?.user || playlist?.user : undefined);
  const actorName = entityName(actor) || 'Someone';
  const actorIds = new Set(actions.map((action) => {
    const value = action.data || {};
    return id(value.follower_user_id || value.user_id || value.comment_user_id || value.reacter_user_id || value.sender_user_id);
  }).filter(Boolean));
  const actorLabel = actorIds.size > 1 ? `${actorName} and ${actorIds.size - 1} ${actorIds.size === 2 ? 'other' : 'others'}` : actorName;
  const title = text(track?.title) || text(playlist?.playlist_name);
  const content = title ? `“${title}”` : playlistId ? 'your playlist' : 'your track';
  let heading = 'Audius activity';
  let message = 'You have a new update on Audius.';
  let target: NotificationTarget = playlistId ? { type: 'playlist', id: playlistId } : trackId ? { type: 'track', id: trackId } : actor?.id ? { type: 'artist', id: actor.id } : { type: 'audius', url: 'https://audius.co/notifications' };

  switch (raw.type) {
    case 'follow': heading = 'New follower'; message = `${actorLabel} followed you.`; break;
    case 'save': heading = 'New favorite'; message = `${actorLabel} favorited ${content}.`; break;
    case 'repost': heading = 'New repost'; message = `${actorLabel} reposted ${content}.`; break;
    case 'save_of_repost': heading = 'Favorite from your repost'; message = `${actorLabel} favorited a track you reposted.`; break;
    case 'repost_of_repost': heading = 'Your repost is spreading'; message = `${actorLabel} reposted a track you reposted.`; break;
    case 'create': heading = playlistId ? 'New playlist or album' : 'New music'; message = `${actorName === 'Someone' ? 'An artist you follow' : actorName} released ${title ? `“${title}”` : 'new music'}.`; break;
    case 'remix': heading = 'New remix'; message = `${actorName} remixed your track${title ? `: “${title}”` : ''}.`; break;
    case 'cosign': heading = 'Remix co-sign'; message = `${actorName} co-signed your remix${title ? ` “${title}”` : ''}.`; break;
    case 'comment': heading = 'New comment'; message = `${actorLabel} commented on ${content}.`; break;
    case 'comment_thread': heading = 'New reply'; message = `${actorLabel} replied in a conversation on ${content}.`; break;
    case 'comment_mention': heading = 'You were mentioned'; message = `${actorLabel} mentioned you in a comment on ${content}.`; break;
    case 'comment_reaction': heading = 'Comment reaction'; message = `${actorLabel} reacted to your comment on ${content}.`; break;
    case 'track_added_to_playlist': heading = 'Added to a playlist'; message = `${actorName} added ${text(track?.title) ? `“${track?.title}”` : 'your track'} to ${text(playlist?.playlist_name) ? `“${playlist?.playlist_name}”` : 'a playlist'}.`; break;
    case 'track_added_to_purchased_album': heading = 'Your album has new music'; message = `${text(playlist?.playlist_name) || 'An album you purchased'} now includes a new track.`; break;
    case 'trending': case 'trending_playlist': case 'trending_underground': heading = 'You’re trending'; message = `${content}${Number.isFinite(data.rank) ? ` is #${data.rank}` : ' is trending'} on Audius.`; break;
    case 'milestone': case 'track_milestone': case 'playlist_milestone': heading = 'New milestone'; message = `${title || 'Your Audius profile'} reached ${Number.isFinite(data.threshold) ? `${data.threshold} ` : 'a new '}${text(data.type).replace(/_/g, ' ') || 'milestone'}.`; break;
    case 'tip_receive': heading = 'New support'; message = `${actorName} sent you a tip.`; break;
    case 'tip_send': heading = 'Support sent'; message = 'Your tip was sent on Audius.'; break;
    case 'usdc_purchase_buyer': heading = 'Purchase complete'; message = `You purchased ${content}.`; break;
    case 'usdc_purchase_seller': heading = 'New purchase'; message = `${actorName} purchased ${content}.`; break;
    case 'announcement': heading = text(data.title) || 'Audius announcement'; message = text(data.short_description || data.push_body || data.long_description) || 'A new announcement from Audius.'; target = { type: 'audius', url: audiusUrl(data.route) }; break;
    case 'challenge_reward': case 'claimable_reward': heading = 'Audius reward'; message = 'You have a reward update. View the details on Audius.'; break;
    case 'tier_change': heading = 'New Audius tier'; message = `Your Audius tier has changed${text(data.new_tier) ? ` to ${data.new_tier}` : ''}.`; break;
    case 'request_manager': case 'approve_manager_request': heading = 'Account manager update'; message = 'You have an account manager update on Audius.'; break;
    case 'track_collaborator_invite': heading = 'Collaboration invitation'; message = `${actorName} invited you to collaborate on ${content}.`; break;
    case 'track_collaborator_accept': heading = 'Collaboration accepted'; message = `A collaborator accepted an invitation for ${content}.`; break;
    case 'listen_streak_reminder': heading = 'Keep your listening streak'; message = 'Listen on Audius to keep your streak going.'; break;
    case 'fan_club_text_post': heading = 'New fan club post'; message = `${actorName === 'Someone' ? 'An artist you follow' : actorName} shared a fan club update.`; break;
    default:
      if (raw.type.includes('remix_contest')) { heading = 'Remix contest update'; message = 'A remix contest you’re involved in has an update on Audius.'; }
      else if (raw.type.includes('supporter') || raw.type === 'supporting_rank_up') { heading = 'Supporter update'; message = 'Your supporter rankings have changed on Audius.'; }
  }
  // Comments, purchases, and account actions need Audius’s dedicated detail UI.
  if (raw.type.startsWith('comment') || raw.type.includes('manager') || raw.type.includes('reward') || raw.type.includes('remix_contest') || raw.type.includes('collaborator') || raw.type.startsWith('usdc_') || raw.type === 'fan_club_text_post') {
    target = { type: 'audius', url: 'https://audius.co/notifications' };
  }
  return { id: raw.group_id, type: raw.type, title: heading, message, timestamp: Number(latest.timestamp), unread: raw.is_seen === false, image: picture(actor) || picture(track) || picture(playlist), target };
}

export function subscribeNotificationUnreadCount(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getNotificationUnreadCount(uid?: string) { return uid && uid === getCurrentAudiusUserId() && firstPage?.uid === uid ? firstPage.page.unreadCount : 0; }

export async function loadNotificationsPage(uid: string, cursor: NotificationsCursor | null = null, options: { force?: boolean; dataSaver?: boolean } = {}): Promise<NotificationsPage> {
  if (!uid || uid !== getCurrentAudiusUserId()) throw new AudiusSessionError('Log in with Audius to view your notifications.', 'unauthenticated');
  if (!cursor && pending?.uid === uid) return pending.promise;
  const cacheDuration = options.dataSaver ? 5 * 60_000 : 2 * 60_000;
  if (!cursor && !options.force && lastFailure?.uid === uid && Date.now() - lastFailure.failedAt < cacheDuration) throw lastFailure.error;
  if (!cursor && !options.force && firstPage?.uid === uid && Date.now() - firstPage.loadedAt < cacheDuration) return firstPage.page;
  const requestRevision = revision;
  const params = new URLSearchParams({ limit: String(pageSize) });
  if (cursor) { params.set('timestamp', String(cursor.timestamp)); params.set('group_id', cursor.groupId); }
  const operation = (async () => {
    const response = await audiusRequest<NotificationResponse>(`/notifications/${encodeURIComponent(uid)}?${params}`);
    if (requestRevision !== revision || uid !== getCurrentAudiusUserId()) throw new AudiusSessionError('The Audius account changed. Please try again.', 'cancelled');
    if (!Array.isArray(response.data?.notifications)) throw new Error('Audius returned an incomplete notifications response. Please try again.');
    const rawItems = response.data.notifications;
    const items = rawItems.map((notification) => mapAudiusNotification(notification, response.related)).filter((item): item is AudiusNotification => item !== null);
    // Cursor follows the last raw record, even if another malformed record was omitted from display.
    const last = rawItems[rawItems.length - 1];
    const lastTimestamp = Math.max(0, ...(last?.actions || []).map((action) => Number(action.timestamp) || 0));
    const nextCursor = last?.group_id && lastTimestamp ? { timestamp: lastTimestamp, groupId: last.group_id } : null;
    const page: NotificationsPage = {
      items, unreadCount: Math.max(0, Number(response.data.unread_count) || 0), cursor: nextCursor,
      hasMore: rawItems.length >= pageSize && !!nextCursor && (nextCursor.groupId !== cursor?.groupId || nextCursor.timestamp !== cursor?.timestamp),
    };
    if (!cursor) { firstPage = { uid, page, loadedAt: Date.now() }; lastFailure = null; listeners.forEach((listener) => listener()); }
    return page;
  })();
  if (!cursor) pending = { uid, promise: operation };
  try { return await operation; }
  catch (error) {
    if (!cursor && requestRevision === revision && uid === getCurrentAudiusUserId()) lastFailure = { uid, error, failedAt: Date.now() };
    throw error;
  }
  finally { if (pending?.promise === operation) pending = null; }
}

export function notificationErrorMessage(error: unknown) {
  if (error instanceof AudiusSessionError && error.code === '403') return 'Audius hasn’t granted this login access to notifications. You can open your inbox in Audius.';
  if (error instanceof AudiusSessionError && error.code === '404') return 'Notifications are currently unavailable through Audius. You can open your inbox in Audius.';
  return error instanceof Error ? error.message : 'Could not load your notifications. Please try again.';
}
