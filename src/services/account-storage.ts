export function belongsToAccount(key: string, uid: string) {
  const exact = [
    `crimson.account.profile.v1:${uid}`,
    `crimson.audius.preferences.v1:${uid}`,
    `crimson.notifications.seen.v1:${uid}`,
    `crimson.vault.last-mood:${uid}`,
    `crimson.player.session.v1:${uid}`,
    `crimson.player.progress.v1:${uid}`,
    `crimson.offline.data.v1:history:${uid}`,
    `crimson.downloads.manifest.v1:${uid}`,
    `crimson.downloads.preferences.v1:${uid}`,
    `crimson.downloads.collections.v1:${uid}`,
    `crimson.offline.data.v1:home:${uid}`,
    `crimson.offline.data.v1:library:${uid}`,
    `crimson.offline.data.v1:favorites:${uid}`,
    `crimson.events.outbox.v1:${uid}`,
    `crimson.local-favorites.v1:${uid}`,
    `crimson.personal-mix-bookmarks.v1:${encodeURIComponent(uid)}`,
  ];
  const audiusKeys = ['home', 'library', 'favorites', 'history'].map((kind) => `crimson.offline.data.v2:${kind}:${uid}`);
  return key.startsWith(`crimson.playlist-local-tracks.v1:${uid}:`) || audiusKeys.includes(key) || key.startsWith(`crimson.offline.data.v2:playlist:${uid}:`) || exact.includes(key) || key.startsWith(`crimson.offline.data.v1:playlist:${uid}:`) || key.startsWith(`crimson.personal-mixes.v1:${encodeURIComponent(uid)}:`);
}
