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

constexpr bool hot = false;

__global__ void count(const int* categories, int* histogram) {
    atomicAdd(&histogram[categories[threadIdx.x]], 1);
}

__global__ void route(const int* categories, const int* histogram, int* positions) {
    int t = threadIdx.x;
    __shared__ int prefix[4][8];
    int category = categories[t], start = 0;
    for (int c = 0; c < 4; ++c) prefix[c][t] = category == c;
    __syncthreads();
    for (int step = 1; step < 8; step *= 2) {
        int previous[4];
        for (int c = 0; c < 4; ++c)
            previous[c] = t >= step ? prefix[c][t - step] : 0;
        __syncthreads();
        for (int c = 0; c < 4; ++c) prefix[c][t] += previous[c];
        __syncthreads();
    }
    int rank = prefix[category][t] - 1;
    for (int i = 0; i < category; ++i) start += histogram[i];

    positions[start + rank] = t;
}

int main() {
    int values[] = {0, 1, 0, 2, 1, 0, 3, 0};
    if (hot) for (int& value : values) value = 0;
    int counts[4] = {};
    int *input, *histogram, *positions;
    check(cudaMalloc(&input, sizeof(values)));
    check(cudaMalloc(&histogram, sizeof(counts)));
    check(cudaMalloc(&positions, sizeof(values)));
    check(cudaMemcpy(input, values, sizeof(values), cudaMemcpyHostToDevice));
    check(cudaMemcpy(histogram, counts, sizeof(counts), cudaMemcpyHostToDevice));
    count<<<1, 8>>>(input, histogram);
    check(cudaGetLastError());
    route<<<1, 8>>>(input, histogram, positions);
    check(cudaGetLastError());
    int expected[8], next = 0;
    for (int c = 0; c < 4; ++c) for (int t = 0; t < 8; ++t)
        if (values[t] == c) expected[next++] = t;
    check(cudaMemcpy(values, positions, sizeof(values), cudaMemcpyDeviceToHost));
    for (int i = 0; i < 8; ++i) if (values[i] != expected[i]) return EXIT_FAILURE;
    for (int i = 0; i < 8; ++i) std::printf("Slot %d: token %d\n", i, values[i]);
    check(cudaFree(input));
    check(cudaFree(histogram));
    check(cudaFree(positions));
}
