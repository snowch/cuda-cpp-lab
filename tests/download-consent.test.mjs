// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

async function harness(){
 const stores=new Map();let race=false,reads=0,release,rejectStop=false;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const files=stores.get(name);return {
  async match(url){const response=files.get(String(url))?.clone();if(race&&String(url).endsWith('__download_request_v1__')){reads++;if(reads===1)await new Promise(resolve=>{release=resolve;});if(reads===2)setTimeout(()=>release(),10);}return response;},
  async put(url,response){if(rejectStop&&String(url).endsWith('__download_request_v1__')&&!(await response.clone().json()).wanted)throw Object.assign(new Error('full'),{name:'QuotaExceededError'});files.set(String(url),response.clone());},async delete(url){return files.delete(String(url));}
 };}};
 const context=vm.createContext({URL,Request,Response,AbortController,AbortSignal,crypto:webcrypto,setTimeout,clearTimeout,console,caches,
  self:{registration:{scope:'https://example.test/cuda-cpp-lab/'},clients:{async matchAll(){return [];}},addEventListener(){}},
 });
 const contract=(await readFile(new URL('../src/release-contract.mjs',import.meta.url),'utf8')).replaceAll('export ','');
 vm.runInContext(contract+'\n'+await readFile(new URL('../scripts/service-worker.js',import.meta.url),'utf8'),context);
 return {run:code=>vm.runInContext(code,context),race:()=>{race=true;},rejectStop:()=>{rejectStop=true;},context};
}
const job={id:'gpu-lab-active',release:'1'.repeat(64),wanted:true,state:'foreground',mode:'update',bytes:1,total:10};

test('Cancel remains cancelled when an older network failure finishes reading state later',async()=>{
 const h=await harness();h.context.job=job;await h.run('writeDownload(job)');h.race();
 await h.run("Promise.all([failDownload(job.id,new Error('Network interrupted')),cancelDownload(job.id)])");
 assert.equal((await h.run('readDownload()')).wanted,false);
});

test('a stale window cannot cancel a newer download request',async()=>{
 const h=await harness();h.context.job={...job,id:'gpu-lab-new'};await h.run('writeDownload(job)');
 h.context.controller=new AbortController();h.run('operation=controller');
 await h.run("cancelDownload('gpu-lab-old')");
 assert.equal((await h.run('readDownload()')).wanted,true);
 assert.equal(h.context.controller.signal.aborted,false);
});


test('Cancel still aborts and removes retry consent when storage cannot record the stopped state',async()=>{
 const h=await harness();h.context.job=job;await h.run('writeDownload(job)');h.rejectStop();
 h.context.controller=new AbortController();h.run('operation=controller');
 await h.run('cancelDownload(job.id)');
 assert.equal(await h.run('readDownload()'),null);
 assert.equal(h.context.controller.signal.aborted,true);
});

test('Cancel during initial request persistence cannot become a resumable download',async()=>{
 const h=await harness();h.context.controller=new AbortController();h.run('operation=controller');
 await h.run('cancelDownload()');
 h.context.job=job;await h.run('writeDownload(job)');
 await h.run('failDownload(job.id,controller.signal.reason)');
 assert.equal((await h.run('readDownload()')).wanted,false);
});

test('damaged request metadata cannot authorise an automatic download or block a fresh request',async()=>{
 const h=await harness();
 await h.run("caches.open(META).then(c=>c.put(DOWNLOAD_REQUEST,new Response('{')))");
 assert.equal(await h.run('readDownload()'),null);
 h.context.job=job;await h.run('writeDownload(job)');
 assert.equal((await h.run('readDownload()')).wanted,true);
});
