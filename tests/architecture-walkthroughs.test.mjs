// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matrixExample,scalarAttention,cacheExample,tensorExample} from '../scripts/architecture-recording-models.mjs';
import {plans} from '../scripts/architecture-recording-stories.mjs';
import {v2CoreCourse} from '../content/v2-course.mjs';

test('matrix shots use the starter rows/columns and preserve every tile contribution',()=>{
 const m=matrixExample();
 for(let r=0;r<m.tile;r++)for(let c=0;c<m.tile;c++){
  const expected=m.a[r].reduce((sum,a,k)=>sum+a*m.b[k][c],0);
  assert.equal(m.sums[r][c],expected);
  const contributions=m.phases.map(p=>p.left[r].reduce((sum,a,k)=>sum+a*p.right[k][c],0));
  assert.equal(contributions.reduce((sum,x)=>sum+x,0),expected);
 }
 assert.equal(m.sums[0][0],3);
});

test('scalar attention grouping agrees with an independent full softmax',()=>{
 for(const tile of [1,2,4,8]){
  const a=scalarAttention(tile),max=Math.max(...a.keys),weights=a.keys.map(k=>Math.exp(k-max));
  const expected=weights.reduce((sum,w,i)=>sum+w*a.values[i],0)/weights.reduce((sum,w)=>sum+w,0);
  assert.ok(Math.abs(a.result-expected)<1e-12);
  assert.equal(a.trace.length,8/tile);
 }
});

test('history reads grow while one appended token and the collective tile stay fixed',()=>{
 const short=cacheExample(),long=cacheExample(8);
 assert.equal(long.readBytes,2*short.readBytes);
 assert.equal(short.appendBytes,long.appendBytes);
 assert.equal(short.appendBytes,2*short.width*Float32Array.BYTES_PER_ELEMENT);
 assert.ok(short.cached<long.cached&&long.cached<long.capacity);
 const zero=tensorExample(),five=tensorExample(5);
 assert.equal(zero.entries,256);assert.equal(five.warp,zero.warp);assert.equal(five.result-zero.result,5);
});

test('every remaining core lesson has an outcome and a separate prediction before its comparison',()=>{
 assert.deepEqual(plans.map(p=>p.slug),v2CoreCourse.slice(2).map(l=>l.slug));
 for(const plan of plans){
  assert.ok(plan.outcome&&plan.scope);
  const prediction=plan.scenes.findIndex(s=>s.prediction);
  assert.ok(prediction>0&&prediction<plan.scenes.length-1,plan.slug);
  assert.ok(plan.scenes[prediction].hold>=5);
  for(const shot of plan.scenes){assert.ok(shot.visual());assert.ok(shot.captions.every(t=>t.trim()));}
 }
});
