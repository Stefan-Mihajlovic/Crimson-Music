import AsyncStorage from '@react-native-async-storage/async-storage';
import { activateAccount, disposeDeletedAccount } from '../src/services/account-lifecycle';
import { getRecommendationFeedback, readRecommendationFeedback, saveRecommendationFeedback } from '../src/services/recommendation-feedback';
let mockUid;
let mockRevision;
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/services/audius-session', () => ({ getCurrentAudiusUserId: () => mockUid, getAudiusSessionRevision: () => mockRevision }));
const song = { id: 'song', artistId: 'artist', genre: 'House' };
let sequence = 0;
beforeEach(async () => { await AsyncStorage.clear(); mockUid = `listener-${++sequence}`; mockRevision = sequence; activateAccount(mockUid); });

test('feedback persists per account and serializes rapid choices without losing either', async () => {
  await Promise.all([saveRecommendationFeedback(mockUid, song, 'more'), saveRecommendationFeedback(mockUid, { ...song, id: 'other' }, 'hide-song')]);
  const saved = getRecommendationFeedback(mockUid);
  expect(saved.liked.song).toEqual({ artistId: 'artist', genre: 'House' });
  expect(saved.hiddenSongs).toEqual(['other']);
  expect(JSON.parse(await AsyncStorage.getItem(`crimson.recommendation-feedback.v1:${mockUid}`))).toEqual(saved);
  expect((await readRecommendationFeedback('another-listener')).liked).toEqual({});
});

test('failed persistence leaves the active preferences unchanged and a retry succeeds', async () => {
  await readRecommendationFeedback(mockUid);
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
  await expect(saveRecommendationFeedback(mockUid, song, 'hide-artist')).rejects.toThrow('disk full');
  expect(getRecommendationFeedback(mockUid).hiddenArtists).toEqual([]);
  await saveRecommendationFeedback(mockUid, song, 'hide-artist');
  expect(getRecommendationFeedback(mockUid).hiddenArtists).toEqual(['artist']);
});

test('an account switch cancels queued feedback and account deletion removes persisted preferences', async () => {
  const oldUid = mockUid;
  const pending = saveRecommendationFeedback(mockUid, song, 'more');
  mockUid = 'different-listener'; mockRevision++;
  await expect(pending).rejects.toThrow('account changed');
  expect(getRecommendationFeedback(oldUid).liked).toEqual({});
  mockUid = oldUid;
  await saveRecommendationFeedback(mockUid, song, 'more');
  await disposeDeletedAccount(oldUid);
  expect(getRecommendationFeedback(oldUid).liked).toEqual({});
  expect(await AsyncStorage.getItem(`crimson.recommendation-feedback.v1:${oldUid}`)).toBeNull();
});
