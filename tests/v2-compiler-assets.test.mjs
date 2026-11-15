// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {randomBytes} from 'node:crypto';
import {cacheCompilerAssets, compilerAssets, publishCompilerAssets} from '../scripts/v2-compiler-assets.mjs';

const bodies = new Map(['Compiler.js', 'Compiler.wasm', 'Compiler.data'].map(name => [name, Buffer.from(`pinned ${name}`)]));
const specs = [...bodies].map(([name, body]) => ({url: `https://example.test/compiler/${name}`, sha256: createHash('sha256').update(body).digest('hex')}));
const html = assets => `<script>const lab = ${JSON.stringify({assets: {compiler: assets}})};\n`;

test('compiler build assets are verified, reused without network and repaired after corruption', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gpu-v2-compiler-'));
  const requests = [];
  const fetcher = async url => {
    const name = new URL(url).pathname.split('/').at(-1);
    requests.push(name);
    return new Response(bodies.get(name));
  };
  try {
    const files = await cacheCompilerAssets(html(specs), {directory, fetcher});
    assert.deepEqual(requests, [...bodies.keys()]);
    for (const file of files) assert.deepEqual(await readFile(file.path), bodies.get(file.name));
    requests.length = 0;
    await cacheCompilerAssets(html(specs), {directory, fetcher});
    assert.deepEqual(requests, [], 'A cached build must not download the compiler again');
    await writeFile(join(directory, 'Compiler.wasm'), 'corrupt bytes');
    await cacheCompilerAssets(html(specs), {directory, fetcher});
    assert.deepEqual(requests, ['Compiler.wasm']);
    assert.deepEqual(await readFile(join(directory, 'Compiler.wasm')), bodies.get('Compiler.wasm'));
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('compiler download failures and wrong hashes cannot become published build inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gpu-v2-compiler-'));
  try {
    await assert.rejects(cacheCompilerAssets(html(specs), {directory, fetcher: async () => new Response('error', {status: 503})}), /HTTP 503/);
    await assert.rejects(readFile(join(directory, 'Compiler.js')), {code: 'ENOENT'});
    await assert.rejects(cacheCompilerAssets(html(specs), {directory, fetcher: async () => new Response('wrong content')}), /integrity check failed/);
    await assert.rejects(readFile(join(directory, 'Compiler.js')), {code: 'ENOENT'});
    assert.throws(() => compilerAssets(html(specs.slice(1))), /inventory changed/);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('published compiler parts are bounded and reconstruct the exact verified inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gpu-v2-parts-'));
  try {
    const bytes = randomBytes(1900000);
    const path = join(directory, 'Compiler.wasm');
    await writeFile(path, bytes);
    const [parts] = await publishCompilerAssets([{name: 'Compiler.wasm', path}], join(directory, 'published'));
    assert.equal(parts.length, 3);
    const bodies = await Promise.all(parts.map(part => readFile(join(directory, 'published', part))));
    assert.ok(bodies.every(body => body.length > 0 && body.length <= 900000));
    assert.deepEqual(gunzipSync(Buffer.concat(bodies)), bytes);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
