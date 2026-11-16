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

constexpr int keepCategory = 0;

__global__ void flag(const int* categories, int* flags) {
    int t = threadIdx.x;
    flags[t] = categories[t] == keepCategory;
}

__global__ void scanFlags(const int* flags, int* offsets) {
    __shared__ int values[8];
    int t = threadIdx.x;
    values[t] = flags[t];
    __syncthreads();
    for (int step = 1; step < 8; step *= 2) {
        int previous = t >= step ? values[t - step] : 0;
        __syncthreads();
        values[t] += previous;
        __syncthreads();
    }
    offsets[t] = values[t] - flags[t];
}

__global__ void scatter(const int* flags, const int* offsets, int* output) {
    int t = threadIdx.x;
    if (flags[t]) output[offsets[t]] = t;
}

int main() {
    int categories[] = {0, 1, 0, 2, 1, 0, 3, 0};
    int selected[] = {-1,-1,-1,-1,-1,-1,-1,-1};
    int *input, *flags, *offsets, *output;
    check(cudaMalloc(&input, sizeof(categories)));
    check(cudaMalloc(&flags, sizeof(categories)));
    check(cudaMalloc(&offsets, sizeof(categories)));
    check(cudaMalloc(&output, sizeof(selected)));
    check(cudaMemcpy(input, categories, sizeof(categories), cudaMemcpyHostToDevice));
    check(cudaMemcpy(output, selected, sizeof(selected), cudaMemcpyHostToDevice));
    flag<<<1, 8>>>(input, flags);
    check(cudaGetLastError());
    scanFlags<<<1, 8>>>(flags, offsets);
    check(cudaGetLastError());
    scatter<<<1, 8>>>(flags, offsets, output);
    check(cudaGetLastError());
    check(cudaMemcpy(selected, output, sizeof(selected), cudaMemcpyDeviceToHost));
    int expected[8] = {-1,-1,-1,-1,-1,-1,-1,-1}, used = 0;
    for (int t = 0; t < 8; ++t) if (categories[t] == keepCategory) expected[used++] = t;
    for (int t = 0; t < 8; ++t) if (selected[t] != expected[t]) return EXIT_FAILURE;
    for (int token : selected) if (token >= 0) std::printf("Kept token: %d\n", token);
    check(cudaFree(input));
    check(cudaFree(flags));
    check(cudaFree(offsets));
    check(cudaFree(output));
}
