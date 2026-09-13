import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Animated, AppState } from 'react-native';
import WelcomeArtworkGrid from '../src/components/welcome-artwork-grid';
import { getWelcomeArtwork } from '../src/services/welcome-artwork';

let mockFocused;
let mockSettings;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => mockSettings }));
jest.mock('../src/services/welcome-artwork', () => ({ getWelcomeArtwork: jest.fn() }));

let root;
let loops;
let onAppState;
let removeListener;
let appStateDescriptor;
const mount = async () => { await act(async () => { root = create(<WelcomeArtworkGrid />); }); };
const update = async () => { await act(async () => root.update(<WelcomeArtworkGrid />)); };
const activeLoops = () => loops.filter((loop) => loop.start.mock.calls.length && !loop.stop.mock.calls.length);

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockFocused = true;
  mockSettings = { dataSaver: false, performanceMode: false, reduceMotion: false };
  loops = [];
  appStateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
  removeListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    onAppState = listener;
    return { remove: removeListener };
  });
  jest.spyOn(Animated, 'loop').mockImplementation(() => {
    const loop = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    loops.push(loop);
    return loop;
  });
  getWelcomeArtwork.mockResolvedValue([]);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  jest.restoreAllMocks();
  if (appStateDescriptor) Object.defineProperty(AppState, 'currentState', appStateDescriptor);
  else delete AppState.currentState;
});

test('the wall stops every animation on blur and resumes when the welcome screen is focused again', async () => {
  await mount();
  const initialLoops = activeLoops();
  expect(initialLoops.length).toBeGreaterThan(0);
  mockFocused = false;
  await update();
  expect(initialLoops.every((loop) => loop.stop.mock.calls.length === 1)).toBe(true);
  expect(activeLoops()).toHaveLength(0);
  mockFocused = true;
  await update();
  expect(activeLoops()).toHaveLength(initialLoops.length);
});

test('backgrounding pauses all columns and foregrounding restarts them', async () => {
  await mount();
  const initialLoops = activeLoops();
  await act(async () => onAppState('background'));
  expect(activeLoops()).toHaveLength(0);
  await act(async () => onAppState('active'));
  expect(activeLoops()).toHaveLength(initialLoops.length);
});

test.each(['reduceMotion', 'performanceMode'])('%s disables both the moving wall and artwork crossfades', async (preference) => {
  await mount();
  expect(activeLoops().length).toBeGreaterThan(0);
  mockSettings = { ...mockSettings, [preference]: true };
  await update();
  expect(activeLoops()).toHaveLength(0);
  const images = root.root.findAllByType('Image');
  expect(images.length).toBeGreaterThan(0);
  expect(images.every((image) => !image.props.transition)).toBe(true);
});

test('an initially reduced-motion welcome screen never starts an animation', async () => {
  mockSettings.reduceMotion = true;
  await mount();
  expect(Animated.loop).not.toHaveBeenCalled();
});

test('blur cancels the artwork request and a late result cannot replace the visible covers', async () => {
  let finish;
  getWelcomeArtwork.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await mount();
  const signal = getWelcomeArtwork.mock.calls[0][0].signal;
  mockFocused = false;
  await update();
  expect(signal.aborted).toBe(true);
  await act(async () => finish(['https://images.example/late-cover.jpg']));
  expect(root.root.findAllByType('Image').some((image) => image.props.source?.uri === 'https://images.example/late-cover.jpg')).toBe(false);
  expect(getWelcomeArtwork).toHaveBeenCalledTimes(1);
});

test('unmount cancels loading, stops every animation, and removes the app-state listener', async () => {
  getWelcomeArtwork.mockReturnValue(new Promise(() => {}));
  await mount();
  const signal = getWelcomeArtwork.mock.calls[0][0].signal;
  const initialLoops = activeLoops();
  await act(async () => root.unmount());
  root = undefined;
  expect(signal.aborted).toBe(true);
  expect(initialLoops.every((loop) => loop.stop.mock.calls.length === 1)).toBe(true);
  expect(removeListener).toHaveBeenCalledTimes(1);
});

test('enabling data saver cancels the old request and asks for smaller covers', async () => {
  getWelcomeArtwork.mockReturnValue(new Promise(() => {}));
  await mount();
  const firstSignal = getWelcomeArtwork.mock.calls[0][0].signal;
  mockSettings = { ...mockSettings, dataSaver: true };
  await update();
  expect(firstSignal.aborted).toBe(true);
  expect(getWelcomeArtwork).toHaveBeenLastCalledWith({ dataSaver: true, signal: expect.any(AbortSignal) });
  expect(getWelcomeArtwork.mock.calls[1][0].signal.aborted).toBe(false);
});

test('an unfocused welcome screen neither loads covers nor starts animations', async () => {
  mockFocused = false;
  await mount();
  expect(getWelcomeArtwork).not.toHaveBeenCalled();
  expect(Animated.loop).not.toHaveBeenCalled();
});
