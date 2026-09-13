import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshSession } from '../src/services/auth';
import { refreshAudiusAccount } from '../src/services/audius-session';

let mockSession;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));
jest.mock('../src/services/audius', () => ({ clearAudiusCaches: jest.fn() }));
jest.mock('../src/services/audius-profile', () => ({ updateAudiusProfile: jest.fn() }));
jest.mock('../src/services/account-lifecycle', () => ({
  activateAccount: jest.fn(), isAccountDeleted: () => false, registerAccountCleanup: jest.fn(),
}));
jest.mock('../src/services/audius-session', () => ({
  AudiusSessionError: class AudiusSessionError extends Error {},
  getAudiusSession: () => mockSession,
  refreshAudiusAccount: jest.fn(),
}));

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  mockSession = { scope: 'write', account: { id: 'listener', handle: 'listener', name: 'Before', picture: 'before.jpg' } };
  refreshAudiusAccount.mockResolvedValue(mockSession.account);
});

test('a profile refresh waiting on preferences returns a later confirmed name and photo', async () => {
  const preferences = deferred();
  const readingPreferences = deferred();
  AsyncStorage.getItem.mockImplementation(() => { readingPreferences.resolve(); return preferences.promise; });
  const refreshing = refreshSession();
  await readingPreferences.promise;
  // Save commits while the older refresh is still mapping local preferences.
  mockSession = { ...mockSession, account: { ...mockSession.account, name: 'Saved name', picture: 'saved-photo.jpg' } };
  preferences.resolve(JSON.stringify({ FavoriteCategories: ['electronic'], RecommendationStyle: 'surprise' }));
  await expect(refreshing).resolves.toMatchObject({
    uid: 'listener', DisplayName: 'Saved name', ProfilePhoto: 'saved-photo.jpg',
    FavoriteCategories: ['electronic'], RecommendationStyle: 'surprise',
  });
});

test('local preference failures still use the latest confirmed account fields', async () => {
  let rejectPreferences;
  const readingPreferences = deferred();
  AsyncStorage.getItem.mockImplementation(() => {
    readingPreferences.resolve();
    return new Promise((_, reject) => { rejectPreferences = reject; });
  });
  const refreshing = refreshSession();
  await readingPreferences.promise;
  mockSession = { ...mockSession, account: { ...mockSession.account, name: 'Saved despite read error' } };
  rejectPreferences(new Error('Local storage unavailable'));
  await expect(refreshing).resolves.toMatchObject({ DisplayName: 'Saved despite read error', FavoriteCategories: [] });
});

test('an account switch cannot mix another account’s profile with the original account’s preferences', async () => {
  const preferences = deferred();
  const readingPreferences = deferred();
  AsyncStorage.getItem.mockImplementation(() => { readingPreferences.resolve(); return preferences.promise; });
  const refreshing = refreshSession();
  await readingPreferences.promise;
  mockSession = { scope: 'write', account: { id: 'other', handle: 'other', name: 'Other person', picture: 'other.jpg' } };
  preferences.resolve(JSON.stringify({ FavoriteCategories: ['Electronic'] }));
  // AuthProvider’s revision guard rejects this stale original-account result.
  await expect(refreshing).resolves.toMatchObject({ uid: 'listener', DisplayName: 'Before', ProfilePhoto: 'before.jpg' });
});
