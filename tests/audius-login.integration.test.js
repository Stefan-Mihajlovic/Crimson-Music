import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import WelcomeScreen from '../src/app/welcome';
import NativeButton from '../src/components/native-button';
import { useAuth } from '../src/providers/auth-provider';
import { CrimsonAuthError } from '../src/services/auth';

jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('../src/components/auth-backdrop', () => ({ children }) => children);
jest.mock('../src/components/brand-logo', () => () => null);
jest.mock('../src/components/native-button', () => jest.fn(() => null));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#F3EEFF' } }) }));
jest.mock('../src/services/auth', () => ({
  CrimsonAuthError: class CrimsonAuthError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  },
}));

let root;
let signInWithAudius;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  signInWithAudius = jest.fn();
  useAuth.mockReturnValue({ user: null, signInWithAudius });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const button = () => root.root.findByType(NativeButton);
const messages = () => root.root.findAllByType(Text).map((node) => node.props.children).flat();

test('the only login action opens one Audius session even when pressed twice', async () => {
  let finish;
  signInWithAudius.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await act(async () => { root = create(React.createElement(WelcomeScreen)); });
  expect(root.root.findAllByType(NativeButton)).toHaveLength(1);
  expect(button().props.label).toBe('Login with Audius');
  await act(async () => { button().props.onPress(); button().props.onPress(); });
  expect(signInWithAudius).toHaveBeenCalledTimes(1);
  expect(button().props.disabled).toBe(true);
  expect(button().props.icon.props.color).toBe('#F3EEFF');
  await act(async () => finish({ uid: 'audius-user' }));
  expect(button().props.disabled).toBe(false);
});

test('canceling Audius login restores the same button without an error', async () => {
  signInWithAudius.mockRejectedValueOnce(new CrimsonAuthError('Login cancelled', 'cancelled'));
  await act(async () => { root = create(React.createElement(WelcomeScreen)); });
  await act(async () => button().props.onPress());
  expect(button().props.label).toBe('Login with Audius');
  expect(button().props.disabled).toBe(false);
  expect(messages()).not.toContain('Login cancelled');
});

test('Audius login failure is visible and the user can retry', async () => {
  signInWithAudius.mockRejectedValueOnce(new CrimsonAuthError('Audius could not be reached', 'network'));
  await act(async () => { root = create(React.createElement(WelcomeScreen)); });
  await act(async () => button().props.onPress());
  expect(messages()).toContain('Audius could not be reached');
  expect(button().props.disabled).toBe(false);
  signInWithAudius.mockResolvedValueOnce({ uid: 'audius-user' });
  await act(async () => button().props.onPress());
  expect(signInWithAudius).toHaveBeenCalledTimes(2);
  expect(messages()).not.toContain('Audius could not be reached');
});
