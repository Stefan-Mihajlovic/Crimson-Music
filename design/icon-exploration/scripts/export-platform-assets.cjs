#!/usr/bin/env node
/* Stage platform assets for every candidate. Never edits production assets/config. */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const projectRoot = path.resolve(root, '../..');
const toolsRoot = process.env.CRIMSON_ICON_TOOLS || path.join(projectRoot, '.build/icon-tools');
const { Resvg } = createRequire(path.join(toolsRoot, 'package.json'))('@resvg/resvg-js');

function svg(body, width = 1024, height = width) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}
function render(source, width) {
  return new Resvg(source, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render();
}
function bounds(rendered) {
  const { pixels, width, height } = rendered;
  let minX = width, minY = height, maxX = -1, maxY = -1, radius = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] < 5) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    radius = Math.max(radius, Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2));
  }
  return { minX, minY, maxX, maxY, radius };
}
function mix(hex, other, fraction) {
  const channel = (color, offset) => parseInt(color.slice(offset, offset + 2), 16);
  return '#' + [1, 3, 5].map(i => Math.round(channel(hex, i) * (1 - fraction) + channel(other, i) * fraction).toString(16).padStart(2, '0')).join('');
}

for (const slug of fs.readdirSync(path.join(root, 'candidates')).sort()) {
  const directory = path.join(root, 'candidates', slug);
  const documentName = fs.readdirSync(directory).find(name => name.endsWith('.icon'));
  if (!documentName) continue;
  const document = path.join(directory, documentName);
  const config = JSON.parse(fs.readFileSync(path.join(document, 'icon.json'), 'utf8'));
  // Composer layers are front-to-back; SVG elements are back-to-front.
  const body = [...config.groups].reverse().flatMap(group => [...group.layers].reverse().map(layer => {
    const raw = fs.readFileSync(path.join(document, 'Assets', layer['image-name']), 'utf8');
    return raw.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '');
  })).join('');
  const components = config.fill['automatic-gradient'].split(':')[1].split(',').slice(0, 3);
  const backgroundColor = '#' + components.map(n => Math.round(Number(n) * 255).toString(16).padStart(2, '0')).join('');
  const gradient = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1"><stop stop-color="${mix(backgroundColor, '#965CFF', 0.18)}"/><stop offset="1" stop-color="${mix(backgroundColor, '#0E0D13', 0.23)}"/></linearGradient></defs>`;
  const background = `${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>`;
  const originalBounds = bounds(render(svg(body), 1024));
  // Entire alpha silhouette fits inside Android's central 66dp circle on a108dp canvas.
  // An8px margin also covers antialiasing at the edge of the safe zone.
  const safeRadius = 1024 * 33 / 108;
  const scale = Math.min(1, (safeRadius - 8) / originalBounds.radius);
  const transform = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  const foreground = svg(`<g transform="${transform}">${body}</g>`);
  const monochrome = svg(`<g transform="${transform}">${body.replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"')}</g>`);
  const output = path.join(directory, 'platform-assets');
  fs.mkdirSync(output, { recursive: true });
  const sources = {
    'icon': svg(background + body),
    'android-background': svg(background),
    'android-foreground': foreground,
    'android-monochrome': monochrome,
    'mark': svg(body),
  };
  for (const [name, source] of Object.entries(sources)) {
    fs.writeFileSync(path.join(output, `${name}.svg`), source + '\n');
    fs.writeFileSync(path.join(output, `${name}.png`), render(source, 1024).asPng());
  }
  const favicon = svg(`${gradient}<rect width="1024" height="1024" rx="220" fill="url(#bg)"/>${body}`);
  fs.writeFileSync(path.join(output, 'favicon.png'), render(favicon, 48).asPng());
  const nativeImage = fs.readFileSync(path.join(directory, 'previews/default.png')).toString('base64');
  const wordmark = svg(`<defs><linearGradient id="word" x1="0" x2="1"><stop stop-color="#E5D4FF"/><stop offset="1" stop-color="#965CFF"/></linearGradient></defs><image href="data:image/png;base64,${nativeImage}" x="0" y="0" width="300" height="300"/><text x="352" y="151" fill="#F3EEFF" font-family="Helvetica Neue" font-size="164" font-weight="500">CRIMSON</text><text x="352" y="287" fill="url(#word)" font-family="Helvetica Neue" font-size="121" font-weight="500">MUSIC</text>`, 1146, 300);
  fs.writeFileSync(path.join(output, 'wordmark.png'), render(wordmark, 1146).asPng());
  const finalBounds = bounds(render(foreground, 1024));
  if (finalBounds.radius > safeRadius) throw new Error(`${slug}: foreground outside Android safe zone`);
  const manifest = {
    candidate: slug, source: `../${documentName}`, stagedOnly: true, backgroundColor,
    android: { canvasDp: 108, safeDiameterDp: 66, scale, alphaBounds: finalBounds },
    assets: { icon: 'icon.png', foreground: 'android-foreground.png', background: 'android-background.png', monochrome: 'android-monochrome.png', splash: 'mark.png', favicon: 'favicon.png', wordmark: 'wordmark.png' },
    note: 'Portable SVG/PNG assets use the same vector geometry. iOS adds native Composer materials. Convert selected wordmark.png to WebP at integration.'
  };
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${slug}: platform assets staged; alpha radius ${finalBounds.radius.toFixed(1)} / ${safeRadius.toFixed(1)} px`);
}
