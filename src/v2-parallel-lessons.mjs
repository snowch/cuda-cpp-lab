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
    task: 'Predict the number of global atomic additions. Run both versions and find which categories still receive additions from both blocks.',
    question: 'How many global atomic additions occur?',
    transfer: 'If every token has category 0, how many global additions does the block-private version make?',
    answer: 'Two. Each of the two blocks sends one non-zero partial for category 0.',
  },
  scan: {
    before: 'The eight input flags are 1, 0, 1, 0, 0, 1, 0, 1. A prefix gives a total over the values before or through a position. Each stage reads from a completed snapshot of the previous stage.',
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
    task: 'Step through the inclusive run. Change to exclusive and predict the value at index 5 before running again.',
    question: 'What is the completed prefix at index 5?',
    transfer: 'Where can a thread get the count of all eight flags if it has only the exclusive output and the original flags?',
    answer: 'Add the final flag to the final exclusive prefix. The last prefix counted all flags except the one at index 7.',
  },
  compaction: {
    before: 'Use the same eight category IDs as the histogram. Keep tokens that match the predicate and turn their flags into exclusive prefixes. Each surviving thread uses its prefix as an output offset.',
    terms: [['Compaction', 'Pack selected inputs into consecutive positions.'], ['Scatter', 'Write each item to its computed destination.']],
    label: 'Keep predicate',
    cases: [['zero', 'Keep category 0'], ['nonzero', 'Keep categories 1–3'], ['none', 'Keep no tokens']],
    code: predicate => `// First kernel, one thread per input token.
flags[i] = ${{zero:'category[i] == 0', nonzero:'category[i] != 0', none:'false'}[predicate]};
// An exclusive scan of flags produces offset.
// After the scan, in the scatter kernel:
if (flags[i]) packed[offset[i]] = i;`,
    inspect: 'The input IDs are 0, 1, 0, 2, 1, 0, 3, 0. The packed array has capacity for all eight inputs. Its used prefix contains original token positions. The model visits writes in reverse order to expose stability.',
    task: 'Predict the destination for the last kept token. Run and inspect the reverse write order. Flip the predicate and predict again. Enter −1 when there are no survivors.',
    question: 'Where does the last kept token write? Enter -1 for no writes.',
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
    task: 'Run the all-thread variant. Change to the conditional form and predict how many threads reach the barrier. Find the missing participants.',
    question: 'How many threads reach the matching barrier?',
    transfer: 'You still need only threads 0 and 1 to read the shared words. Where would you move the condition?',
    answer: 'Put the condition around the reads after the barrier. All four threads first write and arrive, then the two readers can use the completed shared data.',
  },
  pipelines: {
    before: 'Copy four chunks to the GPU and compute on each. Two storage slots alternate between chunks. A copy takes two units and computation takes three units in this model. A copy engine and a compute engine each handle one operation at a time.',
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
    task: 'Run serial, then change to overlap. Predict when chunk 2 can begin copying. Follow slot 0 from chunk 0 through chunk 2.',
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
    task: 'Run the mixed distribution and locate token 4. Change to all tokens in category 0 and predict the new destination for token 4. Explain how the scatter stays stable.',
    question: 'Which output index receives token 4?',
    transfer: 'Design a real GPU comparison between counting and stable grouping. What would you validate and report?',
    answer: 'Check category totals for both. For grouping, also check unique destinations and the order within each category. Time each required stage on identical mixed and skewed inputs and report the GPU, launch sizes and input sizes.',
  },
};
