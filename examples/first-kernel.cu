// Copyright © 2026 Christopher Snow.
#include <cuda_runtime.h>
#include <cstdio>
#include <cstdlib>

__global__ void hello(float* output) {
    output[0] = 42.0f;
}

int main() {
    float* output = nullptr;
    cudaError_t result = cudaMalloc(&output, sizeof(float));
    if (result != cudaSuccess) {
        std::fprintf(stderr, "%s\n", cudaGetErrorString(result));
        return EXIT_FAILURE;
    }

    hello<<<1, 1>>>(output);
    result = cudaGetLastError();
    if (result != cudaSuccess) {
        std::fprintf(stderr, "%s\n", cudaGetErrorString(result));
        cudaFree(output);
        return EXIT_FAILURE;
    }

    float value = 0.0f;
    result = cudaMemcpy(&value, output, sizeof(value), cudaMemcpyDeviceToHost);
    if (result != cudaSuccess) {
        std::fprintf(stderr, "%s\n", cudaGetErrorString(result));
        cudaFree(output);
        return EXIT_FAILURE;
    }
    std::printf("%.1f\n", value);
    cudaFree(output);
}
