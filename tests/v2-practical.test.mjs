// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareOutputs, verificationCase, gridStride, blockScan, residency, softmax, checkSoftmax, analyseBenchmark } from '../src/v2-practical-model.mjs';
import { practicalLessons } from '../content/v2-practical-catalog.mjs';
import { practicalSource } from '../content/v2-practical-source.mjs';
import { renderV2Lesson } from '../content/v2-view.mjs';
import { v2Course } from '../content/v2-course.mjs';
test('numerical checks reject missing, nonfinite and incorrect values; uniform data can hide a transpose',()=>{
 assert.equal(verificationCase('ones','transpose').ok,true);
 assert.equal(verificationCase('matrix','transpose').ok,false);
 for(const c of ['unwritten','infinity'])assert.equal(verificationCase('matrix',c).ok,false);
 assert.equal(verificationCase('matrix','roundoff').ok,true);
 assert.equal(compareOutputs([1],[1,2]).ok,false);
 assert.equal(compareOutputs([NaN],[NaN]).ok,false);
 assert.equal(compareOutputs([Infinity],[Infinity]).ok,false);
 assert.throws(()=>verificationCase('wrong'));
});
test('grid-stride coverage is unique for every supported length and launch',()=>{
 for(const n of [0,1,31,32,33,63,64,65,70,129,4096])for(const b of [1,2,4]){
  const m=gridStride(n,b),seen=m.visits.flat().sort((a,b)=>a-b);
  assert.deepEqual(seen,Array.from({length:n},(_,i)=>i));
  assert.equal(m.blocks,n?b:0);
  for(let i=0;i<n;i++)assert.equal(m.owners[i],i%(b*32));
 }
 for(const n of [-1,4097,NaN,1.5])assert.throws(()=>gridStride(n));
});
test('two-level scan equals an independent serial prefix including all tails',()=>{
 for(let n=0;n<=1024;n++){
  const m=blockScan(n);let sum=0;
  assert.deepEqual(m.output,m.input.map(v=>{const previous=sum;sum+=v;return previous;}));
  assert.equal(m.total,sum);assert.equal(m.blocks.reduce((s,b)=>s+b.total,0),sum);
 }
 assert.throws(()=>blockScan(1025));
});
test('resource bound uses all limits and exposes ties without a timing claim',()=>{
 assert.equal(residency().blocks,4);assert.equal(residency().occupancy,.5);
 assert.equal(residency(256,96,16).blocks,2);
 assert.deepEqual(residency(128,16,4).limiting,['shared','warps','threads','blocks']);
 assert.throws(()=>residency(1000));
});
test('stable softmax has shift invariance, uniform row and explicit failed submissions',()=>{
 const a=softmax([-2,0,1]).output,b=softmax([1000,1002,1003]).output;
 assert.deepEqual(a,b);assert.deepEqual(softmax([4,4,4]).output,[1/3,1/3,1/3]);
 assert.equal(checkSoftmax('ordinary',a.join(', ')).ok,true);
 for(const s of ['0 0 1','NaN 0 1','1 0','Infinity 0 1'])assert.equal(checkSoftmax('ordinary',s).ok,false);
 assert.throws(()=>checkSoftmax('ordinary',''));assert.throws(()=>softmax([]));
});
test('timing import computes medians and rejects incomplete or nonfinite evidence',()=>{
 const report={schema:1,scope:'kernel-only',gpu:'test fixture, not measured',elements:3,checked_elements:3,warmup:10,repetitions:200,samples_ms:{separate:[3,1,2],fused:[1,1.5,.5]}};
 assert.equal(analyseBenchmark(report).ratio,2);assert.equal(analyseBenchmark(report).overlap,true);
 for(const change of [{checked_elements:2},{scope:'simulated'},{samples_ms:{separate:[1,2,3],fused:[1,NaN,3]}}])assert.throws(()=>analyseBenchmark({...report,...change}));
});
test('six practical routes retain readable source, hidden results, local questions and navigation',()=>{
 assert.equal(v2Course.length,27);
 for(const lesson of practicalLessons){
  const html=renderV2Lesson(lesson,s=>s+'.html',s=>'../lessons/'+s+'.html','./cuda-source-workbench.html');
  assert.match(html,/data-practical-result hidden/);assert.match(html,/PyTorch/);
  assert.equal((html.match(/class="v2-reference-question"/g)||[]).length,2);
  assert.match(html,/Hardware context/);assert.match(html,/Compare your explanation/);
  if(lesson.program)assert.match(html,new RegExp('data-kernel-workbench="'+lesson.slug+'"'));
 }
 const scaffold=practicalSource('softmax-capstone');assert.match(scaffold,/deliberately fails verification/);
 const solution=readFileSync('examples/v2-practical/softmax-reference.cu','utf8');
 assert.equal(scaffold.slice(scaffold.indexOf('int main(')),solution.slice(solution.indexOf('int main(')));
});
test('published trace retains device and event metadata with explicit provenance',()=>{
 const trace=JSON.parse(readFileSync('examples/v2-practical/recorded-trace.json','utf8'));
 assert.equal(trace.traceEvents.length,8);assert.equal(trace.traceEvents[0].dur,2);
 assert.equal(trace.traceEvents[1].dur,605);assert.equal(trace.deviceProperties[0].name,'Tesla V100-DGXS-32GB');
 assert.match(readFileSync('examples/v2-practical/TRACE-SOURCE.md','utf8'),/unknown/);
});

test('a model-only preview exposes its controls and links to an actual CUDA editor',()=>{
 for(const lesson of practicalLessons.filter(lesson=>lesson.program)){
  const html=renderV2Lesson(lesson,s=>s+'.html',s=>'../lessons/'+s+'.html');
  assert.match(html,/This preview shows code and models/);
  assert.match(html,/open the CUDA editor on the course site/);
  assert.doesNotMatch(html,/data-kernel-workbench=|class="more-settings v2-practice-model"/);
  assert.match(html,/complete CUDA program is read-only/);
 }
});
