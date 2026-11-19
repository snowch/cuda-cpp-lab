// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {v2Course} from '../content/v2-course.mjs';
import {starterFor} from '../content/v2-lesson-context.mjs';
import {practicalSource} from '../content/v2-practical-source.mjs';
import {insertProgramStarters} from '../content/v2-programs.mjs';
import {sourceFocusRanges,lessonSourceFocus} from '../src/v2-editor-focus.mjs';
import {renderV2Lesson} from '../content/v2-view.mjs';
import {cudaTokens,locateCudaExcerpt} from '../src/cuda-excerpts.mjs';

const excerptsFor=lesson=>[...renderV2Lesson(lesson,x=>x+'.html',x=>x+'.html','editor.html',starterFor('first-kernel'))
 .matchAll(/<pre\b[^>]*data-editor-excerpt[^>]*><code>([^]*?)<\/code><\/pre>/g)]
 .map(m=>m[1].replace(/&(lt|gt|amp|quot);/g,(_,key)=>({lt:'<',gt:'>',amp:'&',quot:'"'}[key])));

test('all 48 authored starter excerpts resolve to highlighted code across the 27 lessons',()=>{
 let count=0;
 for(const lesson of v2Course){
  const excerpts=excerptsFor(lesson);count+=excerpts.length;
  if(lesson.practical&&!lesson.program){assert.equal(excerpts.length,0);continue;}
  assert.ok(excerpts.length,lesson.slug);
  const source=lesson.practical?practicalSource(lesson.slug):starterFor(lesson.slug);
  const focus=sourceFocusRanges(source,lesson.mode||lesson.slug,excerpts);
  for(const excerpt of excerpts){
   const result=locateCudaExcerpt(source,excerpt);
   assert.deepEqual(result.missing,[],lesson.slug+': '+excerpt);
   for(const range of result.ranges)assert.ok(focus.excerpts.some(r=>r.index<=range.index&&r.end>=range.end),lesson.slug);
  }
 }
 assert.equal(count,48);
});

test('L1 readback matches separate statements without colouring the omitted error checks',()=>{
 const lesson=v2Course[0],source=starterFor(lesson.slug);
 const ranges=sourceFocusRanges(source,'hello',excerptsFor(lesson)).excerpts;
 for(const text of ['float value =','cudaMemcpy(&value','std::printf(']){
  const at=source.indexOf(text);assert.ok(ranges.some(r=>r.index<=at&&r.end>at),text);
 }
 const at=source.indexOf('if (result != cudaSuccess)',source.indexOf('cudaMemcpy(&value'));
 assert.ok(!ranges.some(r=>r.index<=at&&r.end>at));
});

test('excerpt locations follow formatting and literal edits, not comments, strings or unrelated calls',()=>{
 const excerpt='float value = 0.0f;\ncudaMemcpy(&value, output, sizeof(value), cudaMemcpyDeviceToHost);';
 const source='// '+excerpt.replaceAll('\n',' ')+'\n'+
  'printf("cudaMemcpy(&value, output, sizeof(value), cudaMemcpyDeviceToHost);");\n'+
  'float value = 9.5f;\nresult = cudaMemcpy(\n &value, /* keep this address */ output, sizeof(value),\n cudaMemcpyDeviceToHost);';
 const result=locateCudaExcerpt(source,excerpt);
 assert.deepEqual(result.missing,[]);assert.equal(result.ranges.length,2);
 assert.equal(source.slice(result.ranges[0].index,result.ranges[0].end),'float value = 9.5f;');
 assert.ok(result.ranges[1].index>source.indexOf('result ='));
 assert.deepEqual(locateCudaExcerpt('check(cudaMemcpy(&value, output, sizeof(value), cudaMemcpyDeviceToHost));',
  'cudaMemcpy(&value, output, sizeof(value), cudaMemcpyDeviceToHost);').missing,[]);
 assert.ok(locateCudaExcerpt(source,'cudaMemcpy(&other, output, sizeof(other), cudaMemcpyDeviceToHost);').missing.length);
 assert.ok(cudaTokens(source).every(t=>t.index>=0&&t.end<=source.length));
});

test('every editable lesson has its experiment location, kernels and launches',()=>{
 const lessons=v2Course.filter(l=>!l.practical||l.program);
 assert.equal(lessons.length,25);
 assert.deepEqual(Object.keys(lessonSourceFocus).sort(),lessons.map(l=>l.mode||l.slug).sort());
 for(const lesson of lessons){
  const source=lesson.practical?practicalSource(lesson.slug):starterFor(lesson.slug);
  const ranges=sourceFocusRanges(source,lesson.mode||lesson.slug);
  assert.ok(ranges.targets.length&&ranges.kernels.length&&ranges.launches.length,lesson.slug);
  assert.ok(ranges.targets.every(t=>source.slice(t.index,t.end).trim()),lesson.slug);
 }
});

test('focus follows edited code and ignores braces and fake launches in comments',()=>{
 const source=starterFor('first-kernel').replace('    output[0] = 42.0f;', '    // } hello<<<8,8>>>(output);\n    if (output) {\n        output[0] = 7.0f;\n    }');
 const ranges=sourceFocusRanges(source,'hello');
 assert.equal(ranges.kernels.length,1);
 assert.equal(ranges.launches.length,1);
 assert.equal(source.slice(ranges.targets[0].index,ranges.targets[0].end),'output[0] = 7.0f;');
 assert.ok(source.slice(ranges.kernels[0].index,ranges.kernels[0].end).endsWith('\n}'));
 assert.equal(sourceFocusRanges(source.replace('output[0] = 7.0f;','*output = 7.0f;'),'hello').targets.length,0);
});

test('the executable L1 starter matches its published example and checks CUDA without a helper',async()=>{
 const source=starterFor('first-kernel');
 assert.doesNotMatch(source,/\bcheck\s*\(/);
 assert.match(source,/cudaError_t result = cudaMalloc/);
 assert.match(source,/result = cudaGetLastError\(\);\s*if \(result != cudaSuccess\)/);
 assert.match(source,/result = cudaMemcpy[^;]*;\s*if \(result != cudaSuccess\)/);
 const html=await insertProgramStarters(readFileSync(new URL('../content/v2-cuda-source-workbench.html',import.meta.url),'utf8'));
 const prefix='<script>const lab = ';
 const line=html.split('\n').find(l=>l.startsWith(prefix));
 assert.equal(JSON.parse(line.slice(prefix.length).replace(/;$/,'')).firstProgram,source);
});
