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
constexpr int blocks = 2;
static_assert(count >= 0 && count <= 4096, "Browser exercise: choose 0 to 4096 inputs.");

__global__ void scale(const float* input, float* output, int n) {
    int first = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = blockDim.x * gridDim.x;
    for (int i = first; i < n; i += stride) {
        output[i] = input[i] * 2.5f;
    }
}

int main() {
    if (count == 0) {
        std::printf("Empty input: no allocation or launch.\n");
        return 0;
    }
    float input[count ? count : 1], actual[count ? count : 1];
    volatile float zero = 0.0f;
    for (int i = 0; i < count; ++i) {
        input[i] = static_cast<float>(i % 13 - 6) * 0.25f;
        actual[i] = zero / zero;
    }
    float *x, *y;
    check(cudaMalloc(&x, sizeof(input))); check(cudaMalloc(&y, sizeof(actual)));
    check(cudaMemcpy(x, input, sizeof(input), cudaMemcpyHostToDevice));
    check(cudaMemcpy(y, actual, sizeof(actual), cudaMemcpyHostToDevice));
    scale<<<blocks, 32>>>(x, y, count);
    check(cudaGetLastError());
    check(cudaMemcpy(actual, y, sizeof(actual), cudaMemcpyDeviceToHost));
    int errors = 0;
    for (int i = 0; i < count; ++i)
        if (!closeEnough(actual[i], input[i] * 2.5f)) ++errors;
    check(cudaFree(x)); check(cudaFree(y));
    std::printf("Checked %d values using %d launched threads; mismatches: %d\n",
                count, blocks * 32, errors);
    return errors ? EXIT_FAILURE : 0;
}
