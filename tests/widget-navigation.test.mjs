import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { requestWidgetPlayerPresentation, subscribeToWidgetPlayerPresentation, widgetNavigationState } from '../src/services/widget-navigation.ts';

const require = createRequire(import.meta.url);
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
const { TabRouter } = require('expo-router/build/react-navigation/routers/TabRouter');
const rootOptions = { routeNames: ['(app)', 'widget', 'player', 'favorites'], routeParamList: {}, routeGetIdList: {} };
const tabOptions = { routeNames: ['(home)', '(search)', '(library)', '(account)'], routeParamList: {}, routeGetIdList: {} };
const rootRouter = StackRouter({ initialRouteName: '(app)' });
const tabRouter = TabRouter({ initialRouteName: '(home)' });

function stateWithTabs() {
  const root = rootRouter.getInitialState(rootOptions);
  const tabs = tabRouter.getInitialState(tabOptions);
  const home = StackRouter({ initialRouteName: 'index' }).getInitialState({ routeNames: ['index', 'artist', 'mix', 'history'], routeParamList: {} });
  const library = StackRouter({ initialRouteName: 'library' }).getInitialState({ routeNames: ['library', 'favorites', 'local-music'], routeParamList: {} });
  tabs.routes[0].state = home;
  tabs.routes[2].state = library;
  root.routes[0].state = tabs;
  return root;
}

test('the real stack router removes every legacy player and retains the existing tab host and navigator keys', () => {
  let state = stateWithTabs();
  const app = state.routes[0];
  const originalKey = state.key;
  state.routes.push({ name: 'player', key: 'old-1' }, { name: 'player', key: 'old-2' }, { name: 'widget', key: 'incoming' });
  state.index = 3;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    state = rootRouter.getStateForAction(state, { type: 'RESET', payload: widgetNavigationState(state) }, rootOptions);
    assert.ok(state);
    assert.equal(state.key, originalKey);
    assert.equal(state.index, 0);
    assert.deepEqual(state.routes, [app]);
    assert.equal(state.routes[0], app);
    state = { ...state, index: 1, routes: [...state.routes, { name: 'widget', key: `widget-${attempt}` }] };
  }
});

test('collection shortcuts reuse their route, trim duplicates, and preserve unrelated tab histories', () => {
  let state = stateWithTabs();
  const tabs = state.routes[0].state;
  const originalHome = tabs.routes[0];
  const originalLibraryKey = tabs.routes[2].key;
  const stack = tabs.routes[2].state;
  stack.routes.push({ name: 'favorites', key: 'original-favorites' }, { name: 'favorites', key: 'duplicate-favorites' });
  stack.index = 2;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    state = widgetNavigationState(state, { group: '(library)', screen: 'favorites' });
    const nextTabs = state.routes[0].state;
    assert.equal(nextTabs.index, 2);
    assert.equal(nextTabs.routes[0], originalHome);
    assert.equal(nextTabs.routes[2].key, originalLibraryKey);
    assert.deepEqual(nextTabs.routes[2].state.routes.map((route) => route.name), ['library', 'favorites']);
    assert.equal(nextTabs.routes[2].state.routes[1].key, 'original-favorites');
  }
  state = widgetNavigationState(state, { group: '(library)', screen: 'local-music' });
  state = widgetNavigationState(state, { group: '(library)', screen: 'library' });
  assert.deepEqual(state.routes[0].state.routes[2].state.routes.map((route) => route.name), ['library']);
});

test('cold mix navigation rehydrates into the right tab with a back destination', () => {
  const cold = { ...rootRouter.getInitialState(rootOptions), routes: [{ name: 'widget', key: 'cold-widget' }] };
  const reset = rootRouter.getStateForAction(cold, { type: 'RESET', payload: widgetNavigationState(cold, { group: '(home)', screen: 'mix', params: { id: 'weekly', play: '1', playRequest: 'first' } }) }, rootOptions);
  const tabs = tabRouter.getRehydratedState(reset.routes[0].state, tabOptions);
  assert.equal(tabs.routes[tabs.index].name, '(home)');
  const stackRouter = StackRouter({ initialRouteName: 'index' });
  const stack = stackRouter.getRehydratedState(tabs.routes[0].state, { routeNames: ['index', 'mix', 'history'], routeParamList: {} });
  assert.deepEqual(stack.routes.map((route) => route.name), ['index', 'mix']);
  assert.equal(stack.routes[stack.index].params.playRequest, 'first');
});

test('the shared player handles warm requests and retains the latest cold request until the tab host mounts', () => {
  requestWidgetPlayerPresentation(true);
  requestWidgetPlayerPresentation(false);
  const received = [];
  const unsubscribe = subscribeToWidgetPlayerPresentation((expanded) => received.push(expanded));
  assert.deepEqual(received, [false]);
  requestWidgetPlayerPresentation(true);
  requestWidgetPlayerPresentation(true);
  assert.deepEqual(received, [false, true, true]);
  unsubscribe();
  requestWidgetPlayerPresentation(true);
  const next = [];
  const remove = subscribeToWidgetPlayerPresentation((expanded) => next.push(expanded));
  assert.deepEqual(next, [true]);
  remove();
});
