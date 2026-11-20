// Copyright © 2026 Christopher Snow.
export const practicalActivities = {
  'verify-every-output': {
    title: 'Test a candidate result',
    instruction: 'The page calculates the candidate for your selected Matrix inputs and Candidate result. Click Run model and inspect Candidate, CPU reference and Check. Select Right matrix transposed by mistake under Candidate result. Run with All ones, then with Nonuniform rows and columns under Matrix inputs: which dataset exposes the error?',
    ready: 'Choose Matrix inputs and Candidate result, then click Run model.',
    optional: 'Explore verification cases',
  },
  'grid-stride-loops': {
    title: 'Trace each thread’s visits',
    instruction: 'Set Input elements to 70 and Blocks to 2. Predict thread 0’s visit count, then click Run model. In Thread visits, inspect the input/output indices for thread 0. Change Blocks from 2 to 1 and predict again: does thread 0 visit more indices?',
    ready: 'Enter a visit-count prediction, then click Run model.',
    optional: 'Explore grid-stride visits',
  },
  'multi-block-scan': {
    title: 'Combine block starts and local offsets',
    instruction: 'Set Flag count to 97 and predict the last block’s start, then click Run model. In Cross-block prefix construction, compare Total and Start. Use Global offsets to check how a block start contributes to its first valid output. For zero flags, predict 0; no block is launched.',
    ready: 'Enter a block-start prediction, then click Run model.',
    optional: 'Explore cross-block offsets',
  },
  'resource-tradeoffs': {
    title: 'Compare SM resource limits',
    instruction: 'Set Threads per block to 256, Registers per thread to 32 and Shared memory per block to 16 KiB. Click Run model and find which row has the smallest Maximum blocks from this resource value. Keep the thread count and shared memory unchanged, set Registers per thread to 96 and predict resident blocks before running again. Does the limiting resource change?',
    ready: 'Enter a resident-block prediction, then click Run model.',
  },
  'measure-a-kernel': {
    title: 'Inspect your timing report',
    instruction: 'Paste the complete report.json produced by the native benchmark into the report field and click Analyse report. Compare Separate and Fused using Median, Min and Max in milliseconds. Do the sample ranges overlap? If they do, the median ratio alone is weak evidence for choosing the faster variant. Repeat the native benchmark with the same settings before drawing a timing conclusion.',
    ready: 'Paste your benchmark report, then click Analyse report.',
  },
  'softmax-capstone': {
    title: 'Check a row from your implementation',
    instruction: 'Choose a Reference row. Run your implementation on those displayed logits, then paste its output values and click Check my row. Compare Your value with Stable reference for each Column. This checker uses a different dataset from the editor’s default generated inputs.',
    ready: 'Paste output values for the selected Reference row, then click Check my row.',
    optional: 'Check an additional softmax row',
  },
};
