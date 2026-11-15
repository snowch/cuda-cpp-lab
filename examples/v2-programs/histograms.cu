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

constexpr bool blockCounts = true;

__global__ void histogram(const int* categories, int* counts) {
    int t = threadIdx.x;
    int category = categories[blockIdx.x * blockDim.x + t];
    if (blockCounts) {
        __shared__ int partial[4];
        partial[t] = 0;
        __syncthreads();
        atomicAdd(&partial[category], 1);
        __syncthreads();
        if (partial[t]) atomicAdd(&counts[t], partial[t]);
    } else {
        atomicAdd(&counts[category], 1);
    }
}

int main() {
    int categories[] = {0, 1, 0, 2, 1, 0, 3, 0};
    int counts[4] = {};
    int *input, *output;
    check(cudaMalloc(&input, sizeof(categories)));
    check(cudaMalloc(&output, sizeof(counts)));
    check(cudaMemcpy(input, categories, sizeof(categories), cudaMemcpyHostToDevice));
    check(cudaMemcpy(output, counts, sizeof(counts), cudaMemcpyHostToDevice));
    histogram<<<2, 4>>>(input, output);
    check(cudaGetLastError());
    check(cudaMemcpy(counts, output, sizeof(counts), cudaMemcpyDeviceToHost));
    std::printf("Counts: [%d, %d, %d, %d]\n", counts[0], counts[1], counts[2], counts[3]);
    check(cudaFree(input));
    check(cudaFree(output));
}
