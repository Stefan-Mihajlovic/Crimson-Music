import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/providers/auth-provider';
import { refreshSession, restoreSession, signOut, subscribeAuthSession, updateUserRecommendationStyle } from '../src/services/auth';
import { clearDeletedAccountData } from '../src/services/account-cleanup';

jest.mock('../src/services/account-cleanup', () => ({ clearDeletedAccountData: jest.fn(async () => {}) }));
jest.mock('../src/services/telemetry', () => ({ reportError: jest.fn() }));
jest.mock('../src/services/auth', () => ({
  restoreSession: jest.fn(), refreshSession: jest.fn(),
  hasCompletePersonalization: (user) => Boolean(user?.onboardingComplete),
  signOut: jest.fn(async () => {}),
  signInWithAudius: jest.fn(async () => ({ uid: 'new', onboardingComplete: false })),
  subscribeAuthSession: jest.fn(() => () => {}),
  updateUserRecommendationStyle: jest.fn(),
}));

let auth;
let root;
function Probe() { auth = useAuth(); return null; }
const tree = () => React.createElement(AuthProvider, null, React.createElement(Probe));
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  restoreSession.mockResolvedValue({ uid: 'old', onboardingComplete: true });
  refreshSession.mockResolvedValue(null);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('a delayed background profile refresh cannot sign an old user back in', async () => {
  const refreshing = deferred();
  refreshSession.mockReturnValueOnce(refreshing.promise);
  await act(async () => { root = create(tree()); });
  expect(auth.user.uid).toBe('old');
  await act(async () => auth.signOut());
  await act(async () => refreshing.resolve({ uid: 'old', onboardingComplete: true }));
  expect(auth.user).toBeNull();
  expect(auth.onboardingComplete).toBe(false);
});

test('a delayed profile mutation cannot replace the next authenticated account', async () => {
  await act(async () => { root = create(tree()); });
  const updating = deferred();
  updateUserRecommendationStyle.mockReturnValueOnce(updating.promise);
  let pending;
  await act(async () => { pending = auth.updateRecommendationStyle('surprise'); });
  await act(async () => auth.signOut());
  await act(async () => auth.signInWithAudius());
  await act(async () => { updating.resolve({ uid: 'old', RecommendationStyle: 'surprise', onboardingComplete: true }); await pending; });
  expect(auth.user.uid).toBe('new');
  expect(auth.onboardingComplete).toBe(false);
});

test('late startup restore cannot overwrite an explicit sign in', async () => {
  const restoring = deferred();
  restoreSession.mockReturnValueOnce(restoring.promise);
  await act(async () => { root = create(tree()); });
  await act(async () => auth.signInWithAudius());
  await act(async () => restoring.resolve({ uid: 'old', onboardingComplete: true }));
  expect(auth.user.uid).toBe('new');
  expect(auth.ready).toBe(true);
});

test('an expired Audius session clears the active account and rejects a stale refresh', async () => {
  const refreshing = deferred();
  refreshSession.mockReturnValueOnce(refreshing.promise);
  await act(async () => { root = create(tree()); });
  const notifySession = subscribeAuthSession.mock.calls.at(-1)[0];
  await act(async () => notifySession(null));
  await act(async () => refreshing.resolve({ uid: 'old', onboardingComplete: true }));
  expect(auth.user).toBeNull();
});

test('failed local cleanup stays available to retry and disconnects after successful removal', async () => {
  await act(async () => { root = create(tree()); });
  clearDeletedAccountData.mockRejectedValueOnce(new Error('Device storage unavailable'));
  await act(async () => {
    await expect(auth.disconnectAndClearLocalData()).rejects.toThrow('Device storage unavailable');
  });
  expect(clearDeletedAccountData).toHaveBeenCalledWith('old');
  expect(auth.user.uid).toBe('old');
  expect(signOut).not.toHaveBeenCalled();
  await act(async () => auth.disconnectAndClearLocalData());
  expect(clearDeletedAccountData).toHaveBeenCalledTimes(2);
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(auth.user).toBeNull();
});
