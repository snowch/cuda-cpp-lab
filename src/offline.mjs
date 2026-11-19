// Copyright © 2026 Christopher Snow.
import './experiment-state.mjs';
import {readReleaseMetadata} from './release-metadata.mjs';
const $ = id => document.getElementById(id);
const base = new URL(document.querySelector('meta[name="gpu-base"]').content, location.href);
const running = document.querySelector('meta[name="gpu-release"]').content;
const dialog = $('app-status-dialog');
let registration, worker, latest, runningRelease, snapshot = {}, checking, lastCheck = 0, checkingAbort, connecting, runningMetadata;
let downloading = false, cancelling = false, restarting = false, mode, removed = false, refreshGeneration = 0, cacheLifetime = 0;
let version = navigator.onLine ? 'Checking for updates' : 'Cannot check for updates';
const supported = 'serviceWorker' in navigator && isSecureContext && 'caches' in self;
let unavailable = !supported;
let remembered = false, remembering, connected = false;
let backgroundDownload,backgroundProgress,resumeWork,resumeTimer,downloadCancelled=false,localDownloadId,downloadWork;
const bytes = n => `${n.toLocaleString('en-GB')} bytes (${(n / 1048576).toFixed(2)} MiB)`;
const progressSize = n => `${(n / 1048576).toFixed(2)} MiB`;
function error(message = '',source='operation') {
  const element=$('app-status-error');
  if(element.textContent!==message)element.textContent=message;
  element.dataset.source=source;
  const owner=source.startsWith('download')?$(mode==='update'?'update-download-feedback':'offline-download-feedback'):dialog;
  if(element.parentElement!==owner)owner.append(element);
}
function render() {
  const job=snapshot.download;
  const locked=Boolean(downloadWork)||downloading||Boolean(job?.busy);
  const active=(downloading&&!downloadCancelled)||Boolean(job?.busy);
  const stopping=cancelling&&active;
  const requested=Boolean(job?.wanted&&job.state!=='ready');
  if(job&&!downloading&&!downloadWork&&$('app-status-error').dataset.source!=='download-start')mode=job.mode;
  const progress = $('download-progress');
  const feedback = $(mode === 'update' ? 'update-download-feedback' : 'offline-download-feedback');
  // Move the single progress/cancel group only when its owning action changes.
  // Repeated status refreshes must preserve focus inside the group.
  if (progress.parentElement !== feedback) feedback.append(progress);
  progress.hidden=cancelling||!((downloading&&!downloadCancelled)||requested);
  if(job&&!downloading)showProgress({bytes:job.bytes,total:job.total,stage:job.stage});
  const notice=$('download-behaviour');
  notice.textContent=requested&&!navigator.onLine?'Waiting for a connection. Completed files are kept.':job?.state==='background'?(mode==='update'?'Downloading in the background. Return here to apply the update.':'Downloading in the background. The course is available offline when all files are checked.'):job?.state==='verifying'?(mode==='update'?'Checking the downloaded files before the update is ready.':'Checking the saved files before marking the course available offline.'):'Completed files are kept. If your browser pauses the download, it resumes when you return.';
  if(job?.error&&!downloading&&!downloadWork&&$('app-status-error').dataset.source!=='download-start')error(job.error,'download');
  else if($('app-status-error').dataset.source==='download')error('');
  if($('app-status-error').dataset.source?.startsWith('download')&&$('app-status-error').parentElement!==feedback)feedback.append($('app-status-error'));
  const pending = snapshot.pending && snapshot.pending !== running;
  const available = latest && latest.id !== running;
  const ready = pending && snapshot.pendingReady;
  $('version-status').textContent = stopping&&mode==='update'?'Stopping download':active && mode === 'update' ? job?.state==='verifying'?'Checking update':'Downloading update' : requested&&mode==='update'?'Update download paused' : ready ? 'Update ready' : version;
  $('app-status-summary').textContent = `${document.querySelector('.build-info a')?.textContent || running.slice(0, 7)} · ${ready ? 'Update ready' : available || pending ? 'Update available' : version === 'Up to date' ? 'Up to date' : 'Check version'}`;
  $('download-update').hidden = !available || Boolean(ready && snapshot.pending === latest.id);
  $('download-update').disabled = locked || !supported;
  $('download-update').textContent=latest&&snapshot.partial===latest.id?'Resume update':'Update';
  $('restart-update').hidden = !ready; $('later-update').hidden = !ready;
  $('restart-note').hidden = !ready;
  $('restart-update').disabled=restarting||locked;
  $('check-update').disabled = Boolean(checking);
  $('check-update').textContent = version === 'Couldn’t check for updates' ? 'Retry' : 'Check for updates';
  let offline = unavailable ? 'Offline access unavailable' : stopping&&mode==='offline'?'Stopping download':active && mode === 'offline' ? 'Saving for offline use' : snapshot.offlineReady ? 'Available offline' : ready ? 'Available after restarting update' : snapshot.saved || snapshot.partial ? 'Offline download incomplete' : 'Not saved for offline use';
  $('offline-status').textContent = offline;
  $('offline-status').dataset.state = snapshot.offlineReady ? 'ready' : 'unavailable';
  const release = runningRelease;
  $('offline-size').textContent = release ? `Complete app: ${bytes(release.bytes)}. Includes all required files; browser storage overhead is additional.` : 'The download size is unavailable. Connect to the internet and retry.';
  $('offline-size').hidden = Boolean(ready && !snapshot.offlineReady);
  $('save-offline').hidden = Boolean(snapshot.offlineReady || ready) || !supported;
  $('save-offline').disabled = locked || !release;
  $('save-offline').textContent = unavailable ? 'Retry offline access' : snapshot.partial === running ? 'Resume download' : snapshot.saved ? 'Repair offline copy' : 'Download for offline use';
  $('remove-offline').hidden = !supported || !(snapshot.saved || snapshot.partial || snapshot.active || snapshot.pending);
  $('remove-offline').disabled = locked;
  const cacheNote = cacheLifetime ? ` The host may take up to ${Math.ceil(cacheLifetime/60)} minutes to show a new deployment.` : '';
  $('version-detail').textContent = !supported ? 'This browser cannot save or prepare updates here. You can keep using GPU Lab online.' : latest && available ? `Deployed release ${latest.commit?.slice(0, 7) || latest.id.slice(0, 7)}${latest.date ? ' · ' + latest.date : ''}. Download: ${bytes(latest.bytes)}.${cacheNote}` : latest && cacheLifetime ? 'The published release matches this app.'+cacheNote : version === 'Cannot check for updates' ? 'You are offline. Saved files remain usable; the published version cannot be checked.' : version === 'Couldn’t check for updates' ? 'The deployed release could not be verified. Try again when connected.' : '';
}
function rpc(type, data = {}, progress) {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('Offline access unavailable. Reopen App status to retry.')); return; }
    const channel = new MessageChannel();
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { channel.port1.close(); reject(new Error('The operation did not respond. Reopen App status and retry.')); }, ['PREPARE','DOWNLOAD_PLAN'].includes(type) ? 30000 : 15000); };
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
    let result = await rpc('STATUS');
    if(!result.downloadVersion)result={...result,...await legacyInfo(result)};
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
function connect() {
  if(connecting)return connecting;
  connecting=(async()=>{
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
    removed = false; await refresh(); connected = true; await remember();resumeDownloads();
  } catch (failure) { unavailable = true; error(failure.message); render(); }
  })().finally(()=>{connecting=null;});
  return connecting;
}
async function remember() {
  if (window!==window.top || remembered || remembering || downloading || restarting || !connected || !worker || !runningRelease || removed || document.readyState !== 'complete') return remembering;
  const prefix = new URL(`releases/${running}/`, base).href;
  const visited=new Set();
  // The lesson owns retention for its embedded editors too. Separate frame
  // requests can otherwise race the parent's explicit download operation.
  function collect(target){
    try{
      const url=new URL(target.location.href);
      if(!url.href.startsWith(base.href))return;
      visited.add(url.href.startsWith(prefix)?url.href.slice(prefix.length).split(/[?#]/)[0]:url.pathname.slice(base.pathname.length)||'index.html');
      for(const entry of target.performance.getEntriesByType('resource'))
        if(entry.name.startsWith(prefix))visited.add(entry.name.slice(prefix.length).split(/[?#]/)[0]);
      for(let index=0;index<target.frames.length;index++)collect(target.frames[index]);
    }catch{/* Optional cross-origin frames cannot be retained by this course. */}
  }
  collect(window);
  const paths=[...visited];
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
// An already-installed worker can remain active until its last page closes.
// New pages keep the same durable request in that worker's existing metadata
// cache; the new worker can recover it when it activates naturally.
let legacyWrites=Promise.resolve();
async function legacyRequest(){
  const cache=await caches.open(`gpu-lab:${base.href}:status-v1`);
  const response=await cache.match(new URL('__download_request_v1__',base));
  if(!response)return null;
  try{const job=await response.json();return job&&typeof job.wanted==='boolean'&&['offline','update'].includes(job.mode)&&/^[a-f0-9]{64}$/.test(job.release)&&typeof job.id==='string'&&job.id.startsWith('gpu-lab-')?job:null;}catch{return null;}
}
function legacyChange(id,patch){
  const work=legacyWrites.then(async()=>{
    const cache=await caches.open(`gpu-lab:${base.href}:status-v1`),key=new URL('__download_request_v1__',base),current=await legacyRequest();
    if(id&&current?.id!==id)return null;
    const fields=typeof patch==='function'?patch(current):patch;
    if(!fields)return current;
    const next={...current,...fields};await cache.put(key,new Response(JSON.stringify(next)));return next;
  });
  legacyWrites=work.catch(()=>{});return work;
}
async function legacyStart(release,mode,id){
  if(id){const job=await legacyRequest();if(!job?.wanted||job.id!==id)throw new Error('This download was cancelled or replaced.');return job;}
  const cache=await caches.open(`gpu-lab:${base.href}:release-${release.id}`);
  await cache.put(new URL('__release_manifest__',base),new Response(JSON.stringify(release)));
  return legacyChange(null,{id:'gpu-lab-'+crypto.randomUUID(),release:release.id,mode,save:true,wanted:true,
    state:'foreground',started:Date.now(),bytes:0,cachedBytes:0,total:release.bytes,error:null});
}
async function legacyStop(id){
  try{await legacyChange(id,job=>job&&job.state!=='ready'?{wanted:false,state:'paused',error:null}:null);}
  catch(failure){
    const job=await legacyRequest();
    if(!id||job?.id===id)await (await caches.open(`gpu-lab:${base.href}:status-v1`)).delete(new URL('__download_request_v1__',base));
    else throw failure;
  }
}
async function legacyInfo(status){
  let job=await legacyRequest();
  if(!job)return {downloadVersion:0,download:null};
  const response=await (await caches.open(`gpu-lab:${base.href}:release-${job.release}`)).match(new URL('__release_manifest__',base));
  const release=response?(await readReleaseMetadata(response,{immutable:true})).release:null;
  if(job.wanted&&((status.pending===job.release&&status.pendingReady)||(status.active===job.release&&status.offlineReady)))
    job=await legacyChange(job.id,{wanted:false,state:'ready',bytes:job.total,error:null});
  return {downloadVersion:0,downloadRelease:release,download:{...job,busy:Boolean(job.wanted&&status.busy),
    state:job.wanted?(status.busy?'foreground':'paused'):job.state,stage:job.wanted&&status.busy?'unknown':'verified'}};
}

function showProgress(value) {
  const stage=value.stage||'verified';
  if(stage==='unknown'){$('asset-progress').removeAttribute('value');$('download-progress-label').textContent='Download in progress';$('progress-text').textContent='Waiting for download status. Completed files are kept.';return;}
  $('asset-progress').max=value.total;$('asset-progress').value=value.bytes;
  $('download-progress-label').textContent=stage==='downloaded'?'Downloaded files':stage==='checking'?'Checking saved files':'Verified download progress';
  $('progress-text').textContent=`${progressSize(value.bytes)} of ${progressSize(value.total)} ${stage==='downloaded'?'downloaded; files are checked before the course is ready':'verified'}`;
}
async function watchBackground(id) {
  if(!registration.backgroundFetch)return;
  const transfer=await registration.backgroundFetch.get(id);
  if(!transfer)return;
  if(backgroundDownload?.id===id)return;
  if(backgroundDownload)backgroundDownload.removeEventListener('progress',backgroundProgress);
  backgroundDownload=transfer;
  backgroundProgress=()=>{
    if(snapshot.download?.id!==id)return;
    if(transfer.result){refresh();return;}
    const job=snapshot.download;
    snapshot.download={...job,state:'background',busy:true,stage:'downloaded',bytes:Math.min(job.total,job.cachedBytes+transfer.downloaded)};
    render();
  };
  transfer.addEventListener('progress',backgroundProgress);backgroundProgress();
}
async function resumeDownloads() {
  if(resumeWork)return resumeWork;
  if(window!==window.top||!connected||removed||restarting||downloading||!navigator.onLine||document.visibilityState!=='visible')return;
  resumeWork=(async()=>{
    await refresh();
    const job=snapshot.download;
    if(!job?.wanted)return;
    if(registration.backgroundFetch)await watchBackground(job.id);
    if(job.busy){
      if(job.state==='planning'){
        clearTimeout(resumeTimer);
        resumeTimer=setTimeout(resumeDownloads,Math.max(300,30000-(Date.now()-job.started)+300));
      }
      return;
    }
    if(snapshot.downloadRelease)await download(job.mode==='offline',{release:snapshot.downloadRelease,id:job.id});
  })().catch(failure=>error(failure.message)).finally(()=>{resumeWork=null;});
  return resumeWork;
}
function download(save,resume){
  // Automatic resume and a button press can meet while metadata or retention
  // is pending. They must join one request rather than start competing jobs.
  if(downloadWork)return downloadWork;
  downloadCancelled=false;localDownloadId=undefined;mode=save?'offline':'update';error();
  downloadWork=performDownload(save,resume).finally(()=>{downloadWork=null;render();});
  render();return downloadWork;
}
async function performDownload(save, resume) {
  const release=resume?.release||(save?runningRelease:latest);
  if(!release||downloading)return;
  if(connecting)await connecting;
  if(!connected)await connect();
  await runningMetadata;
  await remember();
  if(downloadCancelled)return;
  if(save&&snapshot.offlineReady&&!resume)return;
  if(!worker||removed||unavailable)await connect();
  downloading=true;error();render();
  showProgress({bytes:0,total:release.bytes});
  let handled=false,downloadId=resume?.id;
  const request={release,save:true,requestDownload:true,mode,downloadId};
  try {
    if(snapshot.downloadVersion!==1){const job=await legacyStart(release,mode,downloadId);downloadId=job.id;localDownloadId=downloadId;}
    if(downloadCancelled){if(snapshot.downloadVersion!==1)await legacyStop(downloadId);handled=true;return;}
    if(snapshot.downloadVersion===1&&registration.backgroundFetch){
      const plan=await rpc('DOWNLOAD_PLAN',request,showProgress);
      if(plan.ready){++refreshGeneration;snapshot=plan.status;unavailable=false;handled=true;return;}
      downloadId=plan.backgroundId;localDownloadId=downloadId;
      if(downloadCancelled){await rpc('CANCEL',{id:downloadId});handled=true;return;}
      let native;
      try {
        native=await registration.backgroundFetch.get(downloadId);
        if(!native&&!plan.existing)native=await registration.backgroundFetch.fetch(downloadId,plan.requests,{
          title:save?'GPU Lab offline download':'GPU Lab update',downloadTotal:plan.downloadTotal,
          icons:[{src:new URL('assets/icon-192.png',base).href,sizes:'192x192',type:'image/png'}],
        });
      } catch(failure) {
        // Background permission or storage may be unavailable even when the API
        // exists. Preserve the same request and use the resumable page path.
        if(failure.name==='AbortError'){await rpc('CANCEL',{id:downloadId});throw failure;}
      }
      if(native||plan.existing){
        if(native){
          try{await rpc('BACKGROUND_STARTED',{id:downloadId});}catch{/* STATUS recovers a started browser job after a worker restart. */}
          await refresh();
          if(snapshot.download?.id!==downloadId||(!snapshot.download.wanted&&snapshot.download.state!=='ready')){await native.abort();handled=true;return;}
          await watchBackground(downloadId);
        } else await refresh();
        handled=true;return;
      }
    }
    const result=await rpc('PREPARE',{...request,downloadId},showProgress);
    if(!result.downloadVersion){await legacyChange(downloadId,{wanted:false,state:'ready',bytes:release.bytes,error:null});snapshot={...result,...await legacyInfo(result)};}
    else snapshot=result;
    ++refreshGeneration;unavailable=false;runningRelease||=snapshot.runningRelease;
    handled=true;error();
  } catch(failure) {
    if(snapshot.downloadVersion!==1&&downloadId)await legacyChange(downloadId,job=>job?.wanted?{state:'paused',wanted:!downloadCancelled&&!/match the release|could not be verified/.test(failure.message),error:downloadCancelled?null:failure.message}:null).catch(()=>{});
    await refresh();
    if(!downloadCancelled&&!(snapshot.download?.wanted===false&&/abort/i.test(failure.message)))error(failure.message,'download-start');
  } finally {
    downloading=false;
    if(!handled)await refresh();
    render();
  }
}
$('running-version').append('Running ', document.querySelector('.build-info').cloneNode(true), ` · Build ${running.slice(0, 12)}`);
$('app-status-open').addEventListener('click', () => { dialog.showModal(); check(); if (!worker || removed) connect(); else refresh(); });
$('app-status-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => $('app-status-open').focus({ preventScroll: true }));
$('check-update').addEventListener('click', () => { check(true); refresh(); });
$('download-update').addEventListener('click', () => download(false));
$('save-offline').addEventListener('click', () => download(true));
$('cancel-download').addEventListener('click', async () => {
  downloadCancelled=true;cancelling=true;clearTimeout(resumeTimer);const id=downloading?localDownloadId:snapshot.download?.id;
  render();
  try{try{if(snapshot.downloadVersion!==1)await legacyStop(id);}finally{await rpc('CANCEL',{id:downloading?undefined:id});}await refresh();}
  catch(failure){error(failure.message);}
  finally{cancelling=false;render();}
});
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
  if (data?.type === 'DOWNLOAD_PROGRESS'&&snapshot.download?.id===data.id){snapshot.download={...snapshot.download,bytes:data.progress.bytes,stage:data.progress.stage,state:snapshot.download.state==='background'?'verifying':snapshot.download.state};render();}
  if (data?.type === 'OPEN_APP_STATUS'){if(!dialog.open)dialog.showModal();refresh();}
  if (data?.type === 'OFFLINE_REMOVED') { snapshot = {}; removed = true; render(); }
});
addEventListener('online', () => { lastCheck = 0; check();resumeDownloads(); });
addEventListener('offline', () => { checkingAbort?.abort('offline'); latest=null; version = 'Cannot check for updates'; render(); });
addEventListener('focus', () => { check();refresh();resumeDownloads(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { check();refresh();resumeDownloads(); }
  else { checkingAbort?.abort('hidden'); }
});
setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) check(); }, 60000);
addEventListener('load', remember, { once: true });
render(); check(); connect();
// Running metadata is immutable and small; it is not a course download.
runningMetadata=metadata(new URL(`releases/${running}/release.json`, base), AbortSignal.timeout(8000),{immutable:true}).then(({release:r}) => { if (r.id === running) { runningRelease = r; render(); remember(); } }).catch(() => {});

const downloadLink=new URL(location.href);
if(downloadLink.searchParams.get('download')==='1'){
  dialog.showModal();downloadLink.searchParams.delete('download');history.replaceState(history.state,'',downloadLink);
}
