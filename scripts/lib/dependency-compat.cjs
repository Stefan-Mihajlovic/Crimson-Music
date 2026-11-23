const fs = require('node:fs');
const path = require('node:path');

// query-string 7 is part of Expo Router 57's API contract. The patched decoder
// is ESM-only; select its default export in both Node 24 and Metro, without
// changing URL parsing/stringifying behavior or copying security-sensitive code.
function patchDependencyCompatibility(projectRoot) {
  const packagePath = require.resolve('query-string/package.json', { paths: [projectRoot] });
  const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (metadata.version !== '7.1.3') {
    throw new Error(`Review query-string security compatibility for ${metadata.version}`);
  }
  const file = path.join(path.dirname(packagePath), 'index.js');
  const before = "const decodeComponent = require('decode-uri-component');";
  const after = "const decodeComponent = require('decode-uri-component').default;";
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error('query-string decoder import was not found');
  fs.writeFileSync(file, source.replace(before, after));
}

module.exports = { patchDependencyCompatibility };
