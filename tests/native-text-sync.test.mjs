import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NativeTextSync } from '../src/services/native-text-sync.ts';

test('delayed React echoes never overwrite newer native keystrokes', () => {
  const sync = new NativeTextSync('');
  sync.nativeChanged('l');
  sync.nativeChanged('li');
  sync.nativeChanged('lis');
  assert.equal(sync.shouldWriteProp(''), false);
  assert.equal(sync.shouldWriteProp('l'), false);
  assert.equal(sync.shouldWriteProp('lis'), false);
  assert.equal(sync.shouldWriteProp(''), true);
});

test('intentional external replacement reaches the native input', () => {
  const sync = new NativeTextSync('old');
  assert.equal(sync.shouldWriteProp('new'), true);
  assert.equal(sync.shouldWriteProp('new'), false);
});
