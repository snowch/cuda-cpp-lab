// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {steps,simulateIntro,kernelSource,pythonSource,launchPlan,launchSource,boundsSource,introPrompt,inspectLaunch} from '../src/hello-model.mjs';
test('intro diagram and outputs derive from thread indices and selected multiplier',()=>{
 for(let stage=0;stage<steps.length;stage++)for(const factor of [-10,-0.5,0,2,3,10]){
  const r=simulateIntro(stage,factor);
  assert.deepEqual(r.input,[1,2,3,4,5]);
  assert.deepEqual(r.output,r.input.map(x=>Math.fround(x*Math.fround(factor))));
  assert.equal(r.safe,true);
  for(const t of r.threads) {
   assert.equal(t.block*r.size+t.local,t.i);
   assert.equal(t.skipped,t.i>=r.input.length);
   if(!t.skipped){assert.equal(t.input,r.input[t.i]);assert.equal(t.output,r.output[t.i]);}
  }
 }
 const unsafe=simulateIntro(3,2,false);
 assert.equal(unsafe.safe,false);
 assert.deepEqual(unsafe.threads.filter(t=>t.invalid).map(t=>t.i),[5,6,7]);
 assert.deepEqual(simulateIntro(2,2).threads.map(t=>t.block),[0,0,0,0,1,1,1,1]);
 assert.throws(()=>simulateIntro(0,NaN));
 assert.throws(()=>simulateIntro(0,11));
 assert.throws(()=>simulateIntro(9,2));
 assert.match(kernelSource(3),/input\[i\] \* 3.0f/);
});

test('new-case launch plans cover each input and identify only surplus threads',()=>{
  for(let count=1;count<=32;count++){
    const p=launchPlan(count);
    assert.equal(p.size,4);
    assert.ok(p.threads>=count&&p.threads-count<4);
    assert.equal(p.blocks*4,p.threads);
    assert.deepEqual(p.skipped,Array.from({length:p.threads-count},(_,i)=>count+i));
  }
  for(const count of [0,33,1.5,NaN])assert.throws(()=>launchPlan(count));
});

test('bounds excerpts match the guarded function and expose only the diagnostic body without a check',()=>{
  for(const factor of [-0.5,2,3.25]) {
    const guarded=boundsSource(factor);
    assert.ok(kernelSource(factor).includes('    '+guarded.replaceAll('\n','\n    ')));
    assert.match(guarded,/if \(i < n\)/);
    assert.doesNotMatch(boundsSource(factor,false),/if/);
    assert.ok(guarded.includes(boundsSource(factor,false)));
  }
});

test('regrouping preserves outputs and array indices while changing block membership',()=>{
 const four=simulateIntro(4,2,true,4),eight=simulateIntro(4,2,true,8);
 assert.deepEqual(four.output,eight.output);
 assert.equal(four.blocks,2);assert.equal(eight.blocks,1);
 assert.equal(four.threads[4].block,1);assert.equal(eight.threads[4].block,0);
 assert.equal(four.threads[4].local,0);assert.equal(eight.threads[4].local,4);
 for(const size of [4,8]){
  const state=simulateIntro(4,2,true,size),plan=launchPlan(5,size);
  assert.equal(state.blocks,plan.blocks);
  assert.deepEqual(state.threads.filter(t=>t.skipped).map(t=>t.i),plan.skipped);
  for(const t of state.threads)assert.equal(t.block*size+t.local,t.i);
 }
 for(const size of [0,1.5,33,NaN]){
  assert.throws(()=>simulateIntro(4,2,true,size));
  assert.throws(()=>launchPlan(5,size));
 }
 const source=launchSource(1,8);
 const declaration=source.match(/int n = (\d+);/);
 assert.ok(declaration);
 assert.equal(Number(declaration[1]),simulateIntro(0,2).input.length);
 assert.ok(source.indexOf(declaration[0])<source.indexOf('runKernel<<<'));
 assert.match(source,/d_input, d_output, n/);
 assert.match(launchSource(1,8),/int threadsPerBlock = 8;/);
 assert.match(launchSource(1,8),/int blocks = 1;/);
 assert.match(launchSource(1,8),/runKernel<<<blocks, threadsPerBlock>>>/);
});

test('diagnostics distinguish off-by-one access, missing work and safe surplus work',()=>{
 const changed=inspectLaunch(5,4,2,'<=');
 assert.deepEqual(changed.threads.filter(t=>t.invalid).map(t=>t.i),[5]);
 assert.deepEqual(changed.threads.filter(t=>t.skipped).map(t=>t.i),[6,7]);
 assert.equal(changed.threads[5].output,null);
 const fixed=inspectLaunch(5,4,2);
 assert.deepEqual(fixed.threads.filter(t=>t.skipped).map(t=>t.i),[5,6,7]);
 const short=inspectLaunch(9,4,2);
 assert.equal(short.safe,true);assert.deepEqual(short.missing,[8]);assert.equal(short.output[8],null);
 for(const blocks of [3,4]){
   const complete=inspectLaunch(9,4,blocks);
   assert.equal(complete.safe,true);assert.deepEqual(complete.missing,[]);
   assert.deepEqual(complete.output,[2,4,6,8,10,12,14,16,18]);
   assert.equal(complete.threads.filter(t=>t.skipped).length,blocks*4-9);
 }
 for(const args of [[0,4,2],[5,0,2],[5,4,0],[5,4,9],[5,4,2,'>']])assert.throws(()=>inspectLaunch(...args));
});
