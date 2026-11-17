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
    instruction: 'Set Input elements and Blocks. Predict thread 0’s visit count, then click Run model. In Thread visits, inspect the input/output indices for thread 0. Change Blocks from 2 to 1 and predict again: does thread 0 visit more indices?',
    ready: 'Enter a visit-count prediction, then click Run model.',
    optional: 'Explore grid-stride visits',
  },
  'multi-block-scan': {
    title: 'Combine block starts and local offsets',
    instruction: 'Set Flag count and predict the last block’s start, then click Run model. In Cross-block prefix construction, compare Total and Start. Use Global offsets to check how a block start contributes to its first valid output. For zero flags, predict 0; no block is launched.',
    ready: 'Enter a block-start prediction, then click Run model.',
    optional: 'Explore cross-block offsets',
  },
  'resource-tradeoffs': {
    title: 'Compare SM resource limits',
    instruction: 'Choose Threads per block, Registers per thread and Shared memory per block. Predict resident blocks, then click Run model. Find the smallest Maximum blocks from this resource value: it sets the residency bound. Change one resource and check whether that minimum changes.',
    ready: 'Enter a resident-block prediction, then click Run model.',
  },
  'measure-a-kernel': {
    title: 'Inspect your timing report',
    instruction: 'Paste the complete report.json produced by the native benchmark into the report field and click Analyse report. Compare Separate and Fused using Median, Min and Max in milliseconds. Is the median ratio supported by distinct sample ranges, or do the ranges overlap?',
    ready: 'Paste your benchmark report, then click Analyse report.',
  },
  'softmax-capstone': {
    title: 'Check a row from your implementation',
    instruction: 'Choose a Reference row. Run your implementation on those displayed logits, then paste its output values and click Check my row. Compare Your value with Stable reference for each Column. This checker uses a different dataset from the editor’s default generated inputs.',
    ready: 'Paste output values for the selected Reference row, then click Check my row.',
    optional: 'Check an additional softmax row',
  },
};
