// Copyright © 2026 Christopher Snow.
import { readFileSync } from 'node:fs';
export function practicalSource(slug) {
  const file=slug==='softmax-capstone'?'softmax-reference':slug;
  const source=readFileSync(new URL('../examples/v2-practical/'+file+'.cu',import.meta.url),'utf8');
  if(slug!=='softmax-capstone')return source;
  return source.replace(/\/\/ BEGIN SOFTMAX KERNEL[^]*?\/\/ END SOFTMAX KERNEL/,`// BEGIN SOFTMAX KERNEL
__global__ void rowSoftmax(const float* input, float* output, int cols) {
    int t = threadIdx.x, row = blockIdx.x;
    // Implement the row maximum, shifted exponential sum and normalisation.
    // All threads must participate in the shared reductions.
    // The untouched scaffold writes zero and deliberately fails verification.
    for (int col = t; col < cols; col += 32)
        output[row * cols + col] = 0.0f;
}
// END SOFTMAX KERNEL`);
}
export function practicalRuntime(html) {
  // Extend the existing workbench's deliberately small cmath shim with the
  // host expf needed by an independent CPU softmax reference. Device expf
  // still compiles to the existing PTX approximation.
  const prefix='<script>const lab = ';
  const line=html.split('\n').find(line=>line.startsWith(prefix));
  if(!line)throw new Error('Missing workbench payload');
  const lab=JSON.parse(line.slice(prefix.length).replace(/;$/,''));
  const marker='  cmath: `\n#pragma once\n';
  if(!lab.worker.includes(marker)||(lab.worker.match(/const runtime = \{/g)||[]).length!==2)throw new Error('Review the workbench math shim before updating it.');
  lab.worker=lab.worker.replace(marker,marker+'extern "C" __attribute__((host)) float expf(float);\n')
    .replaceAll('const runtime = {','const runtime = {\n    expf: value => Math.fround(Math.exp(value)),');
  return html.replace(line,prefix+JSON.stringify(lab).replaceAll('<','\\u003c')+';');
}
