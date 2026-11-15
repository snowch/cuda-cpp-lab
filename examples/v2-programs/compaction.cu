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

__global__ void scatter(const int* flags, int* output) {
    int t = threadIdx.x;
    if (!flags[t]) return;
    int offset = 0;
    for (int i = 0; i < t; ++i) offset += flags[i];
    output[offset] = t;
}

int main() {
    int categories[] = {0, 1, 0, 2, 1, 0, 3, 0};
    int selected[] = {-1,-1,-1,-1,-1,-1,-1,-1};
    int *input, *flags, *output;
    check(cudaMalloc(&input, sizeof(categories)));
    check(cudaMalloc(&flags, sizeof(categories)));
    check(cudaMalloc(&output, sizeof(selected)));
    check(cudaMemcpy(input, categories, sizeof(categories), cudaMemcpyHostToDevice));
    check(cudaMemcpy(output, selected, sizeof(selected), cudaMemcpyHostToDevice));
    flag<<<1, 8>>>(input, flags);
    check(cudaGetLastError());
    scatter<<<1, 8>>>(flags, output);
    check(cudaGetLastError());
    check(cudaMemcpy(selected, output, sizeof(selected), cudaMemcpyDeviceToHost));
    for (int token : selected) if (token >= 0) std::printf("Kept token: %d\n", token);
    check(cudaFree(input));
    check(cudaFree(flags));
    check(cudaFree(output));
}
