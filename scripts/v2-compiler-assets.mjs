// Copyright © 2026 Christopher Snow.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const names = ['Compiler.js', 'Compiler.wasm', 'Compiler.data'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function compilerAssets(html) {
  const line = html.split('\n').find(line => line.startsWith('<script>const lab = '));
  if (!line) throw new Error('The V2 compiler asset metadata is missing.');
  const assets = JSON.parse(line.slice('<script>const lab = '.length).replace(/;$/, '')).assets?.compiler;
  if (!Array.isArray(assets) || assets.length !== names.length) throw new Error('The V2 compiler asset inventory changed.');
  return assets.map((asset, index) => {
    const url = new URL(asset.url);
    const name = url.pathname.split('/').at(-1);
    if (url.protocol !== 'https:' || name !== names[index] || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new Error('The V2 compiler needs named, pinned HTTPS assets.');
    }
    return {...asset, name};
  });
}

export async function cacheCompilerAssets(html, {directory = 'vendor/v2-compiler', fetcher = fetch} = {}) {
  const assets = compilerAssets(html);
  await mkdir(directory, {recursive: true});
  for (const asset of assets) {
    const path = join(directory, asset.name);
    let bytes;
    try { bytes = await readFile(path); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!bytes || hash(bytes) !== asset.sha256) {
      console.log(`Downloading pinned V2 compiler asset: ${asset.name}`);
      const response = await fetcher(asset.url, {signal: AbortSignal.timeout(120000)});
      if (!response.ok) throw new Error(`Compiler download failed: ${asset.name} (HTTP ${response.status}).`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (hash(bytes) !== asset.sha256) throw new Error(`Compiler integrity check failed: ${asset.name}.`);
      await writeFile(path, bytes);
    }
    asset.path = path;
  }
  return assets;
}
