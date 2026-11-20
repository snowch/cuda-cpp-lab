// Copyright © 2026 Christopher Snow.
export const parallelLessons = {
  histograms: {
    before: 'Eight tokens each name one of four destinations. Two blocks of four threads count the tokens. Several threads may increment the same counter. An atomic addition makes each increment contribute once.',
    terms: [['Histogram', 'A count for each destination.'], ['Atomic addition', 'A read, addition and write that acts as one update to the target counter.']],
    label: 'Where each thread first increments',
    cases: [['global', 'Global counters'], ['private', 'Separate block counters']],
    code: strategy => strategy === 'global' ? `// One thread per token. All global counts start at 0.
int i = blockIdx.x * 4 + threadIdx.x;
atomicAdd(&counts[category[i]], 1);` : `// Two 4-thread blocks; global counts start at 0.
__shared__ int partial[4];
int t = threadIdx.x;
int i = blockIdx.x * 4 + t;
partial[t] = 0;
__syncthreads();
atomicAdd(&partial[category[i]], 1);
__syncthreads();
if (partial[t] != 0) atomicAdd(&counts[t], partial[t]);`,
    inspect: 'The input category IDs in order are 0, 1, 0, 2, 1, 0, 3, 0. In the block variant each thread first zeroes one counter, counts its assigned token, then may merge one non-zero partial.',
    task: "Select Global counters, predict global atomic additions and click Run model. Repeat with Separate block counters. Follow the updates in the trace: which categories still receive a global addition from both blocks?",
    question: 'How many global atomic additions occur?',
    transfer: 'If every token has category 0, how many global additions does the block-private version make?',
    answer: 'Two. Each of the two blocks sends one non-zero partial for category 0.',
  },
  scan: {
    before: 'The eight input flags are 1, 0, 1, 0, 0, 1, 0, 1. A flag is 1 for a selected token and 0 otherwise. A prefix sum counts selected tokens before or through a position. Each stage reads from a completed snapshot of the previous stage.',
    terms: [['Inclusive scan', 'Each output includes the value at its own position.'], ['Exclusive scan', 'Each output includes only the earlier values.']],
    label: 'Prefix returned by the block',
    cases: [['inclusive', 'Inclusive'], ['exclusive', 'Exclusive']],
    code: kind => `// Body for one block of eight threads; output has 8 slots.
__shared__ int s[8];
int t = threadIdx.x;
s[t] = flags[t];
__syncthreads();
for (int d = 1; d < 8; d *= 2) {
  int add = t >= d ? s[t - d] : 0;
  __syncthreads();
  s[t] += add;
  __syncthreads();
}
out[t] = ${kind === 'inclusive' ? 's[t]' : 't > 0 ? s[t - 1] : 0'};`,
    inspect: 'Every thread copies its partner to a register before any writes for that stage. The second barrier completes those writes before the next stage reads.',
    task: "Select Inclusive under Prefix returned by the block and click Run model. Use Next step to follow the staged prefixes. Select Exclusive, predict the completed value at index 5, then run again. Which input flag is omitted from that output?",
    question: 'What is the completed prefix at index 5?',
    transfer: 'Where can a thread get the count of all eight flags if it has only the exclusive output and the original flags?',
    answer: 'Add the final flag to the final exclusive prefix. The last prefix counted all flags except the one at index 7.',
  },
  compaction: {
    before: 'The starter supplies category IDs 0, 1, 0, 2, 1, 0, 3, 0 for token IDs 0–7. The selection rule keeps tokens whose category equals keepCategory. A kept token has flag 1; a dropped token has flag 0. Exclusive prefixes count earlier kept tokens. Each surviving thread uses its prefix as an output offset.',
    terms: [['Compaction', 'Pack selected inputs into consecutive positions.'], ['Scatter', 'Write each item to its computed destination.']],
    label: 'Keep predicate',
    cases: [['zero', 'Keep category 0'], ['nonzero', 'Keep categories 1–3'], ['none', 'Keep no tokens']],
    code: predicate => `// First kernel, one thread per input token.
flags[i] = ${{zero:'category[i] == 0', nonzero:'category[i] != 0', none:'false'}[predicate]};
// An exclusive scan of flags produces offset.
// After the scan, in the scatter kernel:
if (flags[i]) packed[offset[i]] = i;`,
    inspect: 'The category IDs are 0, 1, 0, 2, 1, 0, 3, 0. The packed array has capacity for all eight inputs. Its used prefix contains original token positions. The model visits writes in reverse order to expose stability.',
    task: "Select Keep category 0 and predict the output offset of the last kept token. Click Run model and inspect the reverse write order. Select Keep categories 1–3 and predict again before rerunning. For Keep no tokens, enter −1 because no thread writes an output.",
    question: 'Where does the kept token with the highest input index write? Enter -1 for no writes.',
    transfer: 'Could a dropped token and a kept token have the same exclusive offset? Why is the scatter still safe?',
    answer: 'Yes. A dropped token does not increase the prefix and never writes. Each kept token increases the running count once, so its write offset is unique.',
  },
  progress: {
    before: 'Four threads initialise shared storage. Every thread must reach the same block barrier before dependent work begins. Changing the branch around the barrier changes who reaches it.',
    terms: [['Participation', 'The threads that reach a particular collective operation.'], ['Progress dependency', 'An action that has to occur before another action can continue.']],
    label: 'Threads that reach the barrier',
    cases: [['all', 'All four'], ['subset', 'Only threads 0 and 1']],
    code: participation => `// One four-thread block. Each writes one shared word.
s[threadIdx.x] = input[threadIdx.x];
${participation === 'all' ? '__syncthreads();' : 'if (threadIdx.x < 2) __syncthreads();'}
// Dependent reads would follow here.`,
    inspect: 'The invalid case is a diagnostic. Its trace counts arrivals and skips without assigning a CUDA runtime or numeric outcome.',
    task: "Select All four under Threads that reach the barrier and click Run model. Select Only threads 0 and 1, predict the arrivals and rerun. Identify the missing participants in the trace. The diagnostic counts participation; it does not execute an invalid CUDA barrier.",
    question: 'How many threads reach the matching barrier?',
    transfer: 'You still need only threads 0 and 1 to read the shared words. Where would you move the condition?',
    answer: 'Put the condition around the reads after the barrier. All four threads first write and arrive, then the two readers can use the completed shared data.',
  },
  pipelines: {
    before: 'Copy four chunks to the GPU and compute on each. Two storage slots alternate between chunks. An input copy takes two units and computation takes three units in this model. Result copies are omitted; the slot becomes reusable after computation here. The CUDA program also copies results back before releasing a slot. A copy engine and a compute engine each handle one operation at a time.',
    terms: [['Stream', 'An ordered queue of CUDA operations.'], ['Event', 'A marker that another stream can wait for before issuing dependent work.']],
    label: 'Copy and kernel organisation',
    cases: [['serial', 'Serial copy then compute'], ['pipeline', 'Overlap with two reusable slots']],
    code: mode => mode === 'serial' ? `// CUDA host loop. Each chunk has distinct host input.
// Both operations use one stream.
cudaMemcpyAsync(slot, host[i], bytes,
                cudaMemcpyHostToDevice, stream);
process<<<grid, block, 0, stream>>>(slot);` : `// CUDA host loop. s = i % 2. Host input is pinned.
if (i >= 2) cudaStreamWaitEvent(copy, used[s], 0);
cudaMemcpyAsync(slot[s], host[i], bytes,
                cudaMemcpyHostToDevice, copy);
cudaEventRecord(ready[s], copy);
cudaStreamWaitEvent(compute, ready[s], 0);
process<<<grid, block, 0, compute>>>(slot[s]);
cudaEventRecord(used[s], compute);`,
    inspect: 'The compute stream waits for the chunk’s copy. The copy stream waits for the prior consumer before overwriting that slot. The host creates the streams and events before the loop and waits for final completion before reuse or free.',
    task: "Select Serial copy then compute and click Run model. Select Overlap with two reusable slots, predict the time unit when chunk 2 starts copying, then rerun. Follow slot 0 from chunk 0 to chunk 2. Time units belong to this illustrative schedule, not a GPU measurement.",
    question: 'At which time unit does chunk 2 begin its copy?',
    transfer: 'Why can the copy engine be idle while chunk 2 is available on the host?',
    answer: 'Chunk 0 is still using slot 0. Copying chunk 2 there would overwrite its input before computation finished.',
  },
  'token-routing': {
    before: 'A routing stage sends tokens to destinations, such as experts in a model. First count each category to determine its range in the output. Within the range, give each token a rank that preserves its original order.',
    terms: [['Stable grouping', 'Members of the same category keep their relative input order.'], ['Category start', 'The exclusive prefix of the category counts.']],
    label: 'Category distribution',
    cases: [['mixed', 'Mixed categories'], ['hot', 'All tokens in category 0']],
    code: distribution => `// Host categories: ${distribution === 'mixed' ? '0, 1, 0, 2, 1, 0, 3, 0' : '0, 0, 0, 0, 0, 0, 0, 0'}.
// Earlier stages compute counts, starts and stable ranks.
// Scatter kernel (each thread i owns token i):
int bin = category[i];
int destination = start[bin] + rank[i];
grouped[destination] = i;`,
    inspect: 'The rank is the number of earlier input tokens in the same category. A global atomic increment alone can allocate unique ranks but does not guarantee input order.',
    task: "Select Mixed categories and click Run model. Use Next step until token 4 is placed in the grouped output. Select All tokens in category 0, predict token 4’s new output index, then rerun. Check the order of token IDs inside each category’s output range.",
    question: 'Which output index receives token 4?',
    transfer: 'Design separate GPU measurements for a count-only pipeline and a stable-grouping pipeline. Which application needs only category totals, and which needs token IDs in stable order? What would you validate and report for each output contract?',
    answer: 'Check category totals for both. For grouping, also check unique destinations and the order within each category. For a native measurement, time every required stage on identical mixed and skewed inputs and report the GPU, launch sizes and input sizes. Counting and grouping produce different outputs, so their time ratio is not a speedup between interchangeable implementations.',
  },
};
