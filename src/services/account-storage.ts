export function belongsToAccount(key: string, uid: string) {
  const exact = [
    `crimson.account.profile.v1:${uid}`,
    `crimson.audius.preferences.v1:${uid}`,
    `crimson.offline.data.v1:history:${uid}`,
    `crimson.downloads.manifest.v1:${uid}`,
    `crimson.downloads.preferences.v1:${uid}`,
    `crimson.downloads.collections.v1:${uid}`,
    `crimson.offline.data.v1:home:${uid}`,
    `crimson.offline.data.v1:library:${uid}`,
    `crimson.offline.data.v1:favorites:${uid}`,
    `crimson.events.outbox.v1:${uid}`,
  ];
  const audiusKeys = ['home', 'library', 'favorites', 'history'].map((kind) => `crimson.offline.data.v2:${kind}:${uid}`);
  return audiusKeys.includes(key) || key.startsWith(`crimson.offline.data.v2:playlist:${uid}:`) || exact.includes(key) || key.startsWith(`crimson.offline.data.v1:playlist:${uid}:`);
}
