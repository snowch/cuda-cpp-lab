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

constexpr int cached = 4;
constexpr int capacity = 17;
constexpr int width = 4;
static_assert(cached >= 0 && cached < capacity);

__global__ void append(float* keys, float* values, float* readback) {
    int lane = threadIdx.x;
    float previous = 0.0f;
    for (int token = 0; token < cached; ++token) {
        int index = token * width + lane;
        previous += keys[index] + values[index];
    }
    int index = cached * width + lane;
    keys[index] = 1.0f;
    values[index] = 2.0f;
    readback[lane] = previous;
}

int main() {
    float cache[capacity * width];
    for (float& value : cache) value = 1.0f;
    float *keys, *values, *readback;
    check(cudaMalloc(&keys, sizeof(cache)));
    check(cudaMalloc(&values, sizeof(cache)));
    check(cudaMalloc(&readback, width * sizeof(float)));
    check(cudaMemcpy(keys, cache, sizeof(cache), cudaMemcpyHostToDevice));
    check(cudaMemcpy(values, cache, sizeof(cache), cudaMemcpyHostToDevice));
    append<<<1, width>>>(keys, values, readback);
    check(cudaGetLastError());
    float observed[width];
    check(cudaMemcpy(observed, readback, sizeof(observed), cudaMemcpyDeviceToHost));
    const int bytesPerToken = 2 * width * sizeof(float);
    std::printf("Old cache read: %d bytes; append: %d bytes; lane 0 sum: %.1f\n",
                cached * bytesPerToken, bytesPerToken, static_cast<double>(observed[0]));
    check(cudaFree(keys));
    check(cudaFree(values));
    check(cudaFree(readback));
}
