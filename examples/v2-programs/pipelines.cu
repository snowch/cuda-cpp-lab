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

constexpr bool overlap = true;
constexpr int chunks = 4;
constexpr int width = 4;

__global__ void process(float* slot) {
    slot[threadIdx.x] *= 2.0f;
}

int main() {
    float *input, *output;
    check(cudaMallocHost(&input, chunks * width * sizeof(float)));
    check(cudaMallocHost(&output, chunks * width * sizeof(float)));
    for (int i = 0; i < chunks * width; ++i) input[i] = i + 1;
    float* slot[2];
    cudaStream_t copy, compute;
    cudaEvent_t ready[2], used[2];
    check(cudaStreamCreate(&copy));
    check(cudaStreamCreate(&compute));
    for (int s = 0; s < 2; ++s) {
        check(cudaMalloc(&slot[s], width * sizeof(float)));
        check(cudaEventCreate(&ready[s]));
        check(cudaEventCreate(&used[s]));
    }

    int chunkSynchronizations = 0;
    for (int chunk = 0; chunk < chunks; ++chunk) {
        int s = chunk % 2;
        if (chunk >= 2) check(cudaStreamWaitEvent(copy, used[s], 0));
        check(cudaMemcpyAsync(slot[s], input + chunk * width, width * sizeof(float),
                              cudaMemcpyHostToDevice, copy));
        check(cudaEventRecord(ready[s], copy));
        check(cudaStreamWaitEvent(compute, ready[s], 0));
        process<<<1, width, 0, compute>>>(slot[s]);
        check(cudaGetLastError());
        check(cudaMemcpyAsync(output + chunk * width, slot[s], width * sizeof(float),
                              cudaMemcpyDeviceToHost, compute));
        check(cudaEventRecord(used[s], compute));
        if (!overlap) {
            check(cudaStreamSynchronize(compute));
            ++chunkSynchronizations;
        }
    }
    check(cudaStreamSynchronize(compute));
    std::printf("First output: %.1f; last output: %.1f; chunk synchronizations: %d\n",
                static_cast<double>(output[0]), static_cast<double>(output[chunks * width - 1]),
                chunkSynchronizations);
    for (int s = 0; s < 2; ++s) {
        check(cudaEventDestroy(ready[s]));
        check(cudaEventDestroy(used[s]));
        check(cudaFree(slot[s]));
    }
    check(cudaStreamDestroy(copy));
    check(cudaStreamDestroy(compute));
    check(cudaFreeHost(input));
    check(cudaFreeHost(output));
}
