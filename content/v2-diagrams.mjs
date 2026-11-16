// Copyright © 2026 Christopher Snow.
import { launchPlan } from '../src/hello-model.mjs';
import { simulateLoad } from '../src/model.mjs';
import { escape } from '../src/continuation-ui.mjs';

// Each schematic is drawn from the parameters of the lesson's own example.
function figure(caption, body, note) {
  return `<figure class="v2-diagram"><figcaption>${escape(caption)}</figcaption>
    ${body}<p>${escape(note)}</p></figure>`;
}

function flow(caption, stages, note) {
  return figure(caption, `<ol class="v2-flow">${stages.map(([title, detail]) =>
    `<li><strong>${escape(title)}</strong><span>${escape(detail)}</span></li>`).join('')}</ol>`, note);
}

function indices() {
  const { blocks, size, count } = launchPlan(5, 4);
  const rows = Array.from({ length: blocks }, (_, block) => {
    const indices = Array.from({ length: size }, (_, lane) => block * size + lane);
    return `<tr><th scope="row">Block ${block}</th>${indices.map(index =>
      `<td${index >= count ? ' class="is-unused"' : ''}>${index}<span>${index < count ? 'Write' : 'Skip'}</span></td>`).join('')}</tr>`;
  });
  return figure('From local thread index to array index', `<table class="v2-grid-table">
    <thead><tr><td></td>${Array.from({ length: size }, (_, lane) => `<th scope="col">Thread ${lane}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody></table>`,
    'Both blocks have local threads 0–3. The start of the second block is 1 × 4, so its first local thread handles array index 4.');
}

function sectors() {
  const cases = [1, 2].map(stride => {
    const { sectors } = simulateLoad({ stride, activeLanes: 8 });
    return `<tr><th scope="row">Stride ${stride}</th>${sectors.map(sector =>
      `<td><strong>Sector ${sector.id}</strong><span>Lanes ${sector.laneIds.join(', ')}</span></td>`).join('')}
      ${sectors.length === 1 ? '<td class="is-unused">Untouched</td>' : ''}</tr>`;
  });
  return figure('Eight lanes accessing aligned global memory', `<table class="v2-grid-table">
    <thead><tr><td></td><th scope="col">Bytes 0–31</th><th scope="col">Bytes 32–63</th></tr></thead>
    <tbody>${cases.join('')}</tbody></table>`,
    'The same eight lanes each read one FP32 word. Spreading out their addresses changes which sectors supply the values.');
}

function tileReuse() {
  return figure('One loaded A value serves two outputs', `<div class="v2-fork">
    <div><strong>A[0,0]</strong><span>Load into shared memory once</span></div>
    <ul><li><strong>× B[0,0]</strong><span>Contributes to C[0,0]</span></li>
        <li><strong>× B[0,1]</strong><span>Contributes to C[0,1]</span></li></ul>
  </div>`, 'The two output threads read the same shared A word and different B words.');
}

const diagrams = {
  'first-kernel': () => flow('Follow the result from launch to console', [
    ['CPU · main()', 'Reserve space in GPU memory and launch hello.'],
    ['GPU · one thread', 'A streaming multiprocessor executes the kernel instructions.'],
    ['GPU memory · output[0]', 'The kernel stores one float.'],
    ['CPU · console', 'main() copies back the float and prints it.'],
  ], 'Which operation in main() moves the result across the CPU–GPU boundary?'),
  'more-threads-than-elements': indices,
  'from-cpu-array-to-gpu-result': () => flow('The two arrays on each side of a launch', [
    ['CPU input x', 'The host copies values to the GPU.'],
    ['GPU input d_x', 'Each kernel thread reads its element.'],
    ['GPU output d_y', 'Each kernel thread writes its result.'],
    ['CPU output y', 'The host copies the completed results back.'],
  ], 'Allocation creates the GPU storage. The two copies move values across the CPU–GPU boundary.'),
  coalescing: sectors,
  scheduling: () => flow('The multiply depends on the load', [
    ['Load input', 'Warp A issues the load.'],
    ['Wait for the value', 'A cannot multiply yet. A ready warp B can issue here.'],
    ['Multiply', 'A can issue when its value arrives.'],
  ], 'This dependency belongs to warp A. It need not stop warp B.'),
  reduction: () => flow('One stage of a block reduction', [
    ['Write inputs', 'Each thread writes its own shared word.'],
    ['Block barrier', 'All threads arrive before any partner read.'],
    ['Read and add', 'Selected threads write partial sums.'],
    ['Block barrier', 'All threads arrive before the next stage reads.'],
  ], 'The threads that skipped the addition still reach the second barrier.'),
  matmul: tileReuse,
  'tensor-cores': () => flow('Inputs and accumulator in one WMMA operation', [
    ['A and B fragments', 'Each operand holds part of an FP16 tile.'],
    ['Warp multiplies', 'All lanes issue the matrix operation together.'],
    ['Accumulator fragment', 'Add the dot products to the FP32 values already here.'],
  ], 'The warp can use the updated accumulator again with a new pair of input tiles.'),
  attention: () => flow('How online attention carries state between tiles', [
    ['Score tile', 'Compare this tile’s scores with the running maximum.'],
    ['Rescale old totals', 'If the maximum rises, shrink the previous denominator and weighted sum.'],
    ['Update totals', 'Add this tile’s contributions and pass the new state forward.'],
  ], 'After the final tile, divide the weighted sum by the denominator.'),
  inference: () => figure('One layer of the key-value cache during decode',
    `<table class="v2-grid-table"><thead><tr><td></td><th scope="col">Earlier token slots</th><th scope="col">Next token slot</th></tr></thead>
      <tbody><tr><th scope="row">Keys</th><td>Read old keys</td><td>Write new key</td></tr>
      <tr><th scope="row">Values</th><td>Read old values</td><td>Write new value</td></tr></tbody></table>`,
    'A longer context extends the read region. One step still appends one new key and value per layer.'),
};

export function v2Diagram(slug) {
  return diagrams[slug]?.() ?? '';
}
