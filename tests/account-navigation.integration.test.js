let mockSegments = ['(app)', '(account)', 'history'];
let mockRootState;

jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  useRootNavigationState: () => mockRootState,
}));

const { createDetailRoutes, useDetailRoutes } = require('../src/services/action-sheet');

beforeEach(() => {
  mockSegments = ['(app)', '(account)', 'history'];
  mockRootState = undefined;
});

test('opening artists and playlists from account history stays in the Account stack', () => {
  const routes = useDetailRoutes();
  expect(routes.artistHref('artist-1')).toEqual({ pathname: '/(app)/(account)/artist', params: { id: 'artist-1' } });
  expect(routes.playlistHref('playlist-1', true, 'audius').pathname).toBe('/(app)/(account)/playlist');
  expect(routes.historyHref().pathname).toBe('/(app)/(account)/history');
});

test('actions from a root sheet retain the underlying Account tab', () => {
  mockSegments = ['action-sheet'];
  mockRootState = {
    index: 1,
    routes: [
      { name: '(app)', state: { index: 1, routes: [{ name: '(home)' }, { name: '(account)' }] } },
      { name: 'action-sheet' },
    ],
  };
  expect(useDetailRoutes().artistHref('artist-1').pathname).toBe('/(app)/(account)/artist');
});

test('settings always opens the Account tab while notifications stays in the source tab', () => {
  for (const group of ['(home)', '(search)', '(library)', '(account)']) {
    const routes = createDetailRoutes(group);
    expect(routes.settingsHref().pathname).toBe('/(app)/(account)/account');
    expect(routes.notificationsHref().pathname).toBe(`/(app)/${group}/notifications`);
  }
});
