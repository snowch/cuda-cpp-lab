// Copyright © 2026 Christopher Snow.
import { readFile } from 'node:fs/promises';
import scenes from '../content/first-kernel-scenes.json' with {type:'json'};
import { label, recordingDeck, writeRecordingDeck } from './recording-deck.mjs';

const program = await readFile(new URL('../examples/first-kernel.cu', import.meta.url), 'utf8');
const kernel = program.match(/^__global__[^]*?^}/m)[0].split('\n');
const launch = program.match(/^\s*(hello<<<[^\n]+;)$/m)[1];
const panel = (y, title, detail) => `<rect class="panel" x="40" y="${y}" width="640" height="77" rx="10"/>` +
  label(360, y + 31, title, 'heading') + label(360, y + 60, detail, 'body');
const arrow = y => `<path d="M360 ${y} v24" class="arrow" marker-end="url(#arrow)"/>`;

function figure(stage) {
  if (stage === 'definition') {
    return panel(55, 'CUDA C++ · Kernel definition', '__global__ marks hello as a kernel') +
      '<rect class="panel" x="40" y="168" width="640" height="161" rx="10"/>' +
      kernel.map((line, i) => label(360, 210 + i * 38, line, 'code')).join('') +
      panel(369, 'GPU memory', 'output[0] receives one float');
  }
  if (stage === 'launch') {
    return panel(54, 'CPU · main()', launch) + arrow(138) +
      panel(174, 'One block', 'The first 1 sets the number of blocks') + arrow(258) +
      panel(294, 'One GPU thread', 'The second 1 sets threads per block') +
      label(360, 431, 'output is the address passed to hello', 'heading');
  }
  if (stage === 'store') {
    return panel(44, 'GPU · Thread on an SM', 'Execute the instructions in hello') + arrow(128) +
      panel(164, 'GPU memory · output[0]', 'Store 42.0') + arrow(248) +
      panel(284, 'CPU memory · value', 'Copy 42.0 from GPU memory') + arrow(368) +
      panel(404, 'CPU · Console', 'Print 42.0');
  }
  return panel(85, 'Edit the assignment in hello', 'output[0] = 42.0f;') +
    panel(215, 'Keep the launch', launch) +
    panel(345, 'Compile and run', 'Check the console against your prediction');
}

const scope = 'Conceptual execution and data path';
const deck = recordingDeck({ chapter: '1 · CUDA FIRST', title: 'What is a CUDA kernel?', scenes, figure, scope });
await writeRecordingDeck(process.argv[2] || 'test-results/first-kernel-recording', deck, scenes);
