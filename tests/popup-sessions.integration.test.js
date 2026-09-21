import { expect, jest, test } from '@jest/globals';
import { completePopupSession, createPopupSession, getPopupSession, isPopupSessionActive, mountPopupSession, revokePopupSession } from '../src/services/popup-sessions';
import { popupPresentationOptions, popupRouteNames } from '../src/services/popup-presentation';
import fs from 'node:fs';
import path from 'node:path';

test.each(['ios', 'android', 'web'])('%s gives both forms the action sheet presentation, surface and drag behavior', (platform) => {
  const options = popupPresentationOptions({ platform, elevated: '#211B29', performanceMode: false, reduceMotion: false });
  expect(popupRouteNames).toEqual(expect.arrayContaining(['action-sheet', 'player-details', 'search-filters', 'playlist-editor']));
  expect(options.presentation).toBe(platform === 'web' ? 'transparentModal' : 'formSheet');
  expect(options.contentStyle.backgroundColor).toBe(platform === 'ios' ? '#211B29' : 'transparent');
  expect(options.sheetAllowedDetents).toEqual([0.5, 1]);
  expect(options.sheetInitialDetentIndex).toBe(0);
  expect(options.sheetGrabberVisible).toBe(true);
  expect(options.sheetExpandsWhenScrolledToEdge).toBe(true);
  expect(popupPresentationOptions({ platform, elevated: '#211B29', performanceMode: true, reduceMotion: true, detent: 0.75 }).sheetAllowedDetents).toEqual([0.75, 1]);
  const layout = fs.readFileSync(path.join(process.cwd(), 'src/app/_layout.tsx'), 'utf8');
  expect(layout).toContain('popupRouteNames.includes(route.name)');
  expect(layout).toContain('popupRouteNames.map((name)');
  expect(layout).toContain('options={popupPresentationOptions(');
});

test('session callbacks are not restored by a URL, different account or wrong sheet kind', () => {
  const session = createPopupSession('owner', 'search-filters', { value: {}, onChange: jest.fn() }, jest.fn());
  expect(getPopupSession(session.id, 'other', 'search-filters')).toBeUndefined();
  expect(getPopupSession(session.id, undefined, 'search-filters')).toBeUndefined();
  expect(getPopupSession(session.id, 'owner', 'playlist-editor')).toBeUndefined();
  revokePopupSession(session.id);
  expect(getPopupSession(session.id, 'owner', 'search-filters')).toBeUndefined();
});

test('native swipe cleanup removes its session; successful completion waits for removal and runs once', async () => {
  const onClose = jest.fn();
  const completion = jest.fn();
  const session = createPopupSession('owner', 'search-filters', { value: {}, onChange: jest.fn() }, onClose);
  const unmount = mountPopupSession(session);
  completePopupSession(session, completion);
  expect(completion).not.toHaveBeenCalled();
  unmount();
  unmount();
  await Promise.resolve();
  expect(isPopupSessionActive(session)).toBe(false);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(completion).toHaveBeenCalledTimes(1);
});

test('Strict Mode effect replay does not prematurely dismiss a sheet or lose its completion', async () => {
  const onClose = jest.fn();
  const session = createPopupSession('owner', 'search-filters', { value: {}, onChange: jest.fn() }, onClose);
  mountPopupSession(session)();
  const unmount = mountPopupSession(session);
  await Promise.resolve();
  expect(isPopupSessionActive(session)).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
  unmount();
  await Promise.resolve();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('source screen/account disposal cancels deferred navigation and updates even after a write completed', async () => {
  const onClose = jest.fn();
  const completion = jest.fn();
  const session = createPopupSession('owner', 'search-filters', { value: {}, onChange: jest.fn() }, onClose);
  const unmount = mountPopupSession(session);
  completePopupSession(session, completion);
  unmount();
  revokePopupSession(session.id);
  await Promise.resolve();
  expect(onClose).not.toHaveBeenCalled();
  expect(completion).not.toHaveBeenCalled();
});
