// Copyright © 2026 Christopher Snow.
import { readFile } from 'node:fs/promises';
import { v2Course } from './v2-course.mjs';
import { practicalLessons } from './v2-practical-catalog.mjs';
import { practicalSource } from './v2-practical-source.mjs';

export const programEvidence = {
  coalescing: 'Find Sectors touched in Console. The starter’s 32 consecutive FP32 reads touch four aligned 32-byte sectors.',
  scheduling: 'In Console, find Threads, values and last output. The starter launches 32 threads and doubles 64 values.',
  divergence: 'In Console, compare Lane 0 with lane 1. Their input signs send them down different branches.',
  reduction: 'Find Sum in Console. The starter adds the four values 1.0 through 4.0.',
  'shared-memory-banks': 'Find Modelled service rounds in Console. The CPU groups the simulated read addresses by bank.',
  matmul: 'In Console, find mismatches, input loads in this tiled algorithm and shared bytes per block. The starter checks 16 values against the CPU reference.',
  precision: 'Find FP32 accumulation in Console. The starter rounds its inputs through FP16 and then sums them in FP32.',
  'tensor-cores': 'Find C[0,0] in Console. The starter accumulates into a tile filled with 0.0.',
  attention: 'Find Tiles and weighted value in Console. Eight keys are processed two at a time.',
  inference: 'Find Old cache read and append in Console. Both are byte counts for one step of this example.',
  'matmul-investigation': 'Find mismatches, input loads in this tiled algorithm and shared bytes per block in Console. The starter checks 64 values against its CPU reference.',
  histograms: 'Find Counts in Console. They give the number of tokens in each of the four destinations.',
  scan: 'Find Index 5 and index 7 in Console. Both totals include the flag at their own position.',
  compaction: 'Find the Kept token lines in Console. The starter writes the tokens from category 0 in input order.',
  progress: 'Find all four Read outputs in Console. Two threads read after the barrier.',
  pipelines: 'Find First output, last output and chunk synchronizations in Console. The starter uses stream and event dependencies for four chunks.',
  'token-routing': 'Find the eight Slot lines in Console. Each slot gives the ID of the token routed there.',
};

export const programTasks = {
  "coalescing": "In runKernel in the CUDA source editor, change constexpr int stride = 1 to constexpr int stride = 2, then 32. Before each repeat of Compile and run, predict Sectors touched. Follow input[lane * stride]. Why do neighbouring lanes share fewer 32-byte sectors as the addresses spread out?",
  "scheduling": "Above doubleValues, change warpsPerBlock from 1 to 2. Predict Threads and values, then compare those fields in Console after running again. Both runs double every input; the optional model examines idle instruction slots rather than timing these runs.",
  "divergence": "Above transform, change alternateSigns from true to false. Predict the value printed for lane 1, then run again and check Lane 0 and lane 1 in Console. Which branch now handles every input?",
  "reduction": "Above sum, change threads from 4 to 8. Predict Sum for inputs 1.0 through 8.0, then run again and check Sum in Console. In the kernel, find the barrier that separates one stage’s writes from the next stage’s partner reads.",
  "shared-memory-banks": "Above readWords, change stride from 32 to 33. Predict Modelled service rounds and click Compile and run again. Use words[lane * stride] in readWords and the remainder after dividing the word index by 32 to explain the change. These software counts describe bank requests in the model.",
  "matmul": "Above multiply, change tile from 2 to 4. Run again and check mismatches is 0. Compare input loads in this tiled algorithm and shared bytes per block in Console: how does reuse change the storage each block needs? The CPU reference checks the product; this is not a timing comparison.",
  "precision": "Above dot, change narrowInputs from true to false. Predict whether FP32 accumulation will stay zero, then run again and read that field in Console. Use the conversion in dot to explain the difference. The program prints the sum, not the individual rounded operands.",
  "tensor-cores": "Inside tile, change startingValue from 0.0f to 4.0f. Predict C[0,0], then run again and check C[0,0] in Console. Does the matrix operation replace the starting value or add to it? Optionally open Inspect generated PTX to locate the matrix instructions.",
  "attention": "Above onlineAttention, change keysPerTile from 2 to 4. Predict Tiles, then run again. In Console, compare Tiles and weighted value: does processing fewer tiles change the final weighted value?",
  "inference": "Above append, change cached from 4 to 8. Predict Old cache read in bytes, then run again. Compare Old cache read and append in Console: which grows with the old token count, and which stays fixed?",
  "matmul-investigation": "Above multiply, change tile from 2 to 4. Run again and check mismatches is 0. Compare input loads in this tiled algorithm and shared bytes per block in Console. Explain the reuse/storage trade-off before choosing a real GPU measurement.",
  "histograms": "In main(), replace the eight entries of categories with zeroes. Predict Counts, then run again and read Counts in Console. Next change blockCounts from true to false above histogram and rerun: should moving the counters change the four bin totals?",
  "scan": "Above scan, change inclusive from true to false. Predict Index 5 and index 7, then run again and inspect both fields in Console. Explain why the exclusive value at index 5 omits that position’s own flag.",
  "compaction": "Above flag, change keepCategory from 0 to 1. Predict the token IDs that survive, then run again. Read the Kept token lines in Console and check that IDs remain in their original input order.",
  "progress": "Above exchange, change readers from 2 to 4. Predict the four Read outputs, then run again and inspect them in Console. In the kernel, check that the condition changes the readers after the barrier; every thread still reaches the barrier.",
  "pipelines": "Above process, change overlap from true to false. Run again and compare First output, last output and chunk synchronizations in Console. Does the added synchronisation change the values? These counts do not measure physical overlap or elapsed time.",
  "token-routing": "Above count, change hot from false to true. Predict which token appears in Slot 1, then run again. Inspect all Slot lines in Console: are tokens with the same destination still ordered by their original IDs?"
};

export const programNotes = {
  matmul: 'The editable program checks each result with nonuniform inputs and partial tiles. After comparing tile widths, try width = 5 and inspect Checked values and mismatches again.',
  'matmul-investigation': 'After comparing tile widths, try width = 7 and look for 49 checked values and zero mismatches. This width leaves tiles that are only partially full.',
  coalescing: 'Each input stores its own index. The kernel returns the indices it read. The CPU groups those addresses into 32-byte sectors using an aligned input base. Sectors touched counts those groups. A hardware profiler would be needed to observe cache or device-memory traffic.',
  pipelines: 'The browser follows the stream and event dependencies. The optional schedule model illustrates when copies and kernels could overlap.',
};

export async function insertProgramStarters(html) {
  const marker = '/* architecture-programs */ {}';
  if (!html.includes(marker)) throw new Error('Build the workbench with CUDA module support.');
  const starters = await Promise.all(v2Course.filter(lesson => !lesson.practical && !lesson.mode && lesson.slug !== 'coalescing')
    .map(async ({ slug }) => [
      slug, await readFile(new URL('../examples/v2-programs/' + slug + '.cu', import.meta.url), 'utf8'),
    ]));
  starters.push(...practicalLessons.filter(lesson=>lesson.program).map(lesson=>[lesson.slug,practicalSource(lesson.slug)]));
  // The lesson and executable editor must use the same L1 starter.
  const prefix='<script>const lab = ';
  const payload=html.split('\n').find(line=>line.startsWith(prefix));
  if(!payload)throw new Error('Missing CUDA workbench payload');
  const lab=JSON.parse(payload.slice(prefix.length).replace(/;$/,''));
  lab.firstProgram=await readFile(new URL('../examples/first-kernel.cu',import.meta.url),'utf8');
  return html.replace(payload,()=>prefix+JSON.stringify(lab).replaceAll('<','\\u003c')+';')
    .replace(marker, () => JSON.stringify(Object.fromEntries(starters)).replaceAll('<', '\\u003c'));
}
