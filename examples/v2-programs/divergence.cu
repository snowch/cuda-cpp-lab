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

constexpr bool alternateSigns = true;

__global__ void transform(const float* input, float* output) {
    int lane = threadIdx.x;
    float value = input[lane];
    if (value < 0.0f) output[lane] = -value;
    else output[lane] = value * 2.0f;
}

int main() {
    float values[32];
    for (int i = 0; i < 32; ++i) values[i] = alternateSigns && i % 2 ? -2.0f : 2.0f;
    float *input, *output;
    check(cudaMalloc(&input, sizeof(values)));
    check(cudaMalloc(&output, sizeof(values)));
    check(cudaMemcpy(input, values, sizeof(values), cudaMemcpyHostToDevice));
    transform<<<1, 32>>>(input, output);
    check(cudaGetLastError());
    check(cudaMemcpy(values, output, sizeof(values), cudaMemcpyDeviceToHost));
    std::printf("Lane 0: %.1f; lane 1: %.1f\n", static_cast<double>(values[0]), static_cast<double>(values[1]));
    check(cudaFree(input));
    check(cudaFree(output));
}
