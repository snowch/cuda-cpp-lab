// Copyright © 2026 Christopher Snow.
import assert from 'node:assert/strict';
import test from 'node:test';
import { v2Course } from '../content/v2-course.mjs';
import { renderV2Lesson } from '../content/v2-view.mjs';
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

test('each planned page has a route and an existing-course fallback without a run control', () => {
  assert.equal(new Set(v2Course.map(lesson => lesson.slug)).size, 20);
  assert.deepEqual(v2Course.filter(lesson => lesson.mode).map(lesson => lesson.mode), ['scale', 'bounds', 'copies']);
  for (const lesson of v2Course.slice(3)) {
    const page = renderV2Lesson(lesson, slug => slug + '.html', slug => '../lessons/' + slug + '.html');
    assert.match(page, /Planned lesson/);
    assert.ok(page.includes('../lessons/' + lesson.current + '.html'));
    assert.doesNotMatch(page, /id="v2-run"/);
  }
});
