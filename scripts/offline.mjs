// Copyright © 2026 Christopher Snow.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { installMarkup } from './install.mjs';
import { validateRelease } from '../src/release-contract.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');
async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesUnder(`${directory}/${entry.name}`, `${path}/`));
    else files.push(path);
  }
  return files.sort();
}
const markup = `<div class="app-status-controls">
<button id="app-status-open" type="button" aria-haspopup="dialog">Save offline</button>
<button id="app-status-summary" type="button" aria-haspopup="dialog" hidden></button>
</div>`;
const panel = `<dialog id="app-status-dialog" aria-labelledby="app-status-title">
<div class="status-heading"><h2 id="app-status-title">App status</h2><button id="app-status-close" type="button" autofocus>Close</button></div>
<section aria-labelledby="version-title"><h3 id="version-title" tabindex="-1">Version</h3><p id="running-version"></p>
<p id="version-status" role="status">Checking for updates</p><p id="version-detail"></p>
<div class="status-actions"><button id="check-update" type="button">Check for updates</button><button id="download-update" type="button" hidden>Update</button><button id="restart-update" type="button" hidden>Restart to update</button><button id="later-update" type="button" hidden>Later</button></div>
<div id="update-download-feedback"></div>
<p id="restart-note" hidden>Restart reloads all open GPU Lab tabs and app windows. Their routes, experiment inputs and results are restored. A window that is busy or cannot save its work will block the restart.</p></section>
<section aria-labelledby="offline-title"><h3 id="offline-title" tabindex="-1">Offline access</h3><p id="offline-status" role="status">Not saved for offline use</p>
<p id="offline-size"></p><p>Downloads and updates include all lessons, recordings, browser simulators, the CUDA compiler, diagrams and example files for offline use. Desktop execution needs separate PyTorch or CUDA/GPGPU-Sim tools; their installations are not part of this offline download. External links need internet access.</p>
<div class="status-actions"><button id="save-offline" type="button">Download for offline use</button><button id="remove-offline" type="button" hidden>Remove offline copy</button></div>
<div id="offline-download-feedback"><div id="download-progress" hidden><label for="asset-progress">Verified download progress</label><progress id="asset-progress"></progress><p id="progress-text" role="status"></p><button id="cancel-download" type="button">Cancel download</button></div></div>
<div id="remove-confirmation" hidden><p>Remove GPU Lab’s downloaded files from this browser? Your experiment work, preferences and other apps will be kept.</p><button id="confirm-remove" type="button">Remove downloaded files</button><button id="cancel-remove" type="button">Keep offline copy</button></div></section>
<p id="app-status-error" role="status"></p>
</dialog>
<div id="update-announcement" class="update-announcement" role="status"></div>
<div id="update-toast" class="update-toast" role="group" aria-labelledby="update-toast-message" hidden>
<p id="update-toast-message">A new version of GPU Lab is available.</p>
<div class="status-actions"><button id="review-update" type="button" aria-haspopup="dialog">Review update</button><button id="dismiss-update" type="button">Later</button></div>
</div>`;
export async function buildOffline(directory, identity = { commit: null, date: null }) {
  const files = (await filesUnder(directory)).filter(path => path !== 'sw.js' && path !== 'release.json' && !path.startsWith('releases/'));
  for (const path of files.filter(path => path.endsWith('.html'))) {
    const base = '../'.repeat(path.split('/').length - 1) || './';
    let html = installMarkup(await readFile(`${directory}/${path}`, 'utf8'), base)
      .replace('<div class="top-actions">', `<div class="top-actions">${markup}`)
      .replace('</body>', `${panel}</body>`)
      .replace('</head>', `<meta name="gpu-base" content="${base}"><meta name="gpu-release" content="__BUILD_ID__"><script type="module" src="${base}src/offline.mjs"></script></head>`);
    // Pin executable assets to this release even before a worker controls the page.
    html = html.replace(/((?:src|href|poster)=")(\.\/|\.\.\/)?(src\/|assets\/)/g, `$1${base}releases/__BUILD_ID__/$3`);
    await writeFile(`${directory}/${path}`, html);
  }
  const worker = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
  const contract = (await readFile(new URL('../src/release-contract.mjs', import.meta.url), 'utf8')).replace(/export /g, '');
  const ranges=(await readFile(new URL('../src/media-range.mjs',import.meta.url),'utf8')).replace(/export /g,'');
  const workerSource = contract + '\n' + ranges + '\n' + worker;
  const fingerprint = createHash('sha256').update(workerSource);
  for (const path of files) fingerprint.update(path).update('\0').update(await readFile(`${directory}/${path}`)).update('\0');
  const id = fingerprint.digest('hex');
  const assets = [];
  for (const path of files) {
    let body = await readFile(`${directory}/${path}`);
    if (path.endsWith('.html')) body = Buffer.from(body.toString().replaceAll('__BUILD_ID__', id));
    assets.push({ path, bytes: body.length, sha256: hash(body) });
    await writeFile(`${directory}/${path}`, body);
    const target = `${directory}/releases/${id}/${path}`;
    await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true });
    await writeFile(target, body);
  }
  const release = validateRelease({ schema: 1, id, ...identity, bytes: assets.reduce((sum, f) => sum + f.bytes, 0), files: assets });
  await writeFile(`${directory}/release.json`, JSON.stringify(release));
  await writeFile(`${directory}/releases/${id}/release.json`, JSON.stringify(release));
  await writeFile(`${directory}/sw.js`, workerSource);
  return release;
}
