// Copyright (c) 2026 Luca Martinetti (MIT License)
// Modifications and additions (c) 2026 SCTG Development - Ronan Le Meillat (MIT License)
// See the LICENSE file in the project root.
//
// After `vite build`: add Subresource Integrity to every /static/ script and stylesheet,
// publish the WebAssembly hashes (checked at load time by wasm-client.js), and give the
// service worker its precache list and a content-derived cache name.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist', import.meta.url).pathname;
const sri = (file) => 'sha384-' + createHash('sha384').update(readFileSync(file)).digest('base64');
const fileOf = (url) => join(dist, url.replace(/^\/static\//, ''));

let html = readFileSync(join(dist, 'index.html'), 'utf8');

// <script ... src="/static/x"> and <link ... href="/static/x"> (scripts, styles, modulepreload)
html = html.replace(/<(script|link)\b([^>]*?)\b(src|href)="(\/static\/[^"]+)"([^>]*)>/g, (tag, name, pre, attr, url, post) => {
  if (/integrity=/.test(tag)) return tag;
  if (name === 'link' && !/rel="(stylesheet|modulepreload)"/.test(tag)) return tag;
  const f = fileOf(url);
  if (!existsSync(f)) return tag;
  const cors = /\bcrossorigin\b/.test(tag) ? '' : ' crossorigin="anonymous"';
  return `<${name}${pre}${attr}="${url}"${post} integrity="${sri(f)}"${cors}>`;
});

const wasmJs = join(dist, 'wasm/wormhole_wasm.js');
const wasmBg = join(dist, 'wasm/wormhole_wasm_bg.wasm');
if (existsSync(wasmJs) && existsSync(wasmBg)) {
  html = html.replace('</head>',
    `<link rel="modulepreload" href="/static/wasm/wormhole_wasm.js" integrity="${sri(wasmJs)}" crossorigin="anonymous">\n` +
    `<meta name="wasm-integrity" content="${sri(wasmBg)}">\n</head>`);
} else {
  console.warn('postbuild: dist/wasm is missing, no WebAssembly integrity published (run `make wasm` first)');
}
writeFileSync(join(dist, 'index.html'), html);

// Service worker: precache every built file, cache name derived from their content.
const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const assets = walk(dist)
  .map((p) => '/static/' + relative(dist, p).split('\\').join('/'))
  .filter((u) => !/\.(map|d\.ts)$|\/sw\.js$|\/index\.html$|\/wasm\/.*\.d\.ts$/.test(u))
  .sort();
const hash = createHash('sha256');
for (const u of assets) hash.update(readFileSync(fileOf(u)));
hash.update(html);
const build = hash.digest('base64url').slice(0, 10);
const swPath = join(dist, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace(/\/\*PRECACHE\*\/\s*\[[^\]]*\]/, JSON.stringify(['/', ...assets]));
sw = sw.replace('BUILD_HASH', build);
writeFileSync(swPath, sw);
console.log(`postbuild: ${assets.length} assets, cache wormhole-${build}`);
