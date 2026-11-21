import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowsRecommendation, changeRecommendationFeedback, EMPTY_FEEDBACK, recommendationAffinity } from '../src/services/recommendation-feedback-model.ts';
const song = { id: 'one', artistId: 'artist', genre: 'Electronic' };
test('more like this favors the selected song, artist and genre without mutating the previous preferences', () => {
  const next = changeRecommendationFeedback(EMPTY_FEEDBACK, song, 'more');
  assert.equal(Object.keys(EMPTY_FEEDBACK.liked).length, 0);
  assert.equal(recommendationAffinity(song, next).score, 10);
  assert.equal(recommendationAffinity({ ...song, id: 'two' }, next).score, 6);
  assert.equal(recommendationAffinity({ id: 'three', artistId: 'other', genre: 'electronic' }, next).score, 3);
  assert.equal(recommendationAffinity({ id: 'four', artistId: 'other', genre: 'Jazz' }, next).score, 0);
  assert.equal(Object.keys(changeRecommendationFeedback(next, song, 'more').liked).length, 0);
});
test('song and artist exclusions are reversible and only affect recommendations', () => {
  const hiddenSong = changeRecommendationFeedback(EMPTY_FEEDBACK, song, 'hide-song');
  assert.equal(allowsRecommendation(song, hiddenSong), false);
  assert.equal(allowsRecommendation({ ...song, id: 'two' }, hiddenSong), true);
  const hiddenArtist = changeRecommendationFeedback(hiddenSong, song, 'hide-artist');
  assert.equal(allowsRecommendation({ ...song, id: 'two' }, hiddenArtist), false);
  const liked = changeRecommendationFeedback(hiddenArtist, song, 'more');
  assert.equal(allowsRecommendation(song, liked), true);
  assert.equal(allowsRecommendation({ ...song, id: 'two' }, changeRecommendationFeedback(hiddenArtist, song, 'hide-artist')), true);
});
