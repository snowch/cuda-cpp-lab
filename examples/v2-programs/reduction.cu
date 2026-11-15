// Copyright © 2026 Christopher Snow.
#include <cuda_runtime.h>
#include <cstdio>
#include <cstdlib>

void check(cudaError_t status) {
    if (status != cudaSuccess) {
        std::fprintf(stderr, "%s\n", cudaGetErrorString(status));
        std::exit(EXIT_FAILURE);
    }
}

constexpr int threads = 4;
static_assert(threads == 4 || threads == 8, "Choose 4 or 8 threads.");

__global__ void sum(const float* input, float* output) {
    __shared__ float scratch[threads];
    int t = threadIdx.x;
    scratch[t] = input[t];
    __syncthreads();
    for (int distance = threads / 2; distance > 0; distance /= 2) {
        if (t < distance) scratch[t] += scratch[t + distance];
        __syncthreads();
    }
    if (t == 0) output[0] = scratch[0];
}

int main() {
    float values[threads];
    for (int i = 0; i < threads; ++i) values[i] = i + 1;
    float *input, *output;
    check(cudaMalloc(&input, sizeof(values)));
    check(cudaMalloc(&output, sizeof(float)));
    check(cudaMemcpy(input, values, sizeof(values), cudaMemcpyHostToDevice));
    sum<<<1, threads>>>(input, output);
    check(cudaGetLastError());
    float result;
    check(cudaMemcpy(&result, output, sizeof(result), cudaMemcpyDeviceToHost));
    std::printf("Sum: %.1f\n", static_cast<double>(result));
    check(cudaFree(input));
    check(cudaFree(output));
}
