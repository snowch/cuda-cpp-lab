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

constexpr int stride = 32;
static_assert(stride >= 0 && stride <= 33, "Choose a stride from 0 to 33.");

__global__ void readWords(int* output) {
    __shared__ int words[1024];
    int lane = threadIdx.x;
    for (int i = lane; i < 1024; i += 32) words[i] = i;
    __syncthreads();
    output[lane] = words[lane * stride];
}

int main() {
    int words[32];
    int* output;
    check(cudaMalloc(&output, sizeof(words)));
    readWords<<<1, 32>>>(output);
    check(cudaGetLastError());
    check(cudaMemcpy(words, output, sizeof(words), cudaMemcpyDeviceToHost));

    // Each returned value identifies the word that its lane read.
    bool seen[1024] = {};
    int requests[32] = {};
    int rounds = 0;
    for (int word : words) {
        if (word < 0 || word >= 1024) return 1;
        if (!seen[word]) {
            seen[word] = true;
            int current = ++requests[word % 32];
            if (current > rounds) rounds = current;
        }
    }
    std::printf("Modelled service rounds: %d\n", rounds);
    check(cudaFree(output));
}
