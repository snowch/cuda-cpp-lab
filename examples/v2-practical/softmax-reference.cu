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

#include <cmath>
constexpr int rows = 3;
constexpr int columns = 33;
constexpr float shift = 1000.0f;
static_assert(rows > 0 && rows <= 128 && columns > 0 && rows * columns <= 8192,
    "Browser exercise: 1-128 rows, positive columns, at most 8192 elements.");

// BEGIN SOFTMAX KERNEL
__global__ void rowSoftmax(const float* input, float* output, int cols) {
    __shared__ float scratch[32];
    int t = threadIdx.x, row = blockIdx.x;
    float maximum = -3.402823466e38f;
    for (int col = t; col < cols; col += 32) {
        float value = input[row * cols + col];
        if (value > maximum) maximum = value;
    }
    scratch[t] = maximum;
    __syncthreads();
    for (int distance = 16; distance > 0; distance /= 2) {
        if (t < distance && scratch[t + distance] > scratch[t])
            scratch[t] = scratch[t + distance];
        __syncthreads();
    }
    maximum = scratch[0];
    __syncthreads(); // Finish maximum reads before reusing scratch.
    float total = 0.0f;
    for (int col = t; col < cols; col += 32)
        total += expf(input[row * cols + col] - maximum);
    scratch[t] = total;
    __syncthreads();
    for (int distance = 16; distance > 0; distance /= 2) {
        if (t < distance) scratch[t] += scratch[t + distance];
        __syncthreads();
    }
    float denominator = scratch[0];
    for (int col = t; col < cols; col += 32)
        output[row * cols + col] = expf(input[row * cols + col] - maximum) / denominator;
}
// END SOFTMAX KERNEL

int main() {
    constexpr int count = rows * columns;
    float input[count], actual[count], expected[count];
    volatile float zero = 0.0f;
    for (int i = 0; i < count; ++i) {
        input[i] = shift + static_cast<float>((i * 7 + i / columns) % 17 - 8) * 0.25f;
        actual[i] = zero / zero;
    }
    // Independent serial CPU reference; all inputs are finite FP32 values.
    for (int row = 0; row < rows; ++row) {
        float maximum = input[row * columns], total = 0.0f;
        for (int col = 1; col < columns; ++col)
            if (input[row * columns + col] > maximum) maximum = input[row * columns + col];
        for (int col = 0; col < columns; ++col) {
            expected[row * columns + col] = expf(input[row * columns + col] - maximum);
            total += expected[row * columns + col];
        }
        for (int col = 0; col < columns; ++col) expected[row * columns + col] /= total;
    }
    float *x, *y;
    check(cudaMalloc(&x, sizeof(input))); check(cudaMalloc(&y, sizeof(actual)));
    check(cudaMemcpy(x, input, sizeof(input), cudaMemcpyHostToDevice));
    check(cudaMemcpy(y, actual, sizeof(actual), cudaMemcpyHostToDevice));
    rowSoftmax<<<rows, 32>>>(x, y, columns);
    check(cudaGetLastError());
    check(cudaMemcpy(actual, y, sizeof(actual), cudaMemcpyDeviceToHost));
    int errors = 0;
    for (int i = 0; i < count; ++i) {
        if (!closeEnough(actual[i], expected[i])) {
            if (!errors) std::printf("Mismatch at index %d: actual %g, reference %g\n", i, actual[i], expected[i]);
            ++errors;
        }
    }
    for (int row = 0; row < rows; ++row) {
        float sum = 0.0f;
        for (int col = 0; col < columns; ++col) sum += actual[row * columns + col];
        if (!closeEnough(sum, 1.0f)) ++errors;
    }
    std::printf("Checked %d softmax values and %d row sums; mismatches: %d\n", count, rows, errors);
    std::printf("Row 0: ");
    for (int col = 0; col < columns; ++col) std::printf("%s%g", col ? ", " : "", actual[col]);
    std::printf("\n");
    check(cudaFree(x)); check(cudaFree(y));
    return errors ? EXIT_FAILURE : 0;
}
