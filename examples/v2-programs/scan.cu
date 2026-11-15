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

constexpr bool inclusive = true;

__global__ void scan(const int* flags, int* result) {
    int t = threadIdx.x;
    __shared__ int values[8];
    values[t] = flags[t];
    for (int step = 1; step < 8; step *= 2) {
        __syncthreads();
        int previous = t >= step ? values[t - step] : 0;
        __syncthreads();
        values[t] += previous;
    }
    result[t] = inclusive ? values[t] : values[t] - flags[t];
}

int main() {
    int values[] = {1, 0, 1, 0, 0, 1, 0, 1};
    int *input, *output;
    check(cudaMalloc(&input, sizeof(values)));
    check(cudaMalloc(&output, sizeof(values)));
    check(cudaMemcpy(input, values, sizeof(values), cudaMemcpyHostToDevice));
    scan<<<1, 8>>>(input, output);
    check(cudaGetLastError());
    check(cudaMemcpy(values, output, sizeof(values), cudaMemcpyDeviceToHost));
    std::printf("Index 5: %d; index 7: %d\n", values[5], values[7]);
    check(cudaFree(input));
    check(cudaFree(output));
}
