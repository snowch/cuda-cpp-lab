// Copyright © 2026 Christopher Snow.
import { kernelSource } from './model.mjs';

export const coreLessons = {
  coalescing: {
    before: 'A warp is a group of 32 threads; a lane is one logical position in that warp, numbered 0–31. Here each thread reads one FP32 value and writes it to a contiguous output. A stride is the distance in elements between neighbouring reads. Assume a 32-byte-aligned input and at least 993 input elements.',
    terms: [['32-byte alignment', 'The first input address is a multiple of 32 bytes in this model.'], ['Memory sector', 'An aligned 32-byte region in this address model. Eight consecutive FP32 values fit in one sector.']],
    label: 'Input element stride',
    cases: [[1, '1 · contiguous'], [2, '2 · every other value'], [32, '32 · one lane per sector']],
    code: stride => kernelSource({ stride, offset: 0 }),
    inspect: 'For this one-warp launch, the host passes n = 32, the number of outputs. i chooses an output and i × stride chooses an input. The input allocation covers the largest read at index 31 × stride.',
    task: "Set Input element stride to 1 and predict Sectors touched. Click Run model, then inspect the Sector and Lanes columns. Change the stride to 2, predict again and rerun. Which lanes still share a sector?",
    question: 'How many sectors are touched?',
    transfer: 'Keep stride 1 but start one FP32 element past the aligned address. How many sectors will the same 32 reads touch?',
    answer: 'Five. The first sector supplies seven words, three sectors supply eight each, and the fifth supplies the last word.',
  },
  scheduling: {
    before: 'The multiply depends on the loaded input. While a warp waits for its load, another warp on the same SM can issue an instruction if its own operands are ready. This teaching machine issues one instruction per slot and makes each load usable six slots after issue. Each warp handles two consecutive groups of 32 inputs.',
    terms: [['Resident warp', 'A warp that already has the resources it needs on a streaming multiprocessor (SM).']],
    label: 'Resident warps',
    cases: [[1, 'One warp'], [2, 'Two warps']],
    code: warps => `// Host launch: 1 block of ${warps * 32} threads, ${warps * 64} elements.
// Device body. n is exactly twice the block size.
int i = threadIdx.x;
output[i] = input[i] * 2.0f;
i += blockDim.x;
output[i] = input[i] * 2.0f;`,
    inspect: 'Both assignments require a load, multiply and store. The model follows that source order for each warp. Changing the launch changes the amount of work, so compare idle slots between instructions.',
    task: "Select One warp under Resident warps and click Run model. Use Next step to find an issue slot where no warp issues an instruction. Select Two warps, predict how many instructions issue before the first idle slot, then run and step again. Compare idle slots rather than elapsed GPU time.",
    question: 'How many instructions issue before the first idle slot?',
    transfer: 'With two warps, why can the machine still have idle slots even though each warp has work left?',
    answer: 'Both warps can be waiting for different loads at the same time. A scheduler can only select an instruction whose operands are ready.',
  },
  divergence: {
    before: 'Each lane reads one value. Positive values are doubled and negative values are negated. Use one full warp and compare inputs with different sign patterns.',
    terms: [['Divergence', 'Threads of the same warp need different control-flow paths.'], ['Active mask', 'The set of lanes participating in the current modelled instruction.']],
    label: 'Signs in the input',
    cases: [['positive', 'All positive'], ['one-negative', 'Only lane 0 negative'], ['alternating', 'Alternating signs']],
    code: pattern => `// Host supplies 32 values. Input rule:
${{positive:'// Every lane reads 2.0f.', 'one-negative':'// Lane 0 reads -2.0f. Other lanes read 2.0f.', alternating:'// Odd lanes read -2.0f. Even lanes read 2.0f.'}[pattern]}
// Device body for one warp:
int i = threadIdx.x;
float x = input[i];
if (x < 0.0f) output[i] = -x;
else          output[i] = x * 2.0f;`,
    inspect: 'The model shows the two arithmetic paths and their active masks. A compiler can implement this short conditional using predication or other instructions.',
    task: "Select All positive under Signs in the input and click Run model. Then select Only lane 0 negative, predict Paths taken and run again. Repeat with Alternating signs. Compare Participation in each path: does changing the number of active lanes create another path?",
    question: 'How many paths contain active lanes?',
    transfer: 'Which path has more active lanes with one negative value? How does alternating signs change the answer?',
    answer: 'The multiply path has 31 lanes with one negative value. Both paths have 16 lanes with alternating signs.',
  },
  reduction: {
    before: 'Keep the input values consecutive, starting at 1.0. This time the block returns one sum. First each thread writes its value to shared memory. The barrier orders those writes before threads read their partners. After each addition stage the whole block meets again.',
    terms: [['Reduction', 'An operation that combines several values into one.'], ['Shared memory', 'Storage accessible to threads in a block.'], ['Block barrier', 'A synchronisation point reached by every participating thread in the block before any continue.']],
    label: 'Threads and inputs in one block',
    cases: [[4, 'Four threads'], [8, 'Eight threads']],
    code: size => `// Launch one block of ${size} threads with ${size} input values.
__global__ void sum(const float* input, float* out) {
  __shared__ float scratch[${size}];
  int t = threadIdx.x;
  scratch[t] = input[t];
  __syncthreads();
  for (int d = blockDim.x / 2; d > 0; d /= 2) {
    if (t < d) scratch[t] += scratch[t + d];
    __syncthreads();
  }
  if (t == 0) out[0] = scratch[0];
}`,
    inspect: 'The distance d identifies the word paired with the current thread. Only threads t < d add. The barrier is outside that condition so every thread reaches it.',
    task: "Select Four threads and click Run model. Use Next step to pass the initial barrier and inspect the partner reads. Select Eight threads, predict how many threads add in the first stage, then run again. Use Inputs in current partial to track which original values each sum includes.",
    question: 'How many threads add in the first stage?',
    transfer: 'For eight inputs, which original indices have contributed to scratch[0] after the distance-2 stage?',
    answer: 'Indices 0, 4, 2 and 6. The distance-4 stage pairs 0 with 4 and 2 with 6. The distance-2 stage combines the two pairs.',
  },
  'shared-memory-banks': {
    before: 'A bank serves words from shared memory. The model uses 32 banks with successive FP32 words cycling through them. For one warp load, a bank can broadcast one word to multiple lanes. Distinct words in the same bank need separate service rounds.',
    terms: [['Service round', 'One step of this bank model: each bank serves one distinct word, including a broadcast to several lanes. This is not a measured GPU cycle.'], ['Bank conflict', 'Lanes of one instruction need different words from the same shared-memory bank.']],
    label: 'Word read by each lane',
    cases: [[32, 'lane × 32'], [33, 'lane × 33'], [0, 'Word 0 for every lane']],
    code: stride => `// Device excerpt. All 1,024 words in s are initialised
// cooperatively, then the block reaches __syncthreads().
int lane = threadIdx.x; // launch one block of 32
output[lane] = s[${stride ? `lane * ${stride}` : '0'}];`,
    inspect: 'A word index modulo 32 identifies its bank. The largest read, 31 × 33, fits in the declared 1,024-word allocation.',
    task: "Select lane × 32 and predict service rounds, then click Run model. Repeat with lane × 33 and Word 0 for every lane. Compare the word addresses and bank groups: are conflicting requests for different words, or repeated requests for the same word?",
    question: 'How many service rounds does this instruction require?',
    transfer: 'Why do stride 32 and a broadcast both select bank 0 but require different service rounds?',
    answer: 'Stride 32 requests 32 different words in bank 0. A broadcast requests the same word 32 times and uses one round.',
  },
  matmul: {
    before: 'Each output C[row, col] is the dot product of an A row and a B column. A block can compute several neighbouring outputs and load input tiles into shared memory. Several threads can then reuse the same word.',
    terms: [['Dot product', 'Multiply matching elements from two sequences and add their products.'], ['Tile', 'A small rectangular region of a matrix processed as a group.']],
    label: 'Output tile width',
    cases: [[1, '1 · separate outputs'], [2, '2 · shared input tiles'], [4, '4 · shared input tiles']],
    code: tile => tile === 1 ? `// One thread per C element. A, B, C are row-major 4 × 4.
int row = blockIdx.y;
int col = blockIdx.x;
float total = 0.0f;
for (int k = 0; k < 4; ++k)
  total += A[row * 4 + k] * B[k * 4 + col];
C[row * 4 + col] = total;` : `// Device body. Launch a (4/T, 4/T) grid of (T, T) blocks.
constexpr int T = ${tile};
__shared__ float a[T][T], b[T][T];
int x = threadIdx.x, y = threadIdx.y;
int row = blockIdx.y * T + y;
int col = blockIdx.x * T + x;
float total = 0.0f;
for (int k0 = 0; k0 < 4; k0 += T) {
  a[y][x] = A[row * 4 + k0 + x];
  b[y][x] = B[(k0 + y) * 4 + col];
  __syncthreads();
  for (int k = 0; k < T; ++k)
    total += a[y][k] * b[k][x];
  __syncthreads();
}
C[row * 4 + col] = total;`,
    inspect: 'The first barrier makes the tile available. The second protects it from being overwritten before the last reader finishes. Width 1 uses a 4 × 4 grid of one-thread blocks here for a direct comparison.',
    task: "Select 1 · separate outputs under Output tile width and click Run model. Read Global input element loads. Select 2 · shared input tiles and predict that count for all 16 outputs before running again. Use Next step to inspect which A and B values feed the first block’s partial C values.",
    question: 'How many global input values are loaded for the entire matrix?',
    transfer: 'At width 2, which output positions in the first tile reuse b[1][0] during the first K tile?',
    answer: 'C[0,0] and C[1,0] both multiply it against values from different A rows. They share a B word because they have the same output column.',
  },
  precision: {
    before: 'Follow one 16-term dot product. The first eight input values are close to 1.0 and the next eight are −1.0. Every value in the other operand is 1.0. Store the first operand in a chosen format, then convert its values back to FP32 for accumulation.',
    terms: [['FP16 and BF16', 'Two formats that use two bytes per value. They allocate different numbers of bits to precision and range.'], ['Cancellation', 'Addition of opposite-sign terms leaves a result small compared with the individual terms.']],
    label: 'Format for the first operand',
    cases: [['fp32', 'FP32'], ['fp16', 'FP16'], ['bf16', 'BF16']],
    code: format => {
      const converts = { fp32: 'float x = input[k];', fp16: '__half stored = __float2half_rn(input[k]);\nfloat x = __half2float(stored);',
        bf16: '__nv_bfloat16 stored = __float2bfloat16_rn(input[k]);\nfloat x = __bfloat162float(stored);' };
      return `// One thread's loop, with CUDA's cuda_fp16.h / cuda_bf16.h
// included as required. The other operand is always 1.0f.
float total = 0.0f;
for (int k = 0; k < 16; ++k) {
  ${converts[format].replaceAll('\n', '\n  ')}
  total += x;
}`;
    },
    inspect: 'The loop represents loading values that were stored in the chosen format. The conversion is written locally to make the rounding visible.',
    task: "Select FP32 under Format for the first operand and click Run model. Read Final FP32 sum. Select FP16, predict Changed inputs and rerun. Compare Input, Stored and Running FP32 sum, then repeat with BF16. Which differences were lost before accumulation?",
    question: 'How many first-operand values change when stored?',
    transfer: 'Why does accumulating in FP32 fail to recover the FP32-input result when the positive terms were rounded first?',
    answer: 'Each positive input has already become 1.0. Adding the rounded terms in FP32 cannot recreate the small differences that were removed.',
  },
  'tensor-cores': {
    before: 'A warp can perform a matrix multiply-accumulate collectively. This example gives one warp two row-major 16 × 16 FP16 tiles and a 16 × 16 FP32 accumulator. A and B contain 1.0 throughout. Each output receives a 16-term dot product plus its starting accumulator.',
    terms: [['Accumulator', 'A running sum that keeps earlier contributions when another product is added.'], ['WMMA', 'CUDA’s warp-level matrix multiply-accumulate interface.'], ['Fragment', 'The portion of a matrix tile stored in a thread’s registers for a warp-wide operation.']],
    label: 'Starting accumulator value',
    cases: [[0, '0.0 · first tile'], [4, '4.0 · continue an existing sum']],
    code: start => `// Device body; #include <mma.h>. One complete warp.
// A and B: aligned FP16 16 × 16 arrays. C: aligned FP32.
namespace w = nvcuda::wmma;
w::fragment<w::matrix_a, 16, 16, 16,
            __half, w::row_major> a;
w::fragment<w::matrix_b, 16, 16, 16,
            __half, w::row_major> b;
w::fragment<w::accumulator, 16, 16, 16, float> c;
w::fill_fragment(c, ${start}.0f);
w::load_matrix_sync(a, A, 16);
w::load_matrix_sync(b, B, 16);
w::mma_sync(c, a, b, c);
w::store_matrix_sync(C, c, 16, w::mem_row_major);`,
    inspect: 'All 32 threads call the same operations with the same tile pointers. The 16 passed to each load or store is the row stride in elements. The arithmetic model shows a single output coordinate and the collective dataflow. Fragment-to-lane placement depends on the device.',
    task: "Set Starting accumulator value to 0.0 and predict C[0,0], then click Run model. Inspect the Collective call table. Change the accumulator to 4.0, predict again and rerun: which call preserves and adds to the starting sum?",
    question: 'What value is written to C[0,0]?',
    transfer: 'If the warp uses a second tile pair with a dot product of 8.0, what should it pass as the fourth argument to keep the existing 16.0?',
    answer: 'Pass c, the existing accumulator fragment. The next operation adds 8.0 to 16.0, producing 24.0 in that coordinate.',
  },
};

Object.assign(coreLessons, {
  attention: {
    before: 'For each query, take a scaled dot product with every key to obtain scores. Softmax converts those scores to weights, and the output is the weighted sum of the value vectors. Here there are eight queries, eight keys, and four values per vector.',
    terms: [['Softmax', 'Convert scores to positive weights: exponentiate each score minus the largest score, then divide by the sum. The weights sum to one.'], ['Online softmax', 'A running calculation that updates the maximum, denominator and weighted sum as each tile of scores arrives.']],
    label: 'Score handling',
    cases: [['materialised', 'Store full scores and probabilities'], [2, 'Online · two keys per tile'], [4, 'Online · four keys per tile']],
    code: mode => mode === 'materialised' ? `// CUDA algorithm outline, separate launches:
// 1. Store every dot(Q[q], K[k]) / sqrt(d) in scores.
// 2. Softmax each scores row into probabilities.
// 3. For each q, store sum_k(probabilities[q,k] * V[k]).` : `// CUDA algorithm outline, one query, ${mode} keys per tile.
// m starts at -infinity, denominator and vector acc at 0.
for (each tile of ${mode} keys) {
  next = max(m, largest score in tile);
  keep = exp(m - next);
  denominator = denominator * keep + sum(exp(score-next));
  acc = acc * keep + sum(exp(score-next) * value);
  m = next;
}
output[query] = acc / denominator;`,
    inspect: 'When a tile raises the maximum, rescale the earlier contributions before adding new ones. The trace follows query 0. Intermediate array writes count all eight queries and exclude the final output.',
    task: "Select Store full scores and probabilities under Score handling. Predict the number of elements written to full intermediate arrays and click Run model. Switch to Online · two keys per tile and rerun. Use Next step to find a rise in the running maximum and inspect how earlier contributions are rescaled.",
    question: 'How many elements are written to full intermediate arrays?',
    transfer: 'If the running maximum increases, what happens to the earlier denominator and weighted sum before the new terms are added?',
    answer: 'Multiply both by exp(old maximum − new maximum). This puts the old terms on the same scale as the new terms.',
  },
  inference: {
    before: 'During decoding, a model appends one key and one value per layer for the new token. It also reads previously cached keys and values for attention. Assume one sequence, 32 layers, 1,024 key values and 1,024 value values per layer and token, and a two-byte format.',
    terms: [['Key-value cache', 'Stored attention keys and values from earlier tokens, reused when decoding the next token.']],
    label: 'Tokens already cached',
    cases: [[128, '128 tokens'], [512, '512 tokens'], [2048, '2,048 tokens']],
    code: sequence => `// CUDA data-layout excerpt. One sequence, 32 layers.
constexpr size_t width = 1024;
constexpr size_t capacity = 2049;
const size_t token = ${sequence}; // first free slot
const size_t base = (layer * capacity + token) * width;
// A CUDA thread copies one coordinate j of this layer.
Kcache[base + j] = newK[j];
Vcache[base + j] = newV[j];`,
    inspect: 'Kcache and Vcache are separate arrays. The allocation can hold 2,049 tokens. The model counts the occupied data prefix and its logical reads, excluding model weights, unused capacity and cache effects.',
    task: "Select 128 tokens under Tokens already cached and click Run model. Change to 512 tokens, predict the MiB of existing key-value data read, then run again. Compare the old-data read with the one-token append: which depends on the history length? One MiB is 1,048,576 bytes.",
    question: 'How many MiB of existing key-value data are read?',
    transfer: 'Which term changes when you increase the context from 512 to 2,048, and which stays fixed?',
    answer: 'The old data read is four times as large. The append still writes 131,072 bytes because it adds one token to the same 32 layers.',
  },
  'matmul-investigation': {
    before: 'Tile reuse reduced input loads in the earlier matrix lesson. Now compare the storage that a block needs. Use 8 × 8 matrices and an imaginary streaming multiprocessor with 128 bytes of shared memory, 1,024 registers, eight warp slots and a limit of eight blocks.',
    terms: [['Resource limit', 'A per-SM capacity that can constrain how many blocks are resident together.']],
    label: 'Compile-time tile width',
    cases: [[1, '1 · direct'], [2, '2 · tiled'], [4, '4 · tiled']],
    code: tile => tile === 1 ? `// Direct version uses no shared tiles.
constexpr int T = 1;
dim3 block(T, T), grid(8 / T, 8 / T);
direct<<<grid, block>>>(A, B, C, 8);` : `// Host launch. One thread owns one C element.
constexpr int T = ${tile};
dim3 block(T, T), grid(8 / T, 8 / T);
tiled<T><<<grid, block>>>(A, B, C, 8);
// The tiled kernel uses two shared float[T][T] arrays.`,
    inspect: 'The model charges 16 registers per thread and one warp slot per block. The resident block limit is per SM assuming enough blocks are available. The displayed example grid may contain fewer blocks.',
    task: "Select 2 · tiled under Compile-time tile width and predict blocks per teaching SM. Click Run model and inspect each resource’s capacity and use per block. Repeat with 4 · tiled. Which resource gives the smaller limit? These calculations do not select the faster real GPU kernel.",
    question: 'How many blocks fit per teaching SM?',
    transfer: 'How would you test whether a width that needs fewer global loads actually finishes faster on a real GPU?',
    answer: 'Use identical inputs, check outputs, warm up both kernels and time repeated launches with CUDA events. Inspect shared memory per block, achieved occupancy and memory traffic in the profiler.',
  },
});
