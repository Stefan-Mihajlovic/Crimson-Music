import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LiquidSearchField from '../../src/components/liquid-search-field';

const mockStopVoice = jest.fn();
const mockFocusChange = jest.fn();
jest.mock('../../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('../../src/hooks/use-voice-search', () => ({ useVoiceSearch: () => ({ listening: false, toggle: () => undefined, stop: mockStopVoice }) }));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#fff', mutedText: '#aaa', controlSurface: '#222', border: '#333' } }) }));

let root;
let container;
function Search({ stableLayout }) {
  const [value, setValue] = useState('');
  return <LiquidSearchField placeholder="Search library" value={value} onChangeText={setValue} onFocusChange={mockFocusChange} stableLayout={stableLayout} />;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('desktop search clears inside the field and leaves no external cancel slot', async () => {
  await act(async () => root.render(<Search stableLayout />));
  const input = container.querySelector('input');
  const field = input.parentElement;
  expect(field.parentElement.children).toHaveLength(1);
  expect(container.querySelector('[aria-label="Cancel search"]')).toBeNull();
  act(() => input.focus());
  expect(container.querySelector('[aria-label="Clear library search"]')).toBeNull();
  expect(mockFocusChange).toHaveBeenLastCalledWith(true);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'ZYRA');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const clear = container.querySelector('[aria-label="Clear library search"]');
  expect(clear.parentElement).toBe(field);
  act(() => clear.click());
  expect(input.value).toBe('');
  expect(document.activeElement).toBe(input);
  expect(mockStopVoice).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[aria-label="Clear library search"]')).toBeNull();
  expect(field.parentElement.children).toHaveLength(1);
});

test('mobile search still reveals and dismisses its cancel control on focus', async () => {
  await act(async () => root.render(<Search />));
  const input = container.querySelector('input');
  expect(container.querySelector('[aria-label="Cancel search"]')).toBeNull();
  act(() => input.focus());
  expect(container.querySelector('[aria-label="Cancel search"]')).not.toBeNull();
  act(() => input.blur());
  expect(container.querySelector('[aria-label="Cancel search"]')).toBeNull();
});
