import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import compatibility from '../scripts/lib/dependency-compat.cjs';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));

function bounded(code) {
  const result = spawnSync(process.execPath, ['-e', code], { cwd: root, timeout: 5000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
}

test('patched decoder preserves Router query API and repeated installation', () => {
  compatibility.patchDependencyCompatibility(root);
  compatibility.patchDependencyCompatibility(root);
  const query = require('query-string');
  const params = { artist: 'Björk & Friends', q: '♫', tag: ['bass', 'ambient'] };
  assert.deepEqual({ ...query.parse(query.stringify(params)) }, params);
  assert.equal(query.parse('q=Crimson+Music').q, 'Crimson Music');
  assert.equal(query.parse('q=%E2%99%AB%FF').q, '♫%FF');
});

test('malformed percent sequences and separate runs finish within a bounded process', () => {
  bounded(`const assert = require('node:assert/strict');
    const q = require('query-string');
    const malformed = '%C0%AF'.repeat(20000);
    assert.equal(q.parse('q=' + malformed).q, malformed);
    const runs = '%FFx'.repeat(20000);
    assert.equal(q.parse('q=' + runs).q, runs);`);
});

test('Metro reads real app artwork through the upgraded image-size API', () => {
  const metroRequire = createRequire(require.resolve('metro/package.json'));
  const { getAssetSize } = metroRequire('./src/Assets.js');
  const bytes = readFileSync(new URL('../assets/images/icon.png', import.meta.url));
  assert.deepEqual(getAssetSize('png', bytes, 'icon.png'), { width: 1024, height: 1024 });
});

test('malformed ICNS and JXL boxes cannot trap the asset parser', () => {
  bounded(`const assert = require('node:assert/strict');
    const { imageSize } = require('image-size');
    const icns = Buffer.alloc(16); icns.write('icns'); icns.writeUInt32BE(16, 4); icns.write('ic07', 8);
    assert.throws(() => imageSize(icns));
    const jxl = Buffer.alloc(32); jxl.write('JXL ', 4);
    assert.throws(() => imageSize(jxl));`);
});

test('shell quoting rejects line terminators after comments', () => {
  const { quote } = require('shell-quote');
  for (const separator of ['\n', '\r', '\u2028', '\u2029']) {
    assert.throws(() => quote([{ comment: 'comment' }, separator + 'echo unsafe']), TypeError);
  }
});

test('upgraded glob matching preserves exclusions and brace alternatives', () => {
  const { minimatch } = require('minimatch');
  assert.equal(minimatch('src/app/player.tsx', 'src/**/*.{ts,tsx}', { optimizationLevel: 2 }), true);
  assert.equal(minimatch('node_modules/a/index.js', 'src/**/*.{ts,tsx}', { optimizationLevel: 2 }), false);
});
