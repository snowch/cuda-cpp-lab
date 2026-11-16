// Copyright © 2026 Christopher Snow.
// Lesson-specific bridges, execution relationships and hardware emphasis.
// Code is extracted from the same starters as the editable workbench.
import { readFileSync } from 'node:fs';
import { v2Course } from './v2-course.mjs';
const workbench = readFileSync(new URL('./v2-cuda-source-workbench.html', import.meta.url), 'utf8');
const line = workbench.split('\n').find(line => line.startsWith('<script>const lab = '));
const lab = JSON.parse(line.slice('<script>const lab = '.length).replace(/;$/, ''));
export function starterFor(slug) {
  if (slug === 'first-kernel') return readFileSync(new URL('../examples/first-kernel.cu', import.meta.url), 'utf8');
  if (slug === 'coalescing') return lab.coalescingProgram;
  if (v2Course.find(lesson => lesson.slug === slug)?.mode) {
    return lab.arrayProgram;
  }
  return readFileSync(new URL('../examples/v2-programs/' + slug + '.cu', import.meta.url), 'utf8');
}

// [excerpt start, excerpt end, explanation, hardware focus, hardware connection,
//  execution stages, reference topics]. The excerpts are contiguous source text.
const rows = {
  'one-thread-one-element': ['__global__', '\n}\n',
    'runKernel uses i to select the same position in input and output. The caller passes n as an element count and supplies separate GPU arrays. Every launched thread runs this body; the index chooses its data.',
    'sm', 'The SM executes the threads in the assigned block. Threads are logical executions with their own values; they do not each own a physical arithmetic unit.',
    [['Read input[i]', 'Choose an element using the thread index.'], ['Multiply', 'Apply the multiplier in runKernel.'], ['Write output[i]', 'Keep the same destination index.']], ['index', 'launch']],
  'more-threads-than-elements': ['__global__', '\n}\n',
    'blockIdx.x identifies a block, blockDim.x its size, and threadIdx.x the local thread index. Their combination gives i. The caller passes n separately; i < n protects both array accesses when the launch has spare threads.',
    'sm', 'A block is assigned to an SM. More launched threads do not create more execution units. A thread beyond n still exists but skips the guarded array operations.',
    [['Form index i', 'Combine block and local thread indices.'], ['Check i < n', 'The element count comes from the caller.'], ['Write or skip', 'Only valid indices access the arrays.']], ['index', 'launch']],
  'from-cpu-array-to-gpu-result': ['  CUDA_CHECK(cudaMalloc', '\n  const int threadsPerBlock',
    'cudaMalloc reserves GPU storage for d_x and d_y. cudaMemcpy copies sizeof(x) bytes from CPU array x to d_x. The later kernel launch passes n elements, and a device-to-host copy fills CPU array y before it is printed.',
    'memory', 'CPU arrays live in system RAM. Device arrays live in GPU device memory. Allocation reserves storage; copying moves values, and the SM executes the calculation.',
    [['Allocate', 'Reserve separate GPU input and output storage.'], ['Copy input', 'Move x from CPU memory to d_x.'], ['Run and read back', 'Write d_y, then copy its values to y.']], ['memory', 'launch']],
  coalescing: ['__global__', '\n}\n',
    'runKernel launches one warp of 32 threads. stride sets the distance between input indices, while output remains contiguous. n counts outputs; the input allocation must also cover the largest strided read. The host groups returned indices into sectors.',
    'global', 'One warp issues a load with an address for each active lane. The memory path groups these addresses into requests. Caches may supply data before device memory is accessed; a sector count is not a count of DRAM reads.',
    [['Lane addresses', 'Each lane selects input[lane × stride].'], ['Group addresses', 'Aligned sectors group the requested words.'], ['Return values', 'Each lane writes its contiguous output slot.']], ['coalescing', 'memory']],
  scheduling: ['__global__', '\n}\n',
    'doubleValues gives each thread two elements, separated by blockDim.x. Each assignment needs a loaded input before its multiply. main sets threads from warpsPerBlock and allocates twice as many elements. The teaching trace models this dependency, not compiler instruction order.',
    'scheduler', 'An SM keeps resident warps and their register values available. A warp scheduler selects a ready instruction for an appropriate execution unit. Another warp can issue while a load dependency blocks the first.',
    [['Load', 'A warp requests its input values.'], ['Wait or issue another warp', 'Only instructions with ready operands can issue.'], ['Multiply and store', 'Use the returned values and write results.']], ['scheduling', 'occupancy']],
  divergence: ['__global__', '\n}\n',
    'transform tests the sign of each lane’s value. Negative values are negated; the other path doubles its values. All 32 threads belong to one warp. alternateSigns in main changes the input signs, rather than the kernel’s branch condition.',
    'execution', 'A warp instruction has participating lanes. Different branch paths can require different active lane sets. These lanes are logical positions in a warp, not a drawing of separate dedicated processors.',
    [['Test signs', 'Each lane evaluates value < 0.0f.'], ['Execute paths', 'Only participating lanes update their outputs.'], ['Continue', 'The warp proceeds after the branch.']], ['simt', 'index']],
  reduction: ['__global__', '\n}\n',
    'sum first copies each input to shared scratch storage. A block barrier makes those writes available before partner reads. Each loop stage adds a partner value, and every thread reaches the following barrier, including threads that skipped the addition.',
    'shared', 'Shared memory belongs to the SM and is allocated per resident block. A block barrier orders participating threads; it does not synchronise other blocks on this SM or elsewhere.',
    [['Write shared inputs', 'Each thread supplies its own value.'], ['Synchronise', 'Complete writes before partner reads.'], ['Combine stages', 'Add partners and synchronise before reuse.']], ['shared', 'barriers']],
  'shared-memory-banks': ['__global__', '\n}\n',
    'readWords cooperatively initialises shared words, then all threads reach a barrier. Each lane reads words[lane * stride]. The returned integers identify word addresses. The host calculates service rounds for the stated bank model; the console is not a hardware timer.',
    'banks', 'Shared memory is organised into banks that can serve requests in parallel. In this model, word index modulo 32 selects a bank. Repeated requests for one word can broadcast; different words in one bank need separate rounds.',
    [['Initialise shared words', 'Complete the block barrier before reads.'], ['Select words', 'Each lane forms lane × stride.'], ['Group by bank', 'Distinguish broadcasts from different-word conflicts.']], ['banks', 'barriers']],
  matmul: ['    for (int begin', '\n    c[row',
    'Inside multiply, the block loads left and right tiles into shared memory. After the barrier, each output thread accumulates products using those tiles. The second barrier prevents the next load from overwriting a tile while another thread still reads it. main defines width, tile and the two-dimensional launch.',
    'shared', 'Threads reuse shared tiles while each output sum is working state associated with its thread. This multiply kernel uses scalar arithmetic; it does not call matrix-unit instructions.',
    [['Load tiles', 'Threads fill shared left and right arrays.'], ['Reuse operands', 'Several outputs consume the same tile values.'], ['Protect reuse', 'Synchronise before loading the next tiles.']], ['shared', 'barriers']],
  precision: ['__global__', '\n}\n',
    'dot optionally rounds each FP32 input to FP16 with __float2half_rn and converts it back with __half2float. total remains FP32. This starter isolates rounding while its arrays remain FP32; the model separately compares storage formats.',
    'registers', 'Registers hold a thread’s working operands and accumulator. Rounding an operand can change a sum even when the accumulation stays FP32. This example uses conversions and scalar additions, not tensor cores.',
    [['Read FP32', 'Fetch a value from the input array.'], ['Optionally round', 'Convert to FP16 and back before adding.'], ['Accumulate FP32', 'Keep total in the wider format.']], ['half', 'memory']],
  'tensor-cores': ['    w::fill_fragment', '\n}',
    'Inside tile, left and right are FP16 matrix fragments and sum is an FP32 accumulator fragment. fill_fragment sets the initial accumulator; the loads use a row stride of 16 elements. All 32 threads call the same warp-wide operations with matching pointers and parameters.',
    'tensor', 'Tensor cores are matrix execution units inside an SM. A warp collectively supplies register fragments for matrix instructions. WMMA’s fragment layout is device-dependent; a source tile is not a diagram of individual tensor-core units.',
    [['Load fragments', 'The warp supplies A and B operands.'], ['Matrix multiply-accumulate', 'Combine operands with the existing accumulator.'], ['Store the tile', 'Write the updated accumulator to C.']], ['wmma', 'simt']],
  attention: ['        float keep', '\n        maximum = next;',
    'Inside onlineAttention, next is the new maximum score found for the tile. expf supplies the rescaling factor and weights. denominator and weighted carry the running totals. This correctness example uses one GPU thread over eight keys; it is not a parallel FlashAttention implementation.',
    'registers', 'Running totals can remain as thread working state while successive key and value tiles are read. Avoiding a full score array changes intermediate storage. Real parallel attention kernels also use shared memory and matrix units according to their implementation.',
    [['Find tile maximum', 'Compare scores with the running maximum.'], ['Rescale and add', 'Carry a denominator and weighted sum forward.'], ['Normalise', 'Divide after processing all key tiles.']], ['math', 'memory']],
  inference: ['__global__', '\n}\n',
    'append reads cached keys and values for each lane, then writes the next token slot. cached is the number of old tokens, width the values per token, and capacity the allocated token slots. The printed byte count accounts for requested payload, not measured memory traffic.',
    'memory', 'The key-value cache here is an application data structure in device memory. It is distinct from the GPU’s L1 and L2 hardware caches. Longer histories request more old key and value data.',
    [['Read history', 'Accumulate old keys and values.'], ['Append token', 'Write the new key and value slot.'], ['Read back', 'Inspect the accumulated result on the CPU.']], ['memory', 'coalescing']],
  'matmul-investigation': ['    for (int begin', '\n    c[row',
    'Inside multiply, tile sets both shared array dimensions and the block’s two-dimensional thread shape. main derives the grid from width and tile. Compare equal products before interpreting calculated load counts and shared bytes; those counts alone do not identify a faster kernel.',
    'shared', 'Each resident block consumes shared storage and registers on its SM. Larger tiles can improve reuse while reducing how many blocks fit. The teaching resource budget is separate from the device-specific occupancy limits.',
    [['Choose tile width', 'Set the block shape and shared arrays.'], ['Verify the product', 'Check correctness before comparing resources.'], ['Form a hypothesis', 'Measure the real GPU to test performance.']], ['occupancy', 'shared']],
  histograms: ['        __shared__', '\n    } else',
    'Inside histogram, partial holds four counters shared by one four-thread block. Each thread clears one counter; a barrier precedes atomic updates. A second barrier completes those updates before nonzero partials are added to the global counts. main initialises global counts to zero.',
    'shared', 'Per-block shared counters combine local contributions before a merge to device-memory counters. An atomic update protects one supported update; it does not replace the block barriers around initialisation and merging.',
    [['Initialise counters', 'Clear shared and global counts.'], ['Count atomically', 'Several threads may target the same category.'], ['Merge partials', 'Add completed per-block counts globally.']], ['atomics', 'barriers']],
  scan: ['__global__', '\n}\n',
    'scan stores eight flags in shared values. For each step, all threads finish the old stage, read a partner into previous, and reach another barrier before updating shared storage. Subtracting flags[t] converts the inclusive prefix to an exclusive offset.',
    'shared', 'A shared-memory stage lets a block exchange prefix values. Registers keep the partner value separate while a barrier protects the old shared snapshot. A block barrier does not order a multi-block scan.',
    [['Read old stage', 'Keep the partner value in previous.'], ['Synchronise', 'Finish old reads before any thread updates.'], ['Write new stage', 'Add the partner; repeat at the next distance.']], ['barriers', 'shared']],
  compaction: ['__global__ void scatter', '\n}\n',
    'flag first marks selected categories. scatter counts earlier keep flags to obtain an exclusive offset, then writes the original token ID t. Both kernels are launched in order in the same stream. This small reference counts earlier flags directly; the model explains the scan-based construction.',
    'global', 'Flags produced in device memory must be ready before scatter consumes them. Unique offsets give selected threads distinct destinations. Stable output order follows the offsets, not the order in which warps happen to run.',
    [['Flag tokens', 'Record whether each token survives.'], ['Count earlier survivors', 'Form an exclusive destination offset.'], ['Scatter IDs', 'Write each selected token once.']], ['streams', 'index']],
  progress: ['__global__', '\n}\n',
    'exchange launches four threads. Every thread writes its shared slot and reaches __syncthreads before the readers condition. readers changes who consumes the values, not who must participate in the barrier.',
    'scheduler', 'Resident threads can wait for other threads at a block barrier. Enough hardware resources alone do not repair a missing participant. This safe kernel keeps the barrier outside the conditional reads.',
    [['Publish shared values', 'All four threads supply a value.'], ['All arrive', 'Keep the barrier outside t < readers.'], ['Selected threads read', 'Only the consumer set changes.']], ['barriers', 'occupancy']],
  pipelines: ['        check(cudaEventRecord(ready', '\n        check(cudaGetLastError',
    'In main, ready[s] is recorded after the input copy in copy’s stream. cudaStreamWaitEvent orders compute after that event, and process doubles the slot values. Later, used[s] is recorded after the output copy; the next reuse waits for it. Streams are ordered queues, and events connect their dependencies.',
    'copy', 'Copy engines can transfer data while SMs execute independent kernels, if the device and workload support overlap. Streams express ordering, not dedicated hardware. A reusable buffer must wait for its previous consumer, even when its next copy is ready.',
    [['Copy and record ready', 'Finish supplying the slot’s input.'], ['Wait and compute', 'Order the kernel after its input event.'], ['Record consumed', 'Protect the slot until output copying finishes.']], ['streams', 'events']],
  'token-routing': ['__global__ void route', '\n}\n',
    'count first builds a four-bin histogram with atomics. In route, start counts tokens in earlier categories and rank counts earlier tokens in the same category. Their sum is a unique stable destination. The count and route launches share a stream, so the histogram is ready before route reads it.',
    'global', 'Device-memory phase results connect counting to placement. Atomics can count safely, but the order of atomic arrivals alone does not preserve token order. The explicit earlier-token rank supplies stability.',
    [['Count categories', 'Build counts before routing starts.'], ['Find start and rank', 'Combine the category region and local order.'], ['Write token ID', 'Give each token a unique stable slot.']], ['atomics', 'streams']],
};
export const lessonContexts = Object.fromEntries(Object.entries(rows).map(([slug, [start, end, explanation, focus, hardware, stages, references]]) => {
  const source = starterFor(slug);
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error('Missing starter excerpt: ' + slug);
  const code = source.slice(from, to + (end === '\n}\n' ? 2 : 0)).replace(start.startsWith('__global__') ? /$^/g : /^ {4}/gm, '');
  const kernelName = [...source.matchAll(/__global__\s+void\s+(\w+)\s*\(/g)].filter(match => match.index <= from).at(-1)?.[1];
  const inMain = from >= source.indexOf('int main()');
  const label = `CUDA C++ · ${inMain ? 'main() · host excerpt' : kernelName + (start.startsWith('__global__') ? ' · starter kernel' : ' · kernel body excerpt')}`;
  const launches = [...source.matchAll(/^\s*\w+<<<[^]*?;/gm)].map(match => match[0].trim()).join('\n');
  return [slug, {code, label, launches, explanation, focus, hardware, stages, references}];
}));

// Some teaching models use different shapes or deliberately synthetic machinery.
// Keep those assumptions with the model, rather than describing the editor's run.
const introductions = {
  scheduling: 'Each thread doubles two input values. A multiply needs its loaded input before it can proceed. The optional execution model shows how a ready warp can issue while another waits for data on the same SM.',
  'shared-memory-banks': 'Shared memory is divided into banks that serve groups of word addresses. This starter reads four-byte integer words so the returned values identify their addresses. The optional model uses four-byte FP32 words to explore the same bank mapping and broadcasts.',
  precision: 'The first eight inputs are 1.0003f and the next eight are −1.0f. The starter optionally rounds each input through FP16 before adding it to an FP32 total. Its input arrays remain FP32; the optional model separately compares input storage formats.',
  attention: 'Attention forms scores from a query and keys. Softmax converts those scores to weights for a weighted sum of values. This starter follows one scalar query over eight scalar keys and values; the optional model expands the calculation to vectors.',
  inference: 'A decoding step reads old keys and values and appends a new token’s key and value. This starter represents one layer with four FP32 values per key and per value. cached selects the old token count; the optional model accounts for a larger multi-layer cache.',
  'matmul-investigation': 'Compare tile reuse with the storage each block needs. This starter multiplies 8 × 8 matrices and prints calculated input loads and shared bytes per block. The optional resource model uses an explicitly imaginary SM budget to explore how many blocks could fit.',
  progress: 'Four threads initialise shared storage, and every thread reaches the block barrier before any dependent read. readers changes which threads consume neighbouring values. The optional model separately diagnoses what happens when a barrier’s participant set is incomplete.',
  pipelines: 'Four chunks pass through two reusable GPU storage slots. CUDA streams queue the copies and kernels, and events order their dependencies. The starter checks the resulting values; the optional model explores overlap using explicitly synthetic durations.',
};
for (const [slug, introduction] of Object.entries(introductions)) lessonContexts[slug].introduction = introduction;
