// Copyright © 2026 Christopher Snow.
// Shared by the page, worker and build checks. Paths are always app-relative.
function validateRelease(value) {
  if (!value || value.schema !== 1 || !/^[a-f0-9]{64}$/.test(value.id) ||
      !(value.commit === null || /^[a-f0-9]{40}$/.test(value.commit)) ||
      !(value.date === null || /^\d{4}-\d{2}-\d{2}$/.test(value.date)) ||
      !Array.isArray(value.files) || !value.files.length || value.files.length > 10000) throw new Error('Invalid release metadata');
  const paths = new Set();
  let total = 0;
  for (const file of value.files) {
    if (!file || !/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(file.path) ||
        file.path.split('/').some(p => p === '.' || p === '..') ||
        /^(releases\/|sw\.js$|release\.json$)/.test(file.path) || paths.has(file.path) ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid release asset');
    paths.add(file.path); total += file.bytes;
  }
  if (!paths.has('index.html') || total !== value.bytes || !Number.isSafeInteger(total)) throw new Error('Invalid release size');
  return value;
}
async function digest(data) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), n => n.toString(16).padStart(2, '0')).join('');
}

// Copyright © 2026 Christopher Snow.
// Native media players seek with byte ranges, including while offline.
async function mediaRangeResponse(range,response){
  if(!range||response.status!==200)return response;
  const match=range.trim().match(/^bytes=(\d*)-(\d*)$/);
  // A server may ignore unsupported/multiple range units and send the full body.
  if(!match||(!match[1]&&!match[2]))return response;
  const body=await response.arrayBuffer(),length=body.byteLength;
  let start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2]));
  let end=match[1]&&match[2]?Number(match[2]):length-1;
  const headers=new Headers(response.headers);
  headers.delete('Content-Encoding');headers.set('Accept-Ranges','bytes');
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=length||start>end||(!match[1]&&Number(match[2])===0)){
    headers.set('Content-Range',`bytes */${length}`);headers.set('Content-Length','0');
    return new Response(null,{status:416,headers});
  }
  end=Math.min(end,length-1);
  headers.set('Content-Range',`bytes ${start}-${end}/${length}`);
  headers.set('Content-Length',String(end-start+1));
  return new Response(body.slice(start,end+1),{status:206,headers});
}

// Copyright © 2026 Christopher Snow.
// The build prepends the dependency-free release validator. No precache on install.
const BASE = new URL(self.registration.scope);
const PREFIX = `gpu-lab:${BASE.href}:`;
const META = PREFIX + 'status-v1';
const STATE = new URL('__app_status_state__', BASE).href;
const MANIFEST = new URL('__release_manifest__', BASE).href;
const cacheName = id => PREFIX + 'release-' + id;
let operation = null, pruning = null, operationDownload = null;
let operationFinished = Promise.resolve(), finishOperation;
function beginOperation() {
  operation = new AbortController();
  operationFinished = new Promise(resolve => { finishOperation = resolve; });
}
function endOperation() {
  operation = null; operationDownload = null; finishOperation?.();
}
let restarting = false;
let navigationGate, releaseNavigation;
const seen = new Map();
const verifying = new Map();
async function readState() {
  const cache = await caches.open(META);
  return (await cache.match(STATE))?.json() ?? {};
}
async function writeState(state) {
  await (await caches.open(META)).put(STATE, new Response(JSON.stringify(state)));
}
async function manifest(id) {
  if (!id) return null;
  const response = await (await caches.open(cacheName(id))).match(MANIFEST);
  return response ? validateRelease(await response.json()) : null;
}
async function verified(response, file) {
  if (!response?.ok) return false;
  const data = await response.arrayBuffer();
  return data.byteLength === file.bytes && await digest(data) === file.sha256;
}
async function complete(release, progress) {
  if (!release) return false;
  // Many open tabs request status together after a download. Share that scan,
  // including its byte/hash checks, rather than rereading every video per tab.
  // Retain no result after it finishes: the next check must detect eviction.
  let scan = verifying.get(release.id);
  if (!scan) {
    scan = { listeners: new Set(), bytes: 0, work: null };
    scan.work = Promise.resolve().then(async () => {
      try {
        const cache = await caches.open(cacheName(release.id));
        // Bound memory while overlapping CacheStorage I/O for the complete book.
        // Join failed batches before retries can start another scan.
        for (let start = 0; start < release.files.length; start += 4) {
          const batch = release.files.slice(start, start + 4);
          const checks = await Promise.allSettled(batch.map(async file => verified(await cache.match(new URL(file.path, BASE)), file)));
          for (const check of checks) {
            if (check.status === 'rejected') throw check.reason;
            if (!check.value) return false;
          }
          scan.bytes += batch.reduce((sum, file) => sum + file.bytes, 0);
          // Each waiting RPC receives real verification progress, so cold disk
          // reads reset its inactivity timer without extending stalled work.
          for (const listener of scan.listeners) {
            try { listener({ bytes: scan.bytes, total: release.bytes }); } catch { /* A closed tab cannot cancel another tab's scan. */ }
          }
        }
        // A file checked early can be evicted while a later recording is hashed.
        const present = new Set((await cache.keys()).map(request => request.url));
        return release.files.every(file => present.has(new URL(file.path, BASE).href));
      } finally {
        if (verifying.get(release.id) === scan) verifying.delete(release.id);
      }
    });
    verifying.set(release.id, scan);
  }
  if (progress) {
    scan.listeners.add(progress);
    if (scan.bytes) {
      try { progress({ bytes: scan.bytes, total: release.bytes }); } catch { /* The requester may have closed. */ }
    }
  }
  try { return await scan.work; }
  finally { scan.listeners.delete(progress); }
}
async function broadcast(message) {
  for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    if (client.url.startsWith(BASE.href)) client.postMessage(message);
  }
}
function prune(progress) {
  if (operation || restarting) return;
  if (pruning) return pruning;
  // Cleanup owns the cache list until it finishes. Mutating requests reserve
  // their operation immediately, then wait before opening or deleting caches.
  pruning = (async () => {
    const state = await readState();
    if (!state.active) return;
    const release = await manifest(state.active);
    if (!await complete(release, progress)) return;
    const windows = await courseWindows(release);
    if (windows.some(client => seen.get(client.id) !== state.active)) return;
    const keep = new Set([META, ...[state.active, state.previous, state.pending, state.partial].filter(Boolean).map(cacheName)]);
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && !keep.has(name)) await caches.delete(name);
  })().finally(() => { pruning = null; });
  return pruning;
}
async function status(running, justVerified, progress) {
  const state = await readState();
  const release = await manifest(state.active || running);
  const pending = await manifest(state.pending);
  const keys = await caches.keys();
  // Old workers saved automatically. Keep their complete cache until the learner
  // explicitly removes it; treat it as consent to preserve offline access on update.
  const legacy = keys.some(k => k.startsWith(PREFIX) && !k.startsWith(PREFIX + 'release-') && k !== META);
  const transfer=await downloadInfo();
  return { ...state, ...transfer, runningRelease: await manifest(running), saved: Boolean(state.saved || legacy), legacy,
    offlineReady: Boolean(state.saved && ((justVerified && release?.id === justVerified.id) || await complete(release, progress))),
    pendingReady: Boolean(pending && ((justVerified && pending.id === justVerified.id) || await complete(pending, progress))),
    busy: Boolean(operation || restarting || transfer.download?.busy) };
}
async function rememberPage(release, paths) {
  validateRelease(release);
  const state = await readState();
  if (state.active && state.active !== release.id) return;
  const cache = await caches.open(cacheName(release.id));
  await cache.put(MANIFEST, new Response(JSON.stringify(release)));
  const requested = new Set(paths);
  // These files have already been loaded by this document. This is a visited-page
  // cache, not a background download of the rest of the app or offline consent.
  for (const file of release.files.filter(f => requested.has(f.path))) {
    const key = new URL(file.path, BASE);
    if (await verified(await cache.match(key), file)) continue;
    const response = await fetch(new URL(`releases/${release.id}/${file.path}`, BASE), { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
    if (!await verified(response.clone(), file)) throw new Error('The running page could not be retained. Keep this tab open until you restart to update.');
    await cache.put(key, response);
  }
  // Re-read after I/O so a concurrent explicit download cannot lose its consent.
  const latest = await readState();
  if (!latest.active) { latest.active = release.id; await writeState(latest); }
}
async function prepare(release, save, port, signal, downloadId) {
  validateRelease(release);
  const cache = await caches.open(cacheName(release.id));
  await cache.put(MANIFEST, new Response(JSON.stringify(release)));
  let bytes = 0;
  for (const file of release.files) {
    signal.throwIfAborted();
    const key = new URL(file.path, BASE);
    if (!await verified(await cache.match(key), file)) {
      const timeout = AbortSignal.timeout(15000);
      const response = await fetch(new URL(`releases/${release.id}/${file.path}`, BASE), {
        cache: 'no-store', signal: AbortSignal.any([signal, timeout]), credentials: 'same-origin',
      });
      if(!response.ok)throw new Error('Download paused because a file is unavailable. Completed files are kept; it will resume when you return.');
      if (!await verified(response.clone(), file)) throw new Error('A downloaded file did not match the release. Retry after deployment finishes.');
      signal.throwIfAborted();
      await cache.put(key, response);
    }
    bytes += file.bytes;
    port.postMessage({ progress: { bytes, total: release.bytes } });
    if (downloadId) await reportDownload(downloadId, {bytes,total:release.bytes,stage:'verified'});
  }
  await markPrepared(release, save, signal, () => port.postMessage({progress:{bytes:release.bytes,total:release.bytes}}));
}
async function markPrepared(release, save, signal, progress) {
  signal.throwIfAborted();
  if (!await complete(release, progress)) throw new Error('The saved files could not be verified. Free storage and retry.');
  signal.throwIfAborted();
  const state = await readState();
  if (save && (!state.active || state.active === release.id)) {
    state.active = release.id; state.saved = true;
  } else {
    state.pending = release.id;
    state.pendingSaved = Boolean(save || state.saved || (await status()).legacy);
  }
  state.partial = null;
  await writeState(state);
}
// Download consent is separate from the active-release state. In particular,
// cancelling a transfer must not replace a completed course or an editor draft.
const DOWNLOAD_REQUEST = new URL('__download_request_v1__', BASE).href;
let downloadWrites = Promise.resolve();
async function readDownload() {
  const response = await (await caches.open(META)).match(DOWNLOAD_REQUEST);
  if (!response) return null;
  try {
    const job=await response.json();
    return job&&typeof job.wanted==='boolean'&&['offline','update'].includes(job.mode)&&/^[a-f0-9]{64}$/.test(job.release)&&typeof job.id==='string'&&job.id.startsWith('gpu-lab-')?job:null;
  } catch {return null;}
}
function writeDownload(job) {
  const work = downloadWrites.then(async () => {
    await (await caches.open(META)).put(DOWNLOAD_REQUEST, new Response(JSON.stringify(job)));
    return job;
  });
  downloadWrites = work.catch(() => {});
  return work;
}
function changeDownload(id, patch) {
  const work = downloadWrites.then(async () => {
    const job = await readDownload();
    if (!job || job.id !== id) return null;
    const fields=typeof patch==='function'?patch(job):patch;
    if(!fields)return job;
    const next = {...job,...fields};
    await (await caches.open(META)).put(DOWNLOAD_REQUEST, new Response(JSON.stringify(next)));
    return next;
  });
  downloadWrites = work.catch(() => {});
  return work;
}
async function nativeDownload(job) {
  if (!job || !self.registration.backgroundFetch) return null;
  try { return await self.registration.backgroundFetch.get(job.id); }
  catch { return null; }
}
async function downloadInfo() {
  const job = await readDownload();
  if (!job) return {downloadVersion:1,download:null};
  const native = await nativeDownload(job);
  const busy = job.state !== 'ready' && (operationDownload === job.id || Boolean(job.wanted && native) ||
    Boolean(job.wanted && job.state === 'planning' && Date.now()-job.started < 30000));
  const state = native && job.wanted ? (native.result ? 'verifying' : 'background')
    : job.wanted && !busy && job.state !== 'ready' ? 'paused' : job.state;
  const bytes = native && !native.result ? Math.min(job.total,job.cachedBytes+native.downloaded) : job.bytes;
  return {downloadVersion:1,downloadRelease:await manifest(job.release),download:{...job,state,busy,bytes,
    stage:native&&!native.result?'downloaded':'verified'}};
}
async function newDownload(release, data) {
  const previous = await readDownload();
  if (data.downloadId) {
    if (!previous || previous.id !== data.downloadId || !previous.wanted || previous.release !== release.id)
      throw new Error('This download was cancelled or replaced. Choose the download again to start it.');
    return previous;
  }
  if(previous?.wanted && previous.state==='planning' && Date.now()-previous.started<30000)
    throw new Error('Another window is preparing this download. Wait for it to finish.');
  return writeDownload({id:'gpu-lab-'+crypto.randomUUID(),release:release.id,
    mode:data.mode==='offline'?'offline':'update',save:Boolean(data.save),wanted:true,
    state:'planning',started:Date.now(),bytes:0,cachedBytes:0,total:release.bytes,error:null});
}
async function reportDownload(id, progress) {
  const job = await changeDownload(id,{bytes:progress.bytes});
  if (job) await broadcast({type:'DOWNLOAD_PROGRESS',id,progress});
}
async function failDownload(id, failure) {
  const message = failure.name==='QuotaExceededError'?'Browser storage is full. Free space and resume the download.':['TimeoutError','TypeError'].includes(failure.name)?'Download paused. Completed files are kept. Reconnect or return to resume.':failure.message || String(failure);
  const retry = !['AbortError','QuotaExceededError'].includes(failure.name) && !/match the release|could not be verified/.test(message);
  await changeDownload(id,job=>job.wanted?{state:'paused',wanted:retry,error:failure.name==='AbortError'?null:message}:null);
}
async function planDownload(data, port) {
  if (operation || restarting) throw new Error('Another window is downloading or restarting. Wait for it to finish.');
  beginOperation();
  let job;
  try {
    await pruning; operation.signal.throwIfAborted();
    validateRelease(data.release);
    const existing = await readDownload(), native = await nativeDownload(existing);
    if (existing?.wanted && native) return {backgroundId:existing.id,existing:true};
    if (existing?.wanted && existing.state==='planning' && Date.now()-existing.started<30000 && !data.downloadId)
      throw new Error('Another window is preparing this download. Wait for it to finish.');
    job = await newDownload(data.release,data); operationDownload=job.id;
    const cache = await caches.open(cacheName(data.release.id));
    await cache.put(MANIFEST,new Response(JSON.stringify(data.release)));
    const state=await readState();state.partial=data.release.id;await writeState(state);
    const requests=[];let bytes=0,total=0;
    for (const file of data.release.files) {
      operation.signal.throwIfAborted();
      if (await verified(await cache.match(new URL(file.path,BASE)),file)) bytes+=file.bytes;
      else {requests.push(new URL(`releases/${data.release.id}/${file.path}`,BASE).href);total+=file.bytes;}
      port.postMessage({progress:{bytes,total:data.release.bytes,stage:'checking'}});
    }
    operation.signal.throwIfAborted();
    if (!requests.length) {
      await markPrepared(data.release,Boolean(data.save),operation.signal,value=>port.postMessage({progress:value}));
      await changeDownload(job.id,{state:'ready',wanted:false,bytes:data.release.bytes,error:null});
      return {ready:true,status:await status(data.running,data.release)};
    }
    await changeDownload(job.id,{state:'planning',started:Date.now(),cachedBytes:bytes,bytes,error:null});
    return {backgroundId:job.id,requests,downloadTotal:total,cachedBytes:bytes,total:data.release.bytes};
  } catch (failure) {if(job)await failDownload(job.id,failure);throw failure;}
  finally {endOperation();await broadcast({type:'STATUS_CHANGED'});}
}
async function cancelDownload(id) {
  const job=await readDownload();
  if (id && job?.id!==id) return;
  try {if(job&&job.state!=='ready')await stopDownloadRequest(job.id);}
  finally {
    operation?.abort();
    const native=await nativeDownload(job);
    if(native)await native.abort();
  }
  await broadcast({type:'STATUS_CHANGED'});
}
async function stopDownloadRequest(id) {
  try {await changeDownload(id,{wanted:false,state:'paused',error:null});}
  catch(failure) {
    // Storage pressure must not preserve consent for an automatic retry.
    // Remove only the request; the verified course and learner work are kept.
    const job=await readDownload();
    if(job?.id===id)await (await caches.open(META)).delete(DOWNLOAD_REQUEST);
    else throw failure;
  }
}
async function receiveBackground(event, outcome) {
  let job=await readDownload();
  if (!job || job.id!==event.registration.id) return;
  if (outcome==='abort') await stopDownloadRequest(job.id);
  // A short page-cache operation may already own CacheStorage. Let it finish
  // before importing the browser's responses, including when no page is open.
  while (operation) await operationFinished;
  beginOperation();operationDownload=job.id;
  try {
    await pruning;
    job=await readDownload();
    if (!job || job.id!==event.registration.id) return;
    const release=await manifest(job.release);
    if(!release)throw new Error('The download metadata is missing. Choose the download again.');
    await changeDownload(job.id,{state:'verifying'});
    const expected=new Map(release.files.map(file=>[new URL(`releases/${release.id}/${file.path}`,BASE).href,file]));
    const cache=await caches.open(cacheName(release.id));let bytes=job.cachedBytes,validationFailure;
    if(event.registration.recordsAvailable)for(const record of await event.registration.matchAll()) {
      operation.signal.throwIfAborted();
      const file=expected.get(record.request.url);
      if(!file){validationFailure=new Error('A downloaded file did not match the release. Retry after deployment finishes.');continue;}
      let response;
      try {response=await record.responseReady;} catch {if(outcome==='success')validationFailure=new Error('A download response is missing. Retry the download.');continue;}
      if(!await verified(response.clone(),file)) {
        if(outcome!=='success')continue;
        validationFailure=new Error('A downloaded file did not match the release. Retry after deployment finishes.');continue;
      }
      await cache.put(new URL(file.path,BASE),response);bytes+=file.bytes;
      await reportDownload(job.id,{bytes,total:release.bytes,stage:'verified'});
    }
    if(validationFailure)throw validationFailure;
    const current=await readDownload();
    if(outcome==='success'&&current?.id===job.id&&current.wanted) {
      await markPrepared(release,job.save,operation.signal);
      await changeDownload(job.id,{state:'ready',wanted:false,bytes:release.bytes,error:null});
      await event.updateUI?.({title:job.mode==='update'?'GPU Lab update ready':'GPU Lab available offline'});
    } else {
      const failed=outcome==='fail',reason=event.registration.failureReason;
      const retry=failed&&!['aborted','quota-exceeded','download-total-exceeded'].includes(reason);
      const error=!failed?null:reason==='quota-exceeded'?'Browser storage is full. Free space and resume the download.':reason==='download-total-exceeded'?'The download size changed. Retry after deployment finishes.':'Download interrupted. Completed files are kept; it will resume when you return.';
      await changeDownload(job.id,current=>({state:'paused',wanted:Boolean(current.wanted&&retry),error:current.wanted?error:null}));
    }
  } catch (failure) {
    await failDownload(job.id,failure);
    try{await event.updateUI?.({title:'GPU Lab download needs attention'});}catch{/* The in-app status retains the failure. */}
  }
  finally {endOperation();await broadcast({type:'STATUS_CHANGED'});}
}
for(const [type,outcome] of [['backgroundfetchsuccess','success'],['backgroundfetchfail','fail'],['backgroundfetchabort','abort']]) {
  self.addEventListener(type,event=>event.waitUntil(receiveBackground(event,outcome)));
}
self.addEventListener('backgroundfetchclick',event=>event.waitUntil((async()=>{
  const windows=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>client.url.startsWith(BASE.href));
  const window=windows.find(client=>client.frameType!=='nested')??windows[0];
  if(window){await window.focus();window.postMessage({type:'OPEN_APP_STATUS'});}
  else await self.clients.openWindow(new URL('?download=1',BASE).href);
})()));

async function courseWindows(release) {
  const paths = new Set(release.files.filter(f => f.path.endsWith('.html')).map(f => new URL(f.path, BASE).pathname));
  return (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => {
    const url = new URL(client.url);
    return url.origin === BASE.origin && paths.has(url.pathname === BASE.pathname ? url.pathname + 'index.html' : url.pathname);
  });
}
function ask(client, token) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Another GPU Lab window did not respond. Open it and try again, or close it after saving your work.')); }, 5000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer); channel.port1.close();
      data?.ready ? resolve() : reject(new Error(data?.error || 'Another window cannot save its work yet.'));
    };
    client.postMessage({ type: 'PREPARE_RESTART', token }, [channel.port2]);
  });
}
async function restart(progress) {
  const state = await readState(), release = await manifest(state.pending);
  if (!release || !await complete(release, progress)) throw new Error('The update is incomplete. Download it again before restarting.');
  const token = crypto.randomUUID();
  const windows = await courseWindows(release);
  try {
    // Every participant saves and locks its inputs. A missing or old client blocks
    // the transaction; it is never silently navigated and stripped of its work.
    await Promise.all(windows.map(client => ask(client, token)));
    const current = await courseWindows(release);
    if (current.length !== windows.length || current.some(c => !windows.some(w => w.id === c.id))) throw new Error('The open windows changed. Try restarting again.');
    state.previous = state.active;
    state.active = state.pending; state.saved = state.pendingSaved;
    state.pending = null; state.pendingSaved = false;
    await writeState(state);
    for (const client of windows) client.postMessage({ type: 'COMMIT_RESTART', token });
  } catch (error) {
    for (const client of windows) client.postMessage({ type: 'ABORT_RESTART', token });
    throw error;
  }
}
self.addEventListener('install', () => {});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port || !event.source?.url.startsWith(BASE.href)) return;
  event.waitUntil((async () => {
    try {
      const data = event.data;
      let result;
      const progress = value => port.postMessage({ progress: value });
      if (data.type === 'STATUS') {
        if (/^[a-f0-9]{64}$/.test(data.running)) seen.set(event.source.id, data.running);
        result = await status(data.running, null, progress);
        await prune(progress);
      }
      else if (data.type === 'REMEMBER_PAGE') {
        if (operation || restarting) throw new Error('A download or restart is already in progress.');
        beginOperation();
        try { await pruning; await rememberPage(data.release, data.paths); result = {}; } finally { endOperation(); }
      } else if (data.type === 'DOWNLOAD_PLAN') {
        result=await planDownload(data,port);
      } else if (data.type === 'BACKGROUND_STARTED') {
        const job=await readDownload();
        if(!job || job.id!==data.id || !job.wanted) throw new Error('This download was cancelled or replaced.');
        await changeDownload(job.id,{state:'background',error:null});result={};
      } else if (data.type === 'CANCEL') {
        await cancelDownload(data.id); result = {};
      } else if (data.type === 'PREPARE') {
        if (operation || restarting) throw new Error('Another window is downloading or restarting. Wait for it to finish.');
        beginOperation();
        let job;
        try {
          await pruning; operation.signal.throwIfAborted();
          validateRelease(data.release);
          const existing=await readDownload();
          if(existing?.wanted && await nativeDownload(existing))throw new Error('The browser is already downloading this course.');
          if(data.requestDownload || data.downloadId){job=await newDownload(data.release,data);operationDownload=job.id;await changeDownload(job.id,{state:'foreground',error:null});}
          const state = await readState(); state.partial = data.release.id; await writeState(state);
          await prepare(data.release, Boolean(data.save), port, operation.signal, job?.id);
          if(job)await changeDownload(job.id,{state:'ready',wanted:false,bytes:data.release.bytes,error:null});
          // prepare() has just verified every byte. Reuse that result for this
          // response instead of scanning the new release again. Later STATUS
          // requests still verify storage afresh to detect eviction.
          result = await status(data.running, data.release, () => progress({ bytes: data.release.bytes, total: data.release.bytes }));
        } catch(failure) {if(job)await failDownload(job.id,failure);throw failure;}
        finally { endOperation(); await broadcast({ type: 'STATUS_CHANGED' }); }
      } else if (data.type === 'RESTART') {
        if (operation || restarting || (await downloadInfo()).download?.busy) throw new Error('Wait for the current operation to finish.');
        restarting = true;
        navigationGate = new Promise(resolve => { releaseNavigation = resolve; });
        try { await pruning; await restart(progress); result = {}; } finally { restarting = false; releaseNavigation(); }
      } else if (data.type === 'REMOVE') {
        if (operation || restarting || (await downloadInfo()).download?.busy) throw new Error('Cancel the download or wait for the restart before removing files.');
        beginOperation();
        try {
          await pruning;
          for (const name of await caches.keys()) if (name.startsWith(PREFIX)) await caches.delete(name);
          await self.registration.unregister();
          await broadcast({ type: 'OFFLINE_REMOVED' }); result = {};
        } finally { endOperation(); }
      } else throw new Error('Unsupported App status request');
      port.postMessage({ result });
    } catch (error) { port.postMessage({ error: error.name === 'AbortError' ? 'Download cancelled. Verified files can be resumed.' : error.message }); }
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  let path = url.pathname.slice(BASE.pathname.length) || 'index.html';
  // Metadata is network-only, including requests from legacy cached documents.
  if (path === 'release.json' || path.endsWith('/release.json')) {
    event.respondWith(fetch(new Request(event.request, { cache: 'no-store' }))); return;
  }
  if (path === 'sw.js') return;
  event.respondWith((async () => {
    if (event.request.mode === 'navigate' && restarting) await navigationGate;
    const pinned = path.match(/^releases\/([a-f0-9]{64})\/(.+)$/);
    const state = await readState();
    const id = pinned ? pinned[1] : state.active;
    if (pinned) path = pinned[2];
    if (id) {
      const cache = await caches.open(cacheName(id));
      const cached = await cache.match(new URL(path, BASE));
      if (cached) return mediaRangeResponse(event.request.headers.get('Range'),cached);
      // Missing assets from a selected release must never fall through to a
      // different root deployment. The immutable release URL may repair them.
      const response = await fetch(new URL(`releases/${id}/${path}`, BASE), { cache: 'no-store' });
      const release = await manifest(id), file = release?.files.find(f => f.path === path);
      if (file) {
        if (!await verified(response.clone(), file)) return new Response('This release file could not be verified. Return to App status to repair or update.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        await cache.put(new URL(path, BASE), response.clone());
      }
      return mediaRangeResponse(event.request.headers.get('Range'),response);
    }
    try { return await fetch(event.request); }
    catch (error) {
      // Preserve old complete installations during the protocol migration.
      for (const name of await caches.keys()) {
        if (name.startsWith(PREFIX) && name !== META && !name.startsWith(PREFIX + 'release-')) {
          const response = await (await caches.open(name)).match(new URL(path, BASE));
          if (response) return response;
        }
      }
      throw error;
    }
  })());
});
