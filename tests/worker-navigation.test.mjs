// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
import vm from 'node:vm';
const base='https://example.test/gpu-lab/',prefix=`gpu-lab:${base}:`;
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64);
async function machine({state={active:A,saved:true},network=()=>new Response('latest'),denied=false,clients=[],beforeRead=async()=>{}}={}){
 const stores=new Map(),handlers=new Map(),requests=[];
 const caches={async open(name){
  if(denied)throw Error('Storage denied');
  if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);
  return {async match(url){await beforeRead(String(url));return entries.get(String(url))?.clone();},async put(url,response){entries.set(String(url),response.clone());},async keys(){return [...entries.keys()].map(url=>new Request(url));}};
 },async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
 async function put(name,path,body){await(await caches.open(name)).put(new URL(path,base),new Response(typeof body==='string'?body:JSON.stringify(body)));}
 if(!denied)await put(prefix+'status-v1','__app_status_state__',state);
 const context=vm.createContext({URL,Request,Response,AbortController,AbortSignal,crypto:webcrypto,console,setTimeout,clearTimeout,caches,
  mediaRangeResponse:(_,response)=>response,
  self:{registration:{scope:base},clients:{async matchAll(){return clients;}},addEventListener(type,fn){handlers.set(type,fn);}},
  async fetch(request,options){const url=typeof request==='string'||request instanceof URL?String(request):request.url;requests.push({url,cache:request.cache||options?.cache});return network(url);},
 });
 const contract=(await readFile(new URL('../src/release-contract.mjs',import.meta.url),'utf8')).replaceAll('export ','');
 vm.runInContext(contract+'\n'+await readFile(new URL('../scripts/service-worker.js',import.meta.url),'utf8'),context);
 async function request(path,{destination='document',replacesClientId='',mode='navigate',referrer=''}={}){
  let response;const headers=new Headers();
  handlers.get('fetch')({request:{url:new URL(path,base).href,referrer,method:'GET',mode,destination,headers},replacesClientId,clientId:'',respondWith(work){response=work;}});
  return response;
 }
 // Node cannot construct navigation Requests. The worker clones the request for
 // network fetch; supply an equivalent request there while preserving event mode.
 context.Request=class extends Request{constructor(input,init){super(input?.url||input,init);}};
 async function rpc(type,data={}){
  let work;const messages=[];
  handlers.get('message')({source:{id:'reader',url:base+'index.html'},ports:[{postMessage(value){messages.push(value);}}],data:{type,running:A,...data},waitUntil(value){work=value;}});
  await work;const message=messages.at(-1);if(message.error)throw Error(message.error);return message.result;
 }
 return {request,put,stores,requests,context,caches,rpc};
}

test('online navigation reads current pages while saved and open document assets remain versioned',async()=>{
 const m=await machine();await m.put(prefix+'release-'+A,'index.html','saved old page');await m.put(prefix+'release-'+A,'src/app.mjs','old script');await m.put(prefix+'release-'+B,'editor.html','new editor');
 assert.equal(await(await m.request('index.html')).text(),'latest');
 assert.equal(m.requests[0].url,base+'index.html');assert.equal(m.requests[0].cache,'no-store');
 assert.equal(await(await m.request('releases/'+A+'/src/app.mjs',{destination:'script',mode:'cors'})).text(),'old script');
 assert.equal(await(await m.request('editor.html?embed=hello&gpu-release='+B,{destination:'iframe'})).text(),'new editor');
 assert.equal(m.requests.length,1,'Opening a new online page must not download the book or replace versioned assets');
 assert.equal(JSON.parse(await(await(await m.caches.open(prefix+'status-v1')).match(base+'__app_status_state__')).text()).active,A);
});

test('offline and server failures fall back to the saved copy; retired-page 404s remain honest',async()=>{
 for(const network of [()=>{throw Error('Offline');},()=>new Response('Unavailable',{status:503}),
  ()=>new Response(new ReadableStream({start(controller){controller.error(Error('Connection lost during HTML'));}}),{headers:{'Content-Type':'text/html'}})]){
  const m=await machine({network});await m.put(prefix+'release-'+A,'index.html','saved offline page');
  assert.equal(await(await m.request('index.html')).text(),'saved offline page');
 }
 const missing=await machine({network:()=>new Response('Retired',{status:404})});await missing.put(prefix+'release-'+A,'index.html','obsolete page');
 assert.equal((await missing.request('index.html')).status,404);
 const noStorage=await machine({denied:true});assert.equal(await(await noStorage.request('index.html')).text(),'latest','Online reading cannot depend on offline storage permission');
});

test('a committed restart reloads its verified version once; subsequent online navigation is fresh',async()=>{
 const m=await machine({state:{active:B,saved:true,restartToken:'committed'}});
 await m.put(prefix+'release-'+B,'index.html','verified prepared page');
 await m.put(prefix+'status-v1','__restart_navigation__',{token:'committed',release:B,clients:['old-window']});
 assert.equal(await(await m.request('index.html',{replacesClientId:'old-window'})).text(),'verified prepared page');
 assert.equal(m.requests.length,0,'A coordinated restart must use the exact prepared bytes');
 assert.equal(await(await m.request('index.html',{replacesClientId:'replacement-window'})).text(),'latest');
 await m.put(prefix+'status-v1','__restart_navigation__',{token:'aborted',release:B,clients:['old-window']});
 assert.equal(await(await m.request('index.html',{replacesClientId:'old-window'})).text(),'latest','An aborted ticket cannot act as a committed restart');
});

test('uncached offline navigation gives a usable recovery page without saving the course or caching the error',async()=>{
 for(const denied of [false,true]){
  const m=await machine({state:{active:A,saved:false},denied,network:()=>{throw Error('Offline');}});
  const response=await m.request('next.html?x=1&y=2',{referrer:base+'index.html?keep=1&draft=7'});
  assert.equal(response.status,503);assert.match(response.headers.get('Content-Type'),/text\/html/);
  const html=await response.text();assert.match(html,/This lesson isn’t saved offline/);assert.match(html,/Choose Save offline copy/);
  assert.match(html,/href="https:\/\/example.test\/gpu-lab\/index.html\?keep=1&amp;draft=7"/);
  assert.match(html,/next.html\?x=1&amp;y=2/);assert.match(html,/Back to previous lesson/);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  if(!denied)assert.equal(await(await m.caches.open(prefix+'release-'+A)).match(base+'next.html'),undefined);
 }
 const direct=await machine({state:{},network:()=>{throw Error('Offline');}});
 const html=await(await direct.request('next.html',{referrer:'https://other.test/'})).text();
 assert.match(html,/Course overview/);assert.ok(!html.includes('https://other.test/'));
});

test('missing or corrupt saved HTML requests repair; verified pending copies offer restart without replacing the saved selection',async()=>{
 const file=(path,body)=>({path,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')});
 const release={schema:1,id:A,commit:null,date:null,files:[file('index.html','page'),file('next.html','next')],bytes:8};
 for(const corrupt of [false,true]){
  const m=await machine({network:()=>{throw Error('Offline');}});
  await m.put(prefix+'release-'+A,'__release_manifest__',release);await m.put(prefix+'release-'+A,'index.html','page');
  if(corrupt)await m.put(prefix+'release-'+A,'next.html','corrupt saved HTML');
  const html=await(await m.request('next.html')).text();assert.match(html,/This offline copy needs repair/);assert.match(html,/Choose Repair offline copy/);
  assert.equal((await m.rpc('STATUS')).active,A);
 }
 const unknown=await machine({network:()=>{throw Error('Offline');}});
 await unknown.put(prefix+'release-'+A,'__release_manifest__',release);
 await unknown.put(prefix+'release-'+A,'index.html','page');await unknown.put(prefix+'release-'+A,'next.html','next');
 const unknownHTML=await(await unknown.request('retired.html')).text();assert.match(unknownHTML,/This page isn’t in the saved course/);
 assert.ok(!unknownHTML.includes('Choose Repair offline copy'));assert.equal((await unknown.rpc('STATUS')).offlineReady,true);
 const m=await machine({state:{active:A,saved:false,pending:B,pendingSaved:true},network:()=>{throw Error('Offline');}});
 await m.put(prefix+'release-'+B,'__release_manifest__',{...release,id:B});
 await m.put(prefix+'release-'+B,'index.html','page');await m.put(prefix+'release-'+B,'next.html','next');
 const html=await(await m.request('next.html')).text();assert.match(html,/Your saved update is ready/);assert.match(html,/Choose Restart to update/);
 const state=await m.rpc('STATUS');assert.equal(state.active,A);assert.equal(state.pending,B);
});

test('observed damage invalidates an overlapping verification before it can report offline readiness',async()=>{
 let releaseScan,markStarted,allow=false;
 const gate=new Promise(resolve=>releaseScan=resolve),started=new Promise(resolve=>markStarted=resolve);
 const m=await machine({network:()=>{throw Error('Offline');},beforeRead:async url=>{
  if(url===base+'z.bin'&&!allow){markStarted();await gate;}
 }});
 const bodies={'index.html':'page','next.html':'next','a.bin':'a','b.bin':'b','z.bin':'last'};
 const files=Object.entries(bodies).map(([path,body])=>({path,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')}));
 await m.put(prefix+'release-'+A,'__release_manifest__',{schema:1,id:A,commit:null,date:null,files,bytes:files.reduce((sum,file)=>sum+file.bytes,0)});
 for(const [path,body] of Object.entries(bodies))await m.put(prefix+'release-'+A,path,body);
 const checking=m.rpc('STATUS');await started;
 await m.put(prefix+'release-'+A,'next.html','damaged after this file was checked');
 assert.match(await(await m.request('next.html')).text(),/This offline copy needs repair/);
 allow=true;releaseScan();assert.equal((await checking).offlineReady,false);
 assert.equal((await m.rpc('STATUS')).offlineReady,false);
});

test('an open version can recover unchanged live files but never substitutes changed bytes',async()=>{
 const body='unchanged original script',path='src/app.mjs';
 const file={path,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')};
 for(const current of [body,'different current script']){
  const m=await machine({network:url=>{
   const response=new Response(url.includes('/releases/')?'removed':current,{status:url.includes('/releases/')?404:200});
   Object.defineProperty(response,'url',{value:url});return response;
  }});
  await m.put(prefix+'release-'+A,'__release_manifest__',{schema:1,id:A,commit:null,date:null,files:[{path:'index.html',bytes:0,sha256:createHash('sha256').update('').digest('hex')},file],bytes:file.bytes});
  const response=await m.request('releases/'+A+'/'+path,{destination:'script',mode:'cors'});
  assert.equal(response.status,current===body?200:503);
  const stored=await(await m.caches.open(prefix+'release-'+A)).match(base+path);
  if(current===body){assert.equal(response.url,'','Relative imports must use the original versioned request, not the live alias URL');assert.equal(await response.text(),body);assert.equal(await stored.text(),body);}
  else assert.equal(stored,undefined,'Changed bytes cannot enter an older version');
 }
});

test('pruning keeps saved, recently visited and open versions plus legacy/sibling copies',async()=>{
 const m=await machine({state:{active:A,saved:true,visited:C},clients:[{id:'open',url:base+'index.html'}]});
 for(const id of [A,B,C,D])await m.put(prefix+'release-'+id,'index.html',id);
 await m.put(prefix+'legacy-complete','index.html','legacy');await m.put('sibling-app','index.html','other');
 vm.runInContext(`seen.set('open','${B}')`,m.context);await vm.runInContext('prune()',m.context);
 for(const id of [A,B,C])assert.ok(m.stores.has(prefix+'release-'+id));
 assert.ok(!m.stores.has(prefix+'release-'+D));assert.ok(m.stores.has(prefix+'legacy-complete'));assert.ok(m.stores.has('sibling-app'));
});

test('recognising a complete copy never downloads missing bytes or overrides a cancelled selection',async()=>{
 const file=(path,body)=>({path,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')});
 const release={schema:1,id:A,commit:null,date:null,files:[file('index.html','page'),file('example.cu','code')],bytes:8};
 const m=await machine({state:{active:A,saved:false}});
 await m.put(prefix+'release-'+A,'__release_manifest__',release);await m.put(prefix+'release-'+A,'index.html','page');
 const incomplete=await m.rpc('PREPARE',{release,save:true,recogniseOnly:true});assert.equal(incomplete.offlineReady,false);assert.equal(m.requests.length,0);
 await m.put(prefix+'release-'+A,'example.cu','code');
 const complete=await m.rpc('PREPARE',{release,save:true,recogniseOnly:true});assert.equal(complete.offlineReady,true);assert.equal(m.requests.length,0);
 await m.put(prefix+'status-v1','__app_status_state__',{active:A,saved:false,partial:A});
 const cancelled=await m.rpc('PREPARE',{release,save:true,recogniseOnly:true});assert.equal(cancelled.saved,false);assert.equal(cancelled.partial,A);assert.equal(m.requests.length,0);
 const legacy=await machine({state:{active:A,saved:false},network:()=>new Response('code')});
 await legacy.put(prefix+'release-'+A,'index.html','page');
 const saved=await legacy.rpc('PREPARE',{release,save:true});assert.equal(saved.offlineReady,true);assert.equal(legacy.requests.length,1,'An older explicit Save request must still fetch its missing file');
});
