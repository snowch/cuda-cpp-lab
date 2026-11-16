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

constexpr int count = 33;
constexpr bool correctIndex = true;

__global__ void transform(const float* input, float* output, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        int source = correctIndex ? i : (i + 1) % n;
        output[i] = input[source] * 2.5f;
    }
}

int main() {
    float input[count], actual[count], expected[count];
    volatile float zero = 0.0f;
    for (int i = 0; i < count; ++i) {
        input[i] = static_cast<float>(i % 13 - 6) * 0.25f;
        expected[i] = input[i] * 2.5f;
        actual[i] = zero / zero; // Poison unwritten outputs with NaN.
    }
    float *x, *y;
    check(cudaMalloc(&x, sizeof(input)));
    check(cudaMalloc(&y, sizeof(actual)));
    check(cudaMemcpy(x, input, sizeof(input), cudaMemcpyHostToDevice));
    check(cudaMemcpy(y, actual, sizeof(actual), cudaMemcpyHostToDevice));
    transform<<<(count + 31) / 32, 32>>>(x, y, count);
    check(cudaGetLastError());
    check(cudaMemcpy(actual, y, sizeof(actual), cudaMemcpyDeviceToHost));
    int errors = 0;
    for (int i = 0; i < count; ++i) {
        if (!closeEnough(actual[i], expected[i])) {
            if (!errors) std::printf("Mismatch at index %d: actual %g, reference %g\n",
                                    i, actual[i], expected[i]);
            ++errors;
        }
    }
    check(cudaFree(x)); check(cudaFree(y));
    std::printf("Checked %d values; mismatches: %d\n", count, errors);
    return errors ? EXIT_FAILURE : 0;
}
