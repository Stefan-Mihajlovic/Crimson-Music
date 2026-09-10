import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const { expo: config } = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('native configuration supports the Audius callback without backend provisioning', () => {
  assert.equal(config.scheme, 'crimsonmusic');
  assert.equal(config.ios.googleServicesFile, undefined);
  assert.equal(config.android.googleServicesFile, undefined);
  assert.equal(config.ios.entitlements?.['com.apple.developer.devicecheck.appattest-environment'], undefined);
  const plugins = config.plugins.map((entry) => Array.isArray(entry) ? entry[0] : entry);
  assert.ok(plugins.includes('expo-secure-store'));
  assert.ok(plugins.includes('expo-web-browser'));
  assert.ok(plugins.every((name) => !/firebase|app-check/i.test(name)));
});

test('application dependencies and scripts do not include Firebase services or deployment', () => {
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  assert.ok(Object.keys(dependencies).every((name) => !/firebase/i.test(name)));
  assert.ok(Object.values(manifest.scripts).every((command) => !/firebase|--prefix functions/.test(command)));
});
