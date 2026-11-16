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

bool closeEnough(float actual, float expected) {
    if ((actual - actual) != 0.0f) return false;
    float error = actual - expected;
    if (error < 0.0f) error = -error;
    float scale = expected < 0.0f ? -expected : expected;
    return error <= 0.00001f + 0.0001f * scale;
}

constexpr int count = 70;
static_assert(count >= 0 && count <= 1024, "Two-level example: 0 to 1024 flags.");

__global__ void localScan(const int* flags, int* offsets, int* totals, int n) {
    __shared__ int values[32];
    int t = threadIdx.x, i = blockIdx.x * 32 + t;
    int flag = i < n ? flags[i] : 0;
    values[t] = flag;
    __syncthreads();
    for (int distance = 1; distance < 32; distance *= 2) {
        int previous = t >= distance ? values[t - distance] : 0;
        __syncthreads();
        values[t] += previous;
        __syncthreads();
    }
    if (i < n) offsets[i] = values[t] - flag;
    if (t == 31) totals[blockIdx.x] = values[t];
}

__global__ void scanTotals(const int* totals, int* starts, int blocks) {
    __shared__ int values[32];
    int t = threadIdx.x, own = t < blocks ? totals[t] : 0;
    values[t] = own;
    __syncthreads();
    for (int distance = 1; distance < 32; distance *= 2) {
        int previous = t >= distance ? values[t - distance] : 0;
        __syncthreads();
        values[t] += previous;
        __syncthreads();
    }
    if (t < blocks) starts[t] = values[t] - own;
}

__global__ void addStarts(int* offsets, const int* starts, int n) {
    int i = blockIdx.x * 32 + threadIdx.x;
    if (i < n) offsets[i] += starts[blockIdx.x];
}

int main() {
    if (count == 0) {
        std::printf("Empty scan: total 0; no allocation or launch.\n");
        return 0;
    }
    constexpr int blocks = (count + 31) / 32;
    int flags[count ? count : 1], actual[count ? count : 1];
    int pending[blocks ? blocks : 1];
    for (int i = 0; i < count; ++i) {
        flags[i] = i % 3 == 0;
        actual[i] = -1;
    }
    for (int b = 0; b < blocks; ++b) pending[b] = -1;
    int *input, *offsets, *totals, *starts;
    check(cudaMalloc(&input, sizeof(flags)));
    check(cudaMalloc(&offsets, sizeof(actual)));
    check(cudaMalloc(&totals, (blocks ? blocks : 1) * sizeof(int)));
    check(cudaMalloc(&starts, (blocks ? blocks : 1) * sizeof(int)));
    check(cudaMemcpy(input, flags, sizeof(flags), cudaMemcpyHostToDevice));
    check(cudaMemcpy(offsets, actual, sizeof(actual), cudaMemcpyHostToDevice));
    check(cudaMemcpy(totals, pending, sizeof(pending), cudaMemcpyHostToDevice));
    check(cudaMemcpy(starts, pending, sizeof(pending), cudaMemcpyHostToDevice));
    localScan<<<blocks, 32>>>(input, offsets, totals, count);
    check(cudaGetLastError());
    scanTotals<<<1, 32>>>(totals, starts, blocks);
    check(cudaGetLastError());
    addStarts<<<blocks, 32>>>(offsets, starts, count);
    check(cudaGetLastError());
    check(cudaMemcpy(actual, offsets, sizeof(actual), cudaMemcpyDeviceToHost));
    int expected = 0, errors = 0;
    for (int i = 0; i < count; ++i) {
        if (actual[i] != expected) ++errors;
        expected += flags[i];
    }
    std::printf("Checked %d exclusive offsets across %d blocks; total %d; mismatches: %d\n",
                count, blocks, actual[count - 1] + flags[count - 1], errors);
    check(cudaFree(input)); check(cudaFree(offsets));
    check(cudaFree(totals)); check(cudaFree(starts));
    return errors ? EXIT_FAILURE : 0;
}
