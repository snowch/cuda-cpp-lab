// Copyright © 2026 Christopher Snow.
import { kernelSource, launchPlan } from './hello-model.mjs';

export const v2Experiments = {
  scale: { label: 'Multiplier', choices: [0.5, 2, 3], initial: 2 },
  bounds: { label: 'Threads per block', choices: [3, 4, 8], initial: 4 },
  copies: { label: 'Number of inputs', choices: [5, 9], initial: 5 },
};

export const fp32 = value => value.toFixed(1);

export function v2Run(mode, choice) {
  if (!v2Experiments[mode]?.choices.includes(choice)) throw new RangeError('Unsupported source edit.');
  const count = mode === 'copies' ? choice : 5;
  const size = mode === 'bounds' ? choice : mode === 'scale' ? 5 : 4;
  const factor = mode === 'scale' ? choice : 2;
  const plan = launchPlan(count, size);
  const input = Array.from({ length: count }, (_, index) => index + 1);
  const output = input.map(value => Math.fround(value * factor));
  const threads = Array.from({ length: plan.threads }, (_, index) => ({
    index,
    block: Math.floor(index / size),
    local: index % size,
    output: output[index] ?? null,
  }));
  const kernel = kernelSource(factor);
  const literals = input.map(value => fp32(value) + 'f');
  const rows = Array.from({ length: Math.ceil(count / 5) }, (_, row) =>
    '  ' + literals.slice(row * 5, (row + 1) * 5).join(', '));
  const hostInput = `const float x[] = {
${rows.join(',\n')}
};
const int n = sizeof(x) / sizeof(x[0]);
float y[n];
float *d_x, *d_y;`;
  const launch = `const int threadsPerBlock = ${size};
const int blocks =
    (n + threadsPerBlock - 1) / threadsPerBlock;
runKernel<<<blocks, threadsPerBlock>>>(
    d_x, d_y, n);`;
  const phases = [
    { label: 'Allocate GPU arrays', code: 'CUDA_CHECK(cudaMalloc(&d_x, sizeof(x)));\nCUDA_CHECK(cudaMalloc(&d_y, sizeof(y)));' },
    { label: 'Copy input to the GPU', code: 'CUDA_CHECK(cudaMemcpy(\n    d_x, x, sizeof(x),\n    cudaMemcpyHostToDevice));' },
    { label: 'Run the kernel', code: launch + '\nCUDA_CHECK(cudaGetLastError());\nCUDA_CHECK(cudaDeviceSynchronize());' },
    { label: 'Copy results to the CPU', code: 'CUDA_CHECK(cudaMemcpy(\n    y, d_y, sizeof(y),\n    cudaMemcpyDeviceToHost));' },
  ];
  const hostBody = [hostInput, ...phases.map(phase => phase.code)].join('\n\n')
    .split('\n').map(line => line ? '  ' + line : line).join('\n');
  const source = `// GPU Lab V2 · hello.cu
#include <cuda_runtime.h>
#include <cstdio>
#include <cstdlib>

void check(cudaError_t status) {
  if (status != cudaSuccess) {
    std::fprintf(stderr, "%s\\n", cudaGetErrorString(status));
    std::exit(1);
  }
}
#define CUDA_CHECK(call) check(call)

${kernel}

int main() {
${hostBody}

  std::printf("Output: [");
  for (int i = 0; i < n; ++i) {
    std::printf("%s%g", i ? ", " : "", static_cast<double>(y[i]));
  }
  std::printf("]\\n");
  CUDA_CHECK(cudaFree(d_x));
  CUDA_CHECK(cudaFree(d_y));
}
`;
  const excerpts = { scale: kernel, bounds: kernel + '\n\n// In main(), after copying the input:\n' + launch,
    copies: hostInput + '\n\n' + phases[0].code };
  return { ...plan, factor, input, output, threads, phases, source,
    bytes: count * 4, excerpt: excerpts[mode] };
}
