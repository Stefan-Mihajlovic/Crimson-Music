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

test('desktop search reserves its controls before focus and clears without changing the field structure', async () => {
  await act(async () => root.render(<Search stableLayout />));
  const input = container.querySelector('input');
  const cancel = container.querySelector('[aria-label="Cancel search"]');
  expect(cancel).not.toBeNull();
  expect(cancel.disabled).toBe(true);
  const cancelSlot = cancel.parentElement;
  expect(cancelSlot.getAttribute('aria-hidden')).toBe('true');
  expect(getComputedStyle(cancelSlot).opacity).toBe('0');
  // A shell-wide disabled-button opacity must not reveal the hidden slot.
  cancel.style.opacity = '0.35';
  expect(getComputedStyle(cancelSlot).opacity).toBe('0');
  const originalParent = input.parentElement;
  const originalButtons = container.querySelectorAll('button').length;
  act(() => input.focus());
  expect(cancel.disabled).toBe(false);
  expect(cancelSlot.getAttribute('aria-hidden')).not.toBe('true');
  expect(getComputedStyle(cancelSlot).opacity).not.toBe('0');
  expect(mockFocusChange).toHaveBeenLastCalledWith(true);
  expect(container.querySelectorAll('button')).toHaveLength(originalButtons);
  expect(input.parentElement).toBe(originalParent);
  act(() => cancel.click());
  expect(mockStopVoice).toHaveBeenCalledTimes(1);
  expect(mockFocusChange).toHaveBeenLastCalledWith(false);
  expect(cancel.disabled).toBe(true);
  expect(getComputedStyle(cancelSlot).opacity).toBe('0');
  expect(cancelSlot.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('[aria-label="Cancel search"]')).toBe(cancel);
  expect(container.querySelectorAll('button')).toHaveLength(originalButtons);
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
