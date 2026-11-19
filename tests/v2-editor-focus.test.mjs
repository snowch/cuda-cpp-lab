// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {v2Course} from '../content/v2-course.mjs';
import {starterFor} from '../content/v2-lesson-context.mjs';
import {practicalSource} from '../content/v2-practical-source.mjs';
import {insertProgramStarters} from '../content/v2-programs.mjs';
import {sourceFocusRanges,lessonSourceFocus} from '../src/v2-editor-focus.mjs';

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
