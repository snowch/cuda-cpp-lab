// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {smFrame,smEvents} from '../src/sm-hardware-model.mjs';

test('SM walkthrough keeps each warp’s register values separate while reusing arithmetic hardware',()=>{
 const initial=smFrame();assert.ok(initial.warps.every(w=>w.loaded===null&&w.output===null));
 const a=smFrame(4);
 assert.equal(a.warps[0].status,'Ready to store');
 assert.equal(a.warps[1].status,'Waiting for input');
 assert.equal(a.arithmetic.warp,'A');
 const b=smFrame(7);
 assert.equal(b.arithmetic.warp,'B');
 assert.deepEqual(b.warps[0].loaded,a.warps[0].loaded);
 assert.deepEqual(b.warps[0].result,a.warps[0].result);
 assert.equal(b.warps[1].output,null);
 const final=smFrame(smEvents.length-1);
 assert.deepEqual(final.warps.flatMap(w=>w.output),Array.from({length:64},(_,i)=>(i+1)*2));
 for(let i=0;i<smEvents.length;i++)for(const warp of smFrame(i).warps){
  assert.equal(warp.input.length,32);
  if(warp.result)assert.deepEqual(warp.result,warp.loaded.map(x=>x*2));
  if(warp.output)assert.deepEqual(warp.output,warp.result);
 }
 assert.throws(()=>smFrame(-1));assert.throws(()=>smFrame(9));assert.throws(()=>smFrame(1.5));
});
