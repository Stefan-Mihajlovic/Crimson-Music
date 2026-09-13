import AsyncStorage from '@react-native-async-storage/async-storage';
import { completeUserOnboarding, hasCompletePersonalization, restoreSession, updateUserRecommendationStyle } from '../src/services/auth';

let mockSession;
let mockRevision;
let mockDeleted;
const mockStorage = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../src/services/audius', () => ({ clearAudiusCaches: jest.fn() }));
jest.mock('../src/services/audius-profile', () => ({ updateAudiusProfile: jest.fn() }));
jest.mock('../src/services/account-lifecycle', () => ({ activateAccount: jest.fn(), isAccountDeleted: () => mockDeleted, registerAccountCleanup: jest.fn() }));
jest.mock('../src/services/audius-session', () => ({
  AudiusSessionError: class extends Error {},
  getAudiusSession: () => mockSession,
  getAudiusSessionRevision: () => mockRevision,
  restoreAudiusSession: async () => mockSession,
}));
const key = 'crimson.audius.preferences.v1:listener';
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { resolve, promise };
}

beforeEach(() => {
  mockSession = { scope: 'write', account: { id: 'listener', name: 'Listener', handle: 'listener', picture: '' } };
  mockRevision = 1;
  mockDeleted = false;
  mockStorage.clear();
  AsyncStorage.getItem.mockImplementation(async (storageKey) => mockStorage.get(storageKey) ?? null);
  AsyncStorage.setItem.mockImplementation(async (storageKey, value) => { mockStorage.set(storageKey, value); });
});

test.each([
  ['absent', null], ['malformed', '{broken'], ['wrong shape', '[]'],
  ['empty', '{}'], ['style only', '{"RecommendationStyle":"surprise"}'],
  ['duplicates only', '{"FavoriteCategories":["rock","Rock"," rock "]}'],
  ['unknown genres', '{"FavoriteCategories":["made-up","unknown"]}'],
  ['forged completion without selections', '{"OnboardingComplete":true}'],
  ['corrupt completion flag', '{"FavoriteCategories":["rock","pop"],"OnboardingComplete":"false"}'],
])('%s preferences require setup after restoring Audius login', async (_, value) => {
  if (value !== null) mockStorage.set(key, value);
  const user = await restoreSession();
  expect(user.uid).toBe('listener');
  expect(user.OnboardingComplete).toBe(false);
  expect(hasCompletePersonalization(user)).toBe(false);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('legacy saved preferences skip setup and preserve discovery style without rewriting storage', async () => {
  const saved = JSON.stringify({ FavoriteCategories: ['Electronic', 'Hip-Hop/Rap', 'electronic', 'invalid'], RecommendationStyle: 'underground' });
  mockStorage.set(key, saved);
  const user = await restoreSession();
  expect(user.FavoriteCategories).toEqual(['electronic', 'hip-hop-rap']);
  expect(user.RecommendationStyle).toBe('underground');
  expect(user.OnboardingComplete).toBe(true);
  expect(hasCompletePersonalization(user)).toBe(true);
  expect(mockStorage.get(key)).toBe(saved);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('legacy valid genres with no style retain the balanced default and skip setup', async () => {
  mockStorage.set(key, JSON.stringify({ FavoriteCategories: ['rock', 'pop'] }));
  await expect(restoreSession()).resolves.toMatchObject({ OnboardingComplete: true, RecommendationStyle: 'balanced' });
});

test('an explicit unfinished draft cannot become complete from category selection alone', async () => {
  mockStorage.set(key, JSON.stringify({ FavoriteCategories: ['rock', 'pop'], OnboardingComplete: false }));
  await expect(restoreSession()).resolves.toMatchObject({ OnboardingComplete: false });
});

test('final completion persists valid distinct genres, style, and the completion flag for next login', async () => {
  await expect(completeUserOnboarding('listener', ['pop', 'Electronic', 'pop'], 'surprise')).resolves.toMatchObject({
    FavoriteCategories: ['pop', 'electronic'], RecommendationStyle: 'surprise', OnboardingComplete: true,
  });
  expect(JSON.parse(mockStorage.get(key))).toEqual({ FavoriteCategories: ['pop', 'electronic'], RecommendationStyle: 'surprise', OnboardingComplete: true });
  await expect(restoreSession()).resolves.toMatchObject({ OnboardingComplete: true });
  await updateUserRecommendationStyle('listener', 'underground');
  expect(JSON.parse(mockStorage.get(key))).toEqual({ FavoriteCategories: ['pop', 'electronic'], RecommendationStyle: 'underground', OnboardingComplete: true });
});

test('fewer than two valid categories cannot persist completion', async () => {
  await expect(completeUserOnboarding('listener', ['rock', 'Rock', 'unknown'], 'balanced')).rejects.toThrow('Choose at least 2');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('a failed local save leaves setup incomplete and retryable', async () => {
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('Device storage is full'));
  await expect(completeUserOnboarding('listener', ['rock', 'pop'], 'balanced')).rejects.toThrow('Device storage is full');
  await expect(restoreSession()).resolves.toMatchObject({ OnboardingComplete: false });
  await expect(completeUserOnboarding('listener', ['rock', 'pop'], 'balanced')).resolves.toMatchObject({ OnboardingComplete: true });
});

test('switching accounts during preference loading prevents the old draft from being written', async () => {
  const reading = deferred();
  const preferences = deferred();
  AsyncStorage.getItem.mockImplementationOnce(() => { reading.resolve(); return preferences.promise; });
  const completing = completeUserOnboarding('listener', ['rock', 'pop'], 'balanced');
  await reading.promise;
  mockSession = { scope: 'write', account: { id: 'other', name: 'Other', handle: 'other', picture: '' } };
  mockRevision += 1;
  preferences.resolve(null);
  await expect(completing).rejects.toThrow('account changed');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
