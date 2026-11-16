// Copyright © 2026 Christopher Snow.
import { readFile } from 'node:fs/promises';
import { v2Course } from './v2-course.mjs';

export const programTasks = {
  coalescing: 'Predict the sector count at stride 1. Run the program, change stride inside runKernel to 2, then try 32.',
  scheduling: 'Change warpsPerBlock from 1 to 2. Predict the number of lanes and total elements. Check the launch and result before tracing a load dependency in the execution model.',
  divergence: 'Set alternateSigns to false. Predict how many lanes take each branch and check the result for lane 1.',
  reduction: 'Change threads from 4 to 8. Which values contribute to the new sum? Find the barrier between successive partner reads.',
  'shared-memory-banks': 'Change stride from 32 to 33. Read the returned addresses and compare the calculated bank service rounds.',
  matmul: 'Change tile from 2 to 4. Compare the calculated loads and check that both kernels still agree on the product.',
  precision: 'Set narrowInputs to false. Compare the rounded operands and the FP32 sum. The inputs change format while the accumulator stays FP32.',
  'tensor-cores': 'Change startingValue from 0.0f to 4.0f. Predict C[0,0] and inspect the generated PTX for the warp matrix instructions.',
  attention: 'Change keysPerTile from 2 to 4. Predict the number of tiles and compare the weighted value in the two runs.',
  inference: 'Change cached from 4 to 8. Predict how many more bytes the kernel reads from the old key-value cache.',
  'matmul-investigation': 'Change tile from 2 to 4. Compare the product, calculated global loads, and shared storage per block.',
  histograms: 'Replace the destination array with eight zeroes. Predict the bin counts and compare the results from the two atomic kernels.',
  scan: 'Set inclusive to false. Explain why the new value at index 5 equals the old value at index 4.',
  compaction: 'Change keepCategory from 0 to 1. Predict the token IDs that survive and check their order.',
  progress: 'Change readers from 2 to 4. Compare the four outputs and identify which threads must still participate in the barrier.',
  pipelines: 'Set overlap to false. Compare the final array and the number of chunk synchronizations in main().',
  'token-routing': 'Set hot to true. Predict which token lands in slot 1 and check the ordering of tokens within each destination.',
};

export const programNotes = {
  coalescing: 'Each input stores its own index. The kernel returns the indices it read. The host groups those indices into 32-byte sectors, assuming an aligned input.',
  pipelines: 'The browser follows the stream and event dependencies. Use the execution model to explore when copies and kernels could overlap.',
};

export async function insertProgramStarters(html) {
  const marker = '/* architecture-programs */ {}';
  if (!html.includes(marker)) throw new Error('Build the workbench with CUDA module support.');
  const starters = await Promise.all(v2Course.filter(lesson => !lesson.mode && lesson.slug !== 'coalescing')
    .map(async ({ slug }) => [
      slug, await readFile(new URL('../examples/v2-programs/' + slug + '.cu', import.meta.url), 'utf8'),
    ]));
  return html.replace(marker, () => JSON.stringify(Object.fromEntries(starters)).replaceAll('<', '\\u003c'));
}
