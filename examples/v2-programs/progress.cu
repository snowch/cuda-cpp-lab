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

constexpr int readers = 2;

__global__ void exchange(int* output) {
    int t = threadIdx.x;
    __shared__ int shared[4];
    shared[t] = t + 1;
    __syncthreads(); // Keep this launch-wide: all four lanes arrive.
    if (t < readers) output[t] = shared[(t + 1) % 4];
}

int main() {
    int values[4] = {};
    int* output;
    check(cudaMalloc(&output, sizeof(values)));
    check(cudaMemcpy(output, values, sizeof(values), cudaMemcpyHostToDevice));
    exchange<<<1, 4>>>(output);
    check(cudaGetLastError());
    check(cudaMemcpy(values, output, sizeof(values), cudaMemcpyDeviceToHost));
    std::printf("Read outputs: %d %d %d %d\n", values[0], values[1], values[2], values[3]);
    check(cudaFree(output));
}
