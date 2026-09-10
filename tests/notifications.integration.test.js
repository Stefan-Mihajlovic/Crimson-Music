import { beforeEach, expect, jest, test } from '@jest/globals';

jest.mock('@/services/audius-session', () => ({
  audiusRequest: jest.fn(),
  getCurrentAudiusUserId: jest.fn(),
  subscribeAudiusSession: jest.fn(),
  AudiusSessionError: class AudiusSessionError extends Error {
    constructor(message, code = 'session') { super(message); this.code = code; }
  },
}));

let session;
let notifications;
let accountChanged;
const now = 1789039000;
const makeFollow = (index, extra = {}) => ({
  type: 'follow', group_id: `follow-${index}`, is_seen: false,
  actions: [{ timestamp: now - index, data: { follower_user_id: 'artist-1', followee_user_id: 'listener-1' } }],
  ...extra,
});
const payload = (items, unreadCount = 3) => ({
  data: { notifications: items, unread_count: unreadCount },
  related: { users: [{ id: 'artist-1', name: 'Artist One', profile_picture: { '150x150': 'https://images.example/artist-small.jpg', '480x480': 'https://images.example/artist-large.jpg' } }] },
});

beforeEach(() => {
  jest.resetModules();
  session = require('../src/services/audius-session');
  session.getCurrentAudiusUserId.mockReturnValue('listener-1');
  session.subscribeAudiusSession.mockImplementation((listener) => { accountChanged = listener; return () => {}; });
  notifications = require('../src/services/notifications');
});

test('fetches real notification pages with names, lightweight pictures, unread state, and a timestamp cursor', async () => {
  session.audiusRequest.mockResolvedValue(payload(Array.from({ length: 20 }, (_, index) => makeFollow(index))));
  const page = await notifications.loadNotificationsPage('listener-1');
  expect(session.audiusRequest).toHaveBeenCalledWith('/notifications/listener-1?limit=20');
  expect(page.items[0]).toMatchObject({ title: 'New follower', message: 'Artist One followed you.', unread: true, timestamp: now, image: 'https://images.example/artist-small.jpg', target: { type: 'artist', id: 'artist-1' } });
  expect(page.cursor).toEqual({ timestamp: now - 19, groupId: 'follow-19' });
  expect(page.hasMore).toBe(true);
  expect(notifications.getNotificationUnreadCount('listener-1')).toBe(3);
  session.audiusRequest.mockResolvedValue(payload([makeFollow(20, { is_seen: true })]));
  const older = await notifications.loadNotificationsPage('listener-1', page.cursor);
  expect(session.audiusRequest).toHaveBeenLastCalledWith(`/notifications/listener-1?limit=20&timestamp=${now - 19}&group_id=follow-19`);
  expect(older.hasMore).toBe(false);
  expect(older.items[0].unread).toBe(false);
});

test('coalesces mounted header requests and reuses the first page until explicitly refreshed', async () => {
  let resolve;
  session.audiusRequest.mockReturnValue(new Promise((done) => { resolve = done; }));
  const first = notifications.loadNotificationsPage('listener-1');
  const second = notifications.loadNotificationsPage('listener-1');
  expect(session.audiusRequest).toHaveBeenCalledTimes(1);
  resolve(payload([makeFollow(0)]));
  const [a, b] = await Promise.all([first, second]);
  expect(a).toBe(b);
  expect(await notifications.loadNotificationsPage('listener-1', null, { dataSaver: true })).toBe(a);
  expect(session.audiusRequest).toHaveBeenCalledTimes(1);
  session.audiusRequest.mockResolvedValue(payload([]));
  await notifications.loadNotificationsPage('listener-1', null, { force: true });
  expect(session.audiusRequest).toHaveBeenCalledTimes(2);
});

test('data saver extends the first-page cache rather than adding background polling', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    session.audiusRequest.mockResolvedValue(payload([makeFollow(0)]));
    await notifications.loadNotificationsPage('listener-1');
    clock.mockReturnValue(181000);
    await notifications.loadNotificationsPage('listener-1', null, { dataSaver: true });
    expect(session.audiusRequest).toHaveBeenCalledTimes(1);
    await notifications.loadNotificationsPage('listener-1');
    expect(session.audiusRequest).toHaveBeenCalledTimes(2);
  } finally { clock.mockRestore(); }
});

test('permission failures back off across tab changes while explicit refresh retries', async () => {
  const denied = new session.AudiusSessionError('Forbidden', '403');
  session.audiusRequest.mockRejectedValue(denied);
  await expect(notifications.loadNotificationsPage('listener-1')).rejects.toBe(denied);
  await expect(notifications.loadNotificationsPage('listener-1')).rejects.toBe(denied);
  expect(session.audiusRequest).toHaveBeenCalledTimes(1);
  session.audiusRequest.mockResolvedValue(payload([]));
  await expect(notifications.loadNotificationsPage('listener-1', null, { force: true })).resolves.toMatchObject({ items: [] });
  expect(session.audiusRequest).toHaveBeenCalledTimes(2);
});

test('logout clears the unread snapshot and in-flight notifications cannot cross sessions', async () => {
  session.audiusRequest.mockResolvedValueOnce(payload([makeFollow(0)], 7));
  await notifications.loadNotificationsPage('listener-1');
  const listener = jest.fn();
  const unsubscribe = notifications.subscribeNotificationUnreadCount(listener);
  let resolve;
  session.audiusRequest.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const inFlight = notifications.loadNotificationsPage('listener-1', null, { force: true });
  session.getCurrentAudiusUserId.mockReturnValue('listener-2');
  accountChanged();
  expect(notifications.getNotificationUnreadCount('listener-1')).toBe(0);
  expect(notifications.getNotificationUnreadCount('listener-2')).toBe(0);
  expect(listener).toHaveBeenCalledTimes(1);
  resolve(payload([makeFollow(2)]));
  await expect(inFlight).rejects.toMatchObject({ code: 'cancelled' });
  await expect(notifications.loadNotificationsPage('listener-1')).rejects.toMatchObject({ code: 'unauthenticated' });
  unsubscribe();
});

test('maps grouped track and playlist activity using the REST related data without extra calls', () => {
  const related = {
    users: [{ id: 'artist-1', name: 'Artist One' }, { id: 'artist-2', name: 'Artist Two' }],
    tracks: [{ id: 'track-1', title: 'Evening Lights' }],
    playlists: [{ id: 'playlist-1', playlist_name: 'Night Drive' }],
  };
  const favorite = notifications.mapAudiusNotification({ type: 'save', group_id: 'save-track-1', is_seen: false, actions: [
    { timestamp: now, data: { type: 'track', user_id: 'artist-1', save_item_id: 'track-1' } },
    { timestamp: now - 1, data: { type: 'track', user_id: 'artist-2', save_item_id: 'track-1' } },
  ] }, related);
  expect(favorite.message).toBe('Artist One and 1 other favorited “Evening Lights”.');
  expect(favorite.target).toEqual({ type: 'track', id: 'track-1' });
  const repost = notifications.mapAudiusNotification({ type: 'repost', group_id: 'repost-playlist-1', is_seen: true, actions: [{ timestamp: now, data: { type: 'playlist', user_id: 'artist-1', repost_item_id: 'playlist-1' } }] }, related);
  expect(repost.message).toBe('Artist One reposted “Night Drive”.');
  expect(repost.target).toEqual({ type: 'playlist', id: 'playlist-1' });
  expect(session.audiusRequest).not.toHaveBeenCalled();
});

test('announcement links stay within Audius and unsupported types remain readable', () => {
  for (const route of ['javascript:alert(1)', 'https://attacker.example/phish', '//attacker.example', 'https://user:password@audius.co']) {
    const item = notifications.mapAudiusNotification({ type: 'announcement', group_id: 'announcement', actions: [{ timestamp: now, data: { title: 'A real announcement', short_description: 'From Audius', route } }] });
    expect(item.target).toEqual({ type: 'audius', url: 'https://audius.co/notifications' });
  }
  const unknown = notifications.mapAudiusNotification({ type: 'new-future-type', group_id: 'new', actions: [{ timestamp: now, data: {} }] });
  expect(unknown).toMatchObject({ title: 'Audius activity', message: 'You have a new update on Audius.' });
  expect(notifications.mapAudiusNotification({ type: 'follow', group_id: 'broken', actions: [] })).toBeNull();
});

test('a repeated last cursor stops pagination and API failures are not shown as an empty inbox', async () => {
  const cursor = { timestamp: now, groupId: 'follow-0' };
  session.audiusRequest.mockResolvedValue(payload(Array.from({ length: 20 }, () => makeFollow(0))));
  const page = await notifications.loadNotificationsPage('listener-1', cursor);
  expect(page.hasMore).toBe(false);
  session.audiusRequest.mockResolvedValue({ data: {} });
  await expect(notifications.loadNotificationsPage('listener-1')).rejects.toThrow('incomplete notifications response');
  expect(notifications.notificationErrorMessage(new session.AudiusSessionError('Forbidden', '403'))).toContain('hasn’t granted');
  expect(notifications.notificationErrorMessage(new session.AudiusSessionError('Not found', '404'))).toContain('unavailable through Audius');
});
