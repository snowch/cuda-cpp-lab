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

constexpr int warpsPerBlock = 1;
constexpr int threads = warpsPerBlock * 32;
constexpr int elements = threads * 2;

__global__ void doubleValues(const float* input, float* output) {
    int i = threadIdx.x;
    output[i] = input[i] * 2.0f;
    i += blockDim.x;
    output[i] = input[i] * 2.0f;
}

int main() {
    float values[elements];
    for (int i = 0; i < elements; ++i) values[i] = i + 1;
    float *input, *output;
    check(cudaMalloc(&input, sizeof(values)));
    check(cudaMalloc(&output, sizeof(values)));
    check(cudaMemcpy(input, values, sizeof(values), cudaMemcpyHostToDevice));
    doubleValues<<<1, threads>>>(input, output);
    check(cudaGetLastError());
    check(cudaMemcpy(values, output, sizeof(values), cudaMemcpyDeviceToHost));
    std::printf("Threads: %d; values: %d; last output: %.1f\n",
                threads, elements, static_cast<double>(values[elements - 1]));
    check(cudaFree(input));
    check(cudaFree(output));
}
