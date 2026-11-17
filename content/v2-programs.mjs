// Copyright © 2026 Christopher Snow.
import { readFile } from 'node:fs/promises';
import { v2Course } from './v2-course.mjs';
import { practicalLessons } from './v2-practical-catalog.mjs';
import { practicalSource } from './v2-practical-source.mjs';

export const programTasks = {
  "coalescing": "In runKernel, change stride from 1 to 2, then to 32. Before each run, predict Sectors touched. In Console, use input[i * stride] in the kernel to explain that count: why do neighbouring lanes share fewer sectors as stride increases?",
  "scheduling": "Above doubleValues, change warpsPerBlock from 1 to 2. Predict Threads and values, then compare those fields in Console after running again. Both runs double every input; the optional model examines idle instruction slots rather than timing these runs.",
  "divergence": "Above transform, change alternateSigns from true to false. Predict the value printed for lane 1, then run again and check Lane 0 and lane 1 in Console. Which branch now handles every input?",
  "reduction": "Above sum, change threads from 4 to 8. Predict Sum for inputs 1.0 through 8.0, then run again and check Sum in Console. In the kernel, find the barrier that separates one stage’s writes from the next stage’s partner reads.",
  "shared-memory-banks": "Above readWords, change stride from 32 to 33. Predict Modelled service rounds, then run again. Use words[lane * stride] in readWords and the word-index modulo 32 rule to explain why the calculated rounds change. These are address-model counts, not measured time.",
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
  matmul: 'The editable program checks nonuniform inputs and partial tiles. The separate execution model uses its displayed fixed inputs. Try width = 5 after comparing tile widths.',
  'matmul-investigation': 'The editable program checks every output against a CPU reference. Try width = 7 to exercise partial tiles; the separate resource model retains its stated assumptions.',
  coalescing: 'Each input stores its own index. The kernel returns the indices it read. The host groups those indices into 32-byte sectors, assuming an aligned input.',
  pipelines: 'The browser follows the stream and event dependencies. Use the execution model to explore when copies and kernels could overlap.',
};

export async function insertProgramStarters(html) {
  const marker = '/* architecture-programs */ {}';
  if (!html.includes(marker)) throw new Error('Build the workbench with CUDA module support.');
  const starters = await Promise.all(v2Course.filter(lesson => !lesson.practical && !lesson.mode && lesson.slug !== 'coalescing')
    .map(async ({ slug }) => [
      slug, await readFile(new URL('../examples/v2-programs/' + slug + '.cu', import.meta.url), 'utf8'),
    ]));
  starters.push(...practicalLessons.filter(lesson=>lesson.program).map(lesson=>[lesson.slug,practicalSource(lesson.slug)]));
  return html.replace(marker, () => JSON.stringify(Object.fromEntries(starters)).replaceAll('<', '\\u003c'));
}
