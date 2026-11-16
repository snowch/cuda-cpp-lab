// Copyright © 2026 Christopher Snow.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { v2Course } from '../content/v2-course.mjs';
import { v2Diagram } from '../content/v2-diagrams.mjs';
import { renderV2Lesson } from '../content/v2-view.mjs';
import { guidedLessons } from '../src/v2-guided.mjs';
import { runTrace } from '../src/v2-traces.mjs';
import { v2Run } from '../src/v2-model.mjs';

test('the multiplier updates the visible kernel, full program and FP32 results', () => {
  const run = v2Run('scale', 0.5);
  assert.deepEqual(run.output, [0.5, 1, 1.5, 2, 2.5]);
  assert.match(run.excerpt, /input\[i\] \* 0\.5f/);
  assert.ok(run.source.includes(run.excerpt));
  assert.throws(() => v2Run('scale', '3'), RangeError);
});

test('launch variants cover five values and retain the same bounds guard', () => {
  assert.deepEqual(v2Run('bounds', 4).skipped, [5, 6, 7]);
  assert.deepEqual(v2Run('bounds', 3).skipped, [5]);
  const run = v2Run('bounds', 8);
  assert.equal(run.blocks, 1);
  assert.deepEqual(run.skipped, [5, 6, 7]);
  assert.deepEqual(run.threads.slice(5).map(thread => thread.output), [null, null, null]);
  assert.match(run.source, /if \(i < n\)/);
  assert.match(run.source, /threadsPerBlock = 8/);
});

test('copy steps come from the complete program and reflect array size', () => {
  const five = v2Run('copies', 5);
  const nine = v2Run('copies', 9);
  assert.equal(five.bytes, 20);
  assert.equal(nine.bytes, 36);
  assert.equal(nine.blocks, 3);
  assert.equal(nine.output.at(-1), 18);
  let previous = 0;
  const source = nine.source.replace(/^  /gm, '');
  for (const phase of nine.phases) {
    const location = source.indexOf(phase.code);
    assert.ok(location > previous, phase.label);
    previous = location;
  }
});


const expected = {
  coalescing: [4, 8, 32],
  scheduling: [1, 2],
  divergence: [1, 2, 2],
  reduction: [2, 4],
  'shared-memory-banks': [32, 1, 1],
  matmul: [128, 64, 32],
  precision: [0, 8, 8],
  'tensor-cores': [16, 20],
  attention: [128, 0, 0],
  inference: [16, 64, 256],
  'matmul-investigation': [8, 4, 1],
  histograms: [8, 6],
  scan: [3, 2],
  compaction: [3, 3, -1],
  progress: [4, 2],
  pipelines: [10, 5],
  'token-routing': [5, 4],
};

test('the 20 model lessons have exercises, transfer prompts and local CUDA references', () => {
  assert.equal(new Set(v2Course.map(lesson => lesson.slug)).size, 21);
  assert.equal(Object.keys(guidedLessons).length, 17);
  for (const lesson of v2Course.slice(1)) {
    const page = renderV2Lesson(lesson, slug => slug + '.html', slug => '../lessons/' + slug + '.html');
    assert.doesNotMatch(page, /Planned lesson/);
    assert.match(page, /id="v2-run"/);
    assert.match(page, /id="v2-result" hidden/);
    assert.match(page, /Compare your explanation/);
    assert.match(page, /Compare your answer/);
    assert.match(page, /docs.nvidia.com/);
    assert.doesNotMatch(page, /Explore this topic in GPU Lab V1/);
  }
});

test('the first lesson introduces a single launch before array indexing', () => {
  const [first, second] = v2Course;
  const page = renderV2Lesson(first, slug => slug + '.html', slug => '../lessons/' + slug + '.html',
    './cuda-source-workbench.html', readFileSync(new URL('../examples/first-kernel.cu', import.meta.url), 'utf8'));
  assert.equal(first.slug, 'first-kernel');
  assert.match(page, /data-kernel-workbench="hello"/);
  assert.doesNotMatch(page, /data-kernel-workbench="scale"|id="v2-run"/);
  assert.ok(page.includes(second.slug + '.html'));
  const opening = page.indexOf('id="v2-first-source"');
  const launch = page.indexOf('id="v2-first-launch"');
  const editor = page.indexOf('data-kernel-workbench="hello"');
  const diagram = page.indexOf('class="v2-diagram"');
  const recording = page.indexOf('Watch the kernel launch');
  const references = page.indexOf('id="v2-first-references"');
  assert.ok(opening >= 0 && opening < launch && launch < editor && editor < diagram &&
    diagram < recording && recording < references);
  assert.match(page, /hello&lt;&lt;&lt;1, 1&gt;&gt;&gt;\(output\);/);
  assert.match(page, /kind="captions"/);
  assert.doesNotMatch(page, /Explore this topic in GPU Lab V1/);
});

test('every guided source variant produces its expected prediction and trace', () => {
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(guidedLessons).sort());
  for (const [slug, lesson] of Object.entries(guidedLessons)) {
    const sources = new Set();
    const answers = lesson.cases.map(([value]) => {
      sources.add(lesson.code(value));
      const result = runTrace(slug, value);
      assert.ok(result.frames.length > 0, slug);
      assert.ok(result.frames.every(frame => frame.length > 0), slug);
      return result.answer;
    });
    assert.equal(sources.size, lesson.cases.length, slug);
    assert.deepEqual(answers, expected[slug], slug);
  }
});

test('original concept diagrams use the local launch and address-model cases', () => {
  const indices = v2Diagram('more-threads-than-elements');
  const sectors = v2Diagram('coalescing');
  assert.match(indices, /Block 1<\/th><td>4<span>Write<\/span><\/td>/);
  assert.match(indices, /7<span>Skip<\/span>/);
  assert.match(sectors, /Bytes 32–63/);
  assert.match(sectors, /Sector 1<\/strong><span>Lanes 4, 5, 6, 7/);
});

import { lessonContexts, starterFor } from '../content/v2-lesson-context.mjs';
import { renderV2Hardware } from '../content/v2-hardware.mjs';
import { referenceTopics } from '../content/v2-references.mjs';
import media from '../content/v2-media.json' with {type:'json'};

test('each lesson connects its actual CUDA starter to execution, hardware and references', () => {
  for (const lesson of v2Course.slice(1)) {
    const context = lessonContexts[lesson.slug];
    const source = starterFor(lesson.slug).replace(/^ +/gm, '');
    assert.ok(source.includes(context.code.replace(/^ +/gm, '')), lesson.slug);
    for (const launch of context.launches.split('\n').filter(line => line.includes('<<<'))) {
      assert.ok(source.includes(launch.trim()), lesson.slug);
    }
    const page = renderV2Lesson(lesson, s => s + '.html', s => '../lessons/' + s + '.html', './cuda-source-workbench.html');
    const positions = ['id="v2-starter-source"', 'data-kernel-workbench=', 'id="v2-execution-title"', 'id="v2-hardware-title"', 'id="v2-apply"', 'id="v2-video"', 'id="v2-references"'].map(token => page.indexOf(token));
    assert.ok(positions.every((n,i)=>n>=0 && (!i || n>positions[i-1])), lesson.slug);
    assert.match(page, /kind="captions"/);
    assert.ok(media[lesson.slug].durationSeconds > 0);
    for (const key of context.references) assert.match(referenceTopics[key][0], /^https:\/\//);
    for (const file of ['recap.mp4','poster.jpg','captions.vtt']) {
      assert.ok(readFileSync(new URL('../assets/media/v2/' + lesson.slug + '/' + file, import.meta.url)).length > 0);
    }
    assert.equal(readFileSync(new URL('../assets/media/v2/' + lesson.slug + '/recap.mp4', import.meta.url)).length, media[lesson.slug].bytes);
    const captions = readFileSync(new URL('../assets/media/v2/' + lesson.slug + '/captions.vtt', import.meta.url), 'utf8')
      .split('\n').filter(line => line && line !== 'WEBVTT' && !line.includes(' --> ')).join(' ');
    const transcript = [context.explanation, context.stages.map(([a,b]) => a + '. ' + b).join(' '), context.hardware].join(' ');
    assert.equal(captions, transcript, lesson.slug + ' captions must match the visible transcript');

  }
});

test('hardware context introduces resources progressively without physical thread-unit mapping', () => {
  const first = renderV2Hardware('first-kernel');
  const scheduling = renderV2Hardware('scheduling');
  const reduction = renderV2Hardware('reduction');
  const matrix = renderV2Hardware('tensor-cores');
  assert.doesNotMatch(first, /data-hardware="scheduler"|data-hardware="shared"|data-hardware="tensor"/);
  assert.match(scheduling, /data-hardware="scheduler"/);
  assert.match(scheduling, /data-hardware="registers"/);
  assert.doesNotMatch(scheduling, /data-hardware="shared"|data-hardware="tensor"/);
  assert.match(reduction, /data-hardware="shared"/);
  assert.match(matrix, /data-hardware="tensor"/);
  assert.match(matrix, /Simplified NVIDIA-style architecture/);
});

test('editor introductions do not present synthetic model assumptions as CUDA run inputs', () => {
  for (const lesson of v2Course.filter(lesson => lessonContexts[lesson.slug]?.introduction)) {
    const page = renderV2Lesson(lesson, s => s + '.html', s => '../lessons/' + s + '.html', './cuda-source-workbench.html');
    const editor = page.indexOf('data-kernel-workbench=');
    const model = page.indexOf('Explore the execution model');
    const assumption = page.indexOf(guidedLessons[lesson.slug].before.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
    assert.ok(editor < model && model < assumption, lesson.slug);
  }
});

import { renderV2References } from '../content/v2-references.mjs';
test('all 21 lessons pair each reference with its question without repeated source links', () => {
  for (const lesson of v2Course) {
    const html = renderV2References(lesson.slug);
    const urls = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
    assert.equal(urls.length, 2, lesson.slug);
    assert.equal(new Set(urls).size, 2, lesson.slug);
    assert.equal((html.match(/class="v2-reference-question"/g) ?? []).length, 2, lesson.slug);
    assert.equal((html.match(/Compare your answer/g) ?? []).length, 2, lesson.slug);
    assert.doesNotMatch(html, /data-v2-resource="documentation"/);
  }
});

import { courseBreadcrumb } from '../content/v2-course-navigation.mjs';
test('every breadcrumb contains all course destinations and one marked current lesson', () => {
  for (const lesson of v2Course) {
    const html = courseBreadcrumb(lesson, (slug,part) => slug === 'contents' ? '../' + (part ? '#'+part : '') : './'+slug+'.html');
    assert.equal((html.match(/class="v2-course-part"/g) ?? []).length,3);
    assert.equal((html.match(/class="v2-course-part"[^>]* open/g) ?? []).length,1);
    for(const item of v2Course) assert.ok(html.includes('href="./'+item.slug+'.html"'),lesson.slug);
    assert.match(html,/aria-label="Course contents"/);
    assert.match(html,new RegExp('href="\\./'+lesson.slug+'\\.html" aria-current="page"'));
  }
});
