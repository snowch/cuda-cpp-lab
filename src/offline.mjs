// Copyright © 2026 Christopher Snow.
import './experiment-state.mjs';
import {readReleaseMetadata} from './release-metadata.mjs';
const $ = id => document.getElementById(id);
const base = new URL(document.querySelector('meta[name="gpu-base"]').content, location.href);
const running = document.querySelector('meta[name="gpu-release"]').content;
const dialog = $('app-status-dialog');
const offlineButton = $('app-status-open');
const updateButton = $('app-status-summary');
const toast = $('update-toast');
const updateNoticeKey = `gpu-lab:${base.href}:update-notices`;
let registration, worker, latest, runningRelease, snapshot = {}, checking, lastCheck = 0, checkingAbort;
let downloading = false, restarting = false, mode, removed = false, refreshGeneration = 0, cacheLifetime = 0;
let version = navigator.onLine ? 'Checking for updates' : 'Cannot check for updates';
const supported = 'serviceWorker' in navigator && isSecureContext && 'caches' in self;
let unavailable = !supported;
let remembered = false, remembering, connected = false;
let returnFocus, noticeTimer, toastRelease;
const noticedReleases = new Set();
const bytes = n => `${n.toLocaleString('en-GB')} bytes (${(n / 1048576).toFixed(2)} MiB)`;
function error(message = '') { $('app-status-error').textContent = message; }

function readUpdateNotices() {
  try {
    return JSON.parse(localStorage.getItem(updateNoticeKey) || '[]');
  } catch {
    return [];
  }
}

function hideToast() {
  const restoreFocus = toast.contains(document.activeElement);
  toast.hidden = true;
  toastRelease = null;
  $('update-announcement').textContent = '';
  if (restoreFocus) (updateButton.hidden ? offlineButton : updateButton).focus({ preventScroll: true });
}

function scheduleUpdateNotice() {
  if (window !== window.top) return;
  clearTimeout(noticeTimer);
  const release = latest?.id;
  const available = release && release !== running && snapshot.pending !== release && !downloading && !dialog.open;
  if (!toast.hidden && (!available || toastRelease !== release)) hideToast();
  if (!available || noticedReleases.has(release)) return;
  noticeTimer = setTimeout(() => {
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    // The learner may be editing or running code inside a lesson frame.
    if (document.activeElement?.closest('main :is(input, textarea, select, iframe, [contenteditable="true"])') ||
        document.querySelector('main [aria-busy="true"]')) return;
    noticedReleases.add(release);
    const notices = readUpdateNotices();
    if (Array.isArray(notices) && notices.includes(release)) return;
    try {
      const recent = Array.isArray(notices) ? notices.slice(-19) : [];
      localStorage.setItem(updateNoticeKey, JSON.stringify([...recent, release]));
    } catch {
      // Keep the notice once per page if the browser blocks storage.
    }
    toastRelease = release;
    toast.hidden = false;
    $('update-announcement').textContent = $('update-toast-message').textContent;
  }, 1200);
}

function render() {
  const progress = $('download-progress');
  const feedback = $(mode === 'update' ? 'update-download-feedback' : 'offline-download-feedback');
  // Move the single progress/cancel group only when its owning action changes.
  // Repeated status refreshes must preserve focus inside the group.
  if (progress.parentElement !== feedback) feedback.append(progress);
  const pending = snapshot.pending && snapshot.pending !== running;
  const available = latest && latest.id !== running;
  const ready = pending && snapshot.pendingReady;
  $('version-status').textContent = downloading && mode === 'update' ? 'Downloading update' : ready ? 'Update ready' : version;
  updateButton.hidden = !(available || pending);
  updateButton.textContent = ready ? 'Update ready' : 'Update available';
  $('download-update').hidden = !available || Boolean(ready && snapshot.pending === latest.id);
  $('download-update').disabled = downloading || !supported;
  $('restart-update').hidden = !ready; $('later-update').hidden = !ready;
  $('restart-note').hidden = !ready;
  $('check-update').disabled = Boolean(checking);
  $('check-update').textContent = version === 'Couldn’t check for updates' ? 'Retry' : 'Check for updates';
  let offline = unavailable ? 'Offline access unavailable' : downloading && mode === 'offline' ? 'Saving for offline use' : snapshot.offlineReady ? 'Available offline' : ready ? 'Available after restarting update' : snapshot.saved || snapshot.partial ? 'Offline download incomplete' : 'Not saved for offline use';
  $('offline-status').textContent = offline;
  $('offline-status').dataset.state = snapshot.offlineReady ? 'ready' : 'unavailable';
  const release = runningRelease;
  $('offline-size').textContent = release ? `Complete app: ${bytes(release.bytes)}. Includes all required files; browser storage overhead is additional.` : 'The download size is unavailable. Connect to the internet and retry.';
  $('offline-size').hidden = Boolean(ready && !snapshot.offlineReady);
  $('save-offline').hidden = Boolean(snapshot.offlineReady || ready) || !supported;
  $('save-offline').disabled = downloading || !release;
  $('save-offline').textContent = unavailable ? 'Retry offline access' : snapshot.partial === running ? 'Resume download' : snapshot.saved ? 'Repair offline copy' : 'Download for offline use';
  offlineButton.textContent = unavailable ? 'Offline access'
    : downloading && mode === 'offline' ? 'Saving…'
    : snapshot.offlineReady ? 'Available offline'
    : ready ? 'Restart to save'
    : snapshot.partial === running ? 'Resume download'
    : snapshot.saved ? 'Repair offline copy'
    : 'Save offline';
  offlineButton.dataset.saved = Boolean(snapshot.offlineReady);
  $('remove-offline').hidden = !supported || !(snapshot.saved || snapshot.partial || snapshot.active || snapshot.pending);
  $('remove-offline').disabled = downloading;
  const cacheNote = cacheLifetime ? ` The host may take up to ${Math.ceil(cacheLifetime/60)} minutes to show a new deployment.` : '';
  $('version-detail').textContent = !supported ? 'This browser cannot save or prepare updates here. You can keep using GPU Lab online.' : latest && available ? `Deployed release ${latest.commit?.slice(0, 7) || latest.id.slice(0, 7)}${latest.date ? ' · ' + latest.date : ''}. Download: ${bytes(latest.bytes)}.${cacheNote}` : latest && cacheLifetime ? 'The published release matches this app.'+cacheNote : version === 'Cannot check for updates' ? 'You are offline. Saved files remain usable; the published version cannot be checked.' : version === 'Couldn’t check for updates' ? 'The deployed release could not be verified. Try again when connected.' : '';
  scheduleUpdateNotice();
}
function rpc(type, data = {}, progress) {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('Offline access unavailable. Reopen App status to retry.')); return; }
    const channel = new MessageChannel();
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { channel.port1.close(); reject(new Error('The operation did not respond. Reopen App status and retry.')); }, type === 'PREPARE' ? 30000 : 15000); };
    reset();
    channel.port1.onmessage = ({ data }) => {
      if (data.progress) { reset(); progress?.(data.progress); return; }
      clearTimeout(timer); channel.port1.close();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.postMessage({ type, running, ...data }, [channel.port2]);
  });
}
async function refresh() {
  if (!worker || removed) return;
  const generation = ++refreshGeneration;
  try {
    const result = await rpc('STATUS');
    if (generation !== refreshGeneration) return;
    snapshot = result; unavailable = false;
    runningRelease ||= snapshot.runningRelease;
    render();
  } catch (failure) {
    if (generation !== refreshGeneration) return;
    unavailable = true; error(failure.message); render();
  }
}
async function metadata(url, signal, options) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal, headers: { 'Cache-Control': 'no-cache' } });
  return readReleaseMetadata(response,options);
}
async function check(force = false) {
  if (checking) return checkingAbort?.signal.aborted ? checking.then(()=>check(force)) : checking;
  if (!force && Date.now() - lastCheck < 15000) return;
  if (!navigator.onLine) { latest = null; version = 'Cannot check for updates'; render(); return; }
  lastCheck = Date.now();
  const abort = new AbortController(); checkingAbort = abort;
  const timer = setTimeout(() => abort.abort(), 8000);
  const previousVersion = version;
  version = 'Checking for updates';
  checking = (async () => {
    try {
      const url = new URL('release.json', base); url.searchParams.set('check', crypto.randomUUID());
      const result = await metadata(url, abort.signal);
      const release = result.release;
      if (checkingAbort !== abort || abort.signal.aborted) return;
      latest = release; cacheLifetime = result.cacheLifetime;
      if (release.id === running) runningRelease = release;
      version = release.id === running ? 'Up to date' : 'Update available';
    } catch {
      if (checkingAbort === abort) {
        if(abort.signal.reason==='hidden') {
          version=previousVersion==='Checking for updates'?'Check for updates':previousVersion;
          lastCheck=0;
        } else {
          latest=null;cacheLifetime=0;
          version=navigator.onLine?'Couldn’t check for updates':'Cannot check for updates';
        }
      }
    }
    finally { clearTimeout(timer); checking = null; render(); }
  })();
  render(); return checking;
}
async function connect() {
  if (!supported) { render(); return; }
  try {
    registration = await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.href, updateViaCache: 'none' });
    // Never activate a waiting worker over an unprepared legacy tab.
    if (registration.active && !registration.active.scriptURL.endsWith('/sw.js')) throw new Error('A previous installation must be closed before App status can connect.');
    worker = registration.active;
    if (!worker) {
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Offline access unavailable. Retry when browser storage is enabled.')), 8000))]);
      worker = registration.active;
    }
    removed = false; await refresh(); connected = true; await remember();
  } catch (failure) { unavailable = true; error(failure.message); render(); }
}
async function remember() {
  if (remembered || remembering || downloading || restarting || !connected || !worker || !runningRelease || removed || document.readyState !== 'complete') return remembering;
  const prefix = new URL(`releases/${running}/`, base).href;
  const paths = performance.getEntriesByType('resource').map(entry => entry.name).filter(url => url.startsWith(prefix)).map(url => url.slice(prefix.length).split('?')[0]);
  paths.push(location.pathname.slice(base.pathname.length) || 'index.html');
  remembering = (async () => {
    if (snapshot.active !== running) await rpc('REMEMBER_PAGE', { release: runningRelease, paths });
    // Earlier updates cached the whole release without marking it available
    // offline. Recognise those copies through the existing worker protocol.
    // A visited-page cache with missing files must never trigger a book download.
    if (!snapshot.saved && !snapshot.offlineReady && !snapshot.busy && !removed &&
        (!snapshot.active || snapshot.active === running)) {
      const name = `gpu-lab:${base.href}:release-${running}`;
      if (await caches.has(name)) {
        const cache = await caches.open(name);
        const present = new Set((await cache.keys()).map(request => request.url));
        if (runningRelease.files.every(file => present.has(new URL(file.path, base).href))) {
          const result = await rpc('PREPARE', { release: runningRelease, save: true });
          ++refreshGeneration; snapshot = result; render();
        }
      }
    }
    remembered = true;
  })().catch(() => {
    // Storage is optional for normal online use; an explicit save/update reports
    // its own error. Never claim offline readiness for this best-effort cache.
  }).finally(() => { remembering = null; });
  return remembering;
}
async function download(save) {
  const release = save ? runningRelease : latest;
  if (!release || downloading) return;
  await remembering;
  if (save && snapshot.offlineReady) return;
  if (!worker || removed || unavailable) await connect();
  downloading = true; mode = save ? 'offline' : 'update'; error();
  $('download-progress').hidden = false; $('asset-progress').value = 0; $('asset-progress').max = release.bytes;
  $('progress-text').textContent = `0 of ${bytes(release.bytes)} verified`;
  render();
  let prepared = false;
  try {
    // Both actions prepare a complete offline copy. Keep save=true compatible
    // with already-installed workers as well as fresh installations.
    const result = await rpc('PREPARE', { release, save: true }, p => {
      $('asset-progress').max = p.total; $('asset-progress').value = p.bytes;
      $('progress-text').textContent = `${bytes(p.bytes)} of ${bytes(p.total)} verified`;
    });
    // PREPARE already returns a fully verified status. Do not hold readiness
    // behind another full-book scan, or let an older STATUS overwrite it.
    ++refreshGeneration;
    snapshot = result; unavailable = false;
    runningRelease ||= snapshot.runningRelease;
    prepared = true; error();
  } catch (failure) { error(failure.message); }
  finally { downloading = false; $('download-progress').hidden = true; if (!prepared) await refresh(); render(); }
}
$('running-version').append('Running ', document.querySelector('.build-info').cloneNode(true), ` · Build ${running.slice(0, 12)}`);
function openStatus(section, opener) {
  returnFocus = opener;
  const heading = $(section);
  dialog.querySelector('.status-heading').after(heading.closest('section'));
  dialog.showModal();
  dialog.scrollTop = 0;
  heading.focus({ preventScroll: true });
  scheduleUpdateNotice();
  check();
  if (!worker || removed) connect(); else refresh();
}
offlineButton.addEventListener('click', () => {
  const pendingOffline = !snapshot.offlineReady && snapshot.pending !== running && snapshot.pendingReady;
  openStatus(pendingOffline ? 'version-title' : 'offline-title', offlineButton);
});
updateButton.addEventListener('click', () => openStatus('version-title', updateButton));
$('review-update').addEventListener('click', () => openStatus('version-title', updateButton));
$('dismiss-update').addEventListener('click', hideToast);
$('app-status-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  (returnFocus && !returnFocus.hidden ? returnFocus : offlineButton).focus({ preventScroll: true });
  scheduleUpdateNotice();
});
$('check-update').addEventListener('click', () => { check(true); refresh(); });
$('download-update').addEventListener('click', () => download(false));
$('save-offline').addEventListener('click', () => download(true));
$('cancel-download').addEventListener('click', () => rpc('CANCEL').catch(f => error(f.message)));
$('later-update').addEventListener('click', () => dialog.close());
$('restart-update').addEventListener('click', async () => {
  error(); restarting = true; $('restart-update').disabled = true;
  try { await remembering; await rpc('RESTART'); }
  catch (failure) { error(failure.message); }
  finally { restarting = false; $('restart-update').disabled = false; await refresh(); }
});
$('remove-offline').addEventListener('click', () => { $('remove-confirmation').hidden = false; $('cancel-remove').focus(); });
$('cancel-remove').addEventListener('click', () => { $('remove-confirmation').hidden = true; $('remove-offline').focus(); });
$('confirm-remove').addEventListener('click', async () => {
  try { await remembering; await rpc('REMOVE'); snapshot = {}; removed = true; $('remove-confirmation').hidden = true; error('Downloaded files removed. Your experiment work and preferences have been kept.'); render(); $('save-offline').focus(); }
  catch (failure) { error(failure.message); }
});
navigator.serviceWorker?.addEventListener('message', ({ data }) => {
  if (data?.type === 'STATUS_CHANGED') refresh();
  if (data?.type === 'OFFLINE_REMOVED') { snapshot = {}; removed = true; render(); }
});
addEventListener('online', () => { lastCheck = 0; check(); refresh(); });
addEventListener('offline', () => { checkingAbort?.abort('offline'); latest=null; version = 'Cannot check for updates'; render(); });
addEventListener('focus', () => { check(); refresh(); });
for (const event of ['focus', 'focusout', 'pointerdown', 'keydown', 'scroll']) {
  addEventListener(event, scheduleUpdateNotice, { capture: true, passive: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { check(); refresh(); }
  else { checkingAbort?.abort('hidden'); }
});
setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) check(); }, 60000);
addEventListener('load', remember, { once: true });
render(); check(); connect();
// Running metadata is immutable and small; it is not a course download.
metadata(new URL(`releases/${running}/release.json`, base), AbortSignal.timeout(8000),{immutable:true}).then(({release:r}) => { if (r.id === running) { runningRelease = r; render(); remember(); } }).catch(() => {});
