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

test('the 20 model lessons have exercises, transfer prompts and links to the related course', () => {
  assert.equal(new Set(v2Course.map(lesson => lesson.slug)).size, 21);
  assert.equal(Object.keys(guidedLessons).length, 17);
  for (const lesson of v2Course.slice(1)) {
    const page = renderV2Lesson(lesson, slug => slug + '.html', slug => '../lessons/' + slug + '.html');
    assert.doesNotMatch(page, /Planned lesson/);
    assert.match(page, /id="v2-run"/);
    assert.match(page, /id="v2-result" hidden/);
    assert.match(page, /Compare your explanation/);
    assert.ok(page.includes('../lessons/' + lesson.current + '.html'));
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
