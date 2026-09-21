import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Modal, Platform, ScrollView, Switch, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import AdvancedSearchFilterControls from '../src/components/advanced-search-filters';
import SearchFilterBar from '../src/components/search-filter-bar';
import GlassPressable from '../src/components/glass-pressable';
import SearchFiltersScreen from '../src/app/search-filters';
import { getPopupSession } from '../src/services/popup-sessions';
import { assertNativeSheetLayout } from './helpers/assert-native-sheet-layout';

let mockParams = {};
let mockUid = 'listener';
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, Redirect: 'Redirect' }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: mockUid } }) }));
jest.mock('../src/components/responsive-popup', () => 'ResponsivePopup');

jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#FFF', secondaryText: '#AAA', accent: '#F26', background: '#111', controlSurface: '#222', border: '#333' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34 }) }));

let root;
let sheet;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mockUid = 'listener'; mockParams = {}; });
afterEach(async () => { if (root) await act(async () => root.unmount()); if (sheet) await act(async () => sheet.unmount()); root = undefined; sheet = undefined; Platform.OS = 'ios'; });
const byLabel = (label) => (sheet || root).root.findByProps({ accessibilityLabel: label });
const click = async (button) => act(async () => button.props.onPress());
const openSheet = async () => {
  await click(byLabel('Advanced song filters'));
  const href = mockRouter.push.mock.calls.at(-1)[0];
  expect(href.pathname).toBe('/search-filters');
  expect(Object.keys(href.params)).toEqual(['session']);
  mockParams = href.params;
  await act(async () => { sheet = create(<SearchFiltersScreen />); });
  expect(sheet.root.findAllByType(Modal)).toHaveLength(0);
};

test.each(['ios', 'android', 'web'])('%s shows Filters first in the existing result row only after a search begins', async (platform) => {
  Platform.OS = platform;
  const onSelect = jest.fn();
  const props = { selected: 'all', advancedFilters: {}, onSelect, onAdvancedChange: jest.fn() };
  await act(async () => { root = create(<SearchFilterBar {...props} visible={false} />); });
  expect(root.toJSON()).toBeNull();
  await act(async () => root.update(<SearchFilterBar {...props} visible />));
  const row = root.root.findByType(ScrollView);
  expect(row.props.horizontal).toBe(true);
  expect(row.findAllByType(GlassPressable).map((pill) => pill.props.accessibilityLabel)).toEqual([
    'Advanced song filters', 'Show All results', 'Show Songs results', 'Show Artists results', 'Show Playlists results', 'Show Events results',
  ]);
  expect(row.findAllByType(GlassPressable)[0].findAllByType('Symbol').map((icon) => icon.props.name)).toEqual(['slider.horizontal.3', 'chevron.down']);
  await click(byLabel('Show Artists results'));
  expect(onSelect).toHaveBeenCalledWith('artists');
  await act(async () => root.update(<SearchFilterBar {...props} visible={false} />));
  expect(root.toJSON()).toBeNull();
});

test.each(['ios', 'android', 'web'])('%s keeps advanced controls collapsed and only applies a complete tempo range on Show songs', async (platform) => {
  Platform.OS = platform;
  const onChange = jest.fn();
  await act(async () => { root = create(<AdvancedSearchFilterControls value={{}} onChange={onChange} />); });
  expect(root.root.findAllByType(TextInput)).toHaveLength(0);
  await openSheet();
  await act(async () => byLabel('Minimum BPM').props.onChangeText('110'));
  await act(async () => byLabel('Maximum BPM').props.onChangeText('130'));
  await act(async () => sheet.root.findByType(Switch).props.onValueChange(true));
  expect(onChange).not.toHaveBeenCalled();
  await click(byLabel('Apply song filters'));
  expect(onChange).toHaveBeenCalledWith({ bpmMin: 110, bpmMax: 130, downloadableOnly: true });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  await act(async () => sheet.unmount()); sheet = undefined;
  expect(getPopupSession(mockParams.session, mockUid, 'search-filters')).toBeUndefined();
});

test('an inverted BPM range stays open with an error and never sends a search', async () => {
  const onChange = jest.fn();
  await act(async () => { root = create(<AdvancedSearchFilterControls value={{ genre: 'House' }} onChange={onChange} />); });
  await openSheet();
  await act(async () => byLabel('Minimum BPM').props.onChangeText('180'));
  await act(async () => byLabel('Maximum BPM').props.onChangeText('90'));
  await click(byLabel('Apply song filters'));
  expect(onChange).not.toHaveBeenCalled();
  expect(sheet.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain('Minimum BPM');
  expect(sheet.root.findAllByType(TextInput)).toHaveLength(2);
});

test('clearing applied filters resets the draft values and closes the sheet', async () => {
  const onChange = jest.fn();
  await act(async () => { root = create(<AdvancedSearchFilterControls value={{ genre: 'House', bpmMin: 110, bpmMax: 130 }} onChange={onChange} />); });
  await openSheet();
  await click(byLabel('Clear song filters'));
  expect(onChange).toHaveBeenCalledWith({});
  expect(byLabel('Minimum BPM').props.value).toBe('');
  expect(byLabel('Maximum BPM').props.value).toBe('');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('Clear closes even when removing the last filter unmounts its source row', async () => {
  const onChange = jest.fn();
  function SearchOwner() {
    const [filters, setFilters] = React.useState({ genre: 'House' });
    return <SearchFilterBar visible={Object.keys(filters).length > 0} selected="songs" advancedFilters={filters} onSelect={() => undefined} onAdvancedChange={(next) => { onChange(next); setFilters(next); }} />;
  }
  await act(async () => { root = create(<SearchOwner />); });
  await openSheet();
  await click(byLabel('Clear song filters'));
  expect(root.toJSON()).toBeNull();
  expect(onChange).toHaveBeenCalledWith({});
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(getPopupSession(mockParams.session, mockUid, 'search-filters')).toBeUndefined();
  await act(async () => sheet.unmount()); sheet = undefined;
});

test('iOS filter controls and each picker keep their heading inside the sole scrolling root', async () => {
  await act(async () => { root = create(<AdvancedSearchFilterControls value={{}} onChange={jest.fn()} />); });
  await openSheet();
  assertNativeSheetLayout(sheet.root);
  for (const field of ['genre', 'mood', 'musical key']) {
    await click(byLabel(`Choose ${field}`));
    assertNativeSheetLayout(sheet.root, { list: true });
    await click(byLabel('Back to song filters'));
    assertNativeSheetLayout(sheet.root);
  }
});


test('repeated taps launch one sheet, native dismissal resets the trigger, and account changes revoke callbacks', async () => {
  const onChange = jest.fn();
  const props = { value: {}, onChange };
  await act(async () => { root = create(<AdvancedSearchFilterControls {...props} />); });
  await openSheet();
  await click(root.root.findByProps({ accessibilityLabel: 'Advanced song filters' }));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  await act(async () => sheet.unmount()); sheet = undefined;
  expect(getPopupSession(mockParams.session, mockUid, 'search-filters')).toBeUndefined();
  await openSheet();
  expect(mockRouter.push).toHaveBeenCalledTimes(2);
  const previous = mockParams.session;
  mockUid = 'another-listener';
  await act(async () => root.update(<AdvancedSearchFilterControls {...props} />));
  expect(getPopupSession(previous, 'listener', 'search-filters')).toBeUndefined();
  await click(byLabel('Apply song filters'));
  expect(onChange).not.toHaveBeenCalled();
  expect(root.root.findByType(GlassPressable).props.tintColor).toBe('#222');
});
