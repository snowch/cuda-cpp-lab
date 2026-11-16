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

constexpr int width = 8;
constexpr int tile = 2;
static_assert(width > 0 && width <= 32, "Choose width 1–32 for this teaching example.");
static_assert(tile == 1 || tile == 2 || tile == 4, "Choose a tile width of 1, 2 or 4.");

__global__ void multiply(const float* a, const float* b, float* c) {
    __shared__ float left[tile][tile], right[tile][tile];
    int x = threadIdx.x, y = threadIdx.y;
    int row = blockIdx.y * tile + y;
    int col = blockIdx.x * tile + x;
    float sum = 0.0f;
    for (int begin = 0; begin < width; begin += tile) {
        left[y][x] = row < width && begin + x < width
            ? a[row * width + begin + x] : 0.0f;
        right[y][x] = begin + y < width && col < width
            ? b[(begin + y) * width + col] : 0.0f;
        __syncthreads();
        for (int k = 0; k < tile; ++k) sum += left[y][k] * right[k][x];
        __syncthreads();
    }
    if (row < width && col < width)
    c[row * width + col] = sum;
}

int main() {
    float a[width * width], b[width * width], values[width * width];
    volatile float zero = 0.0f;
    for (int i = 0; i < width * width; ++i) {
        a[i] = ((i * 3 + i / width) % 11 - 5) * 0.25f;
        b[i] = ((i * 7 + i / width) % 13 - 6) * 0.25f;
        values[i] = zero / zero;
    }
    float *left, *right, *output;
    check(cudaMalloc(&left, sizeof(a)));
    check(cudaMalloc(&right, sizeof(b)));
    check(cudaMalloc(&output, sizeof(values)));
    check(cudaMemcpy(left, a, sizeof(a), cudaMemcpyHostToDevice));
    check(cudaMemcpy(right, b, sizeof(b), cudaMemcpyHostToDevice));
    check(cudaMemcpy(output, values, sizeof(values), cudaMemcpyHostToDevice));
    dim3 blocks((width + tile - 1) / tile, (width + tile - 1) / tile), threads(tile, tile);
    multiply<<<blocks, threads>>>(left, right, output);
    check(cudaGetLastError());
    check(cudaMemcpy(values, output, sizeof(values), cudaMemcpyDeviceToHost));
    int mismatches = 0;
    for (int row = 0; row < width; ++row) for (int col = 0; col < width; ++col) {
        float expected = 0.0f;
        for (int k = 0; k < width; ++k)
            expected += a[row * width + k] * b[k * width + col];
        float actual = values[row * width + col], difference = actual - expected;
        if (difference < 0) difference = -difference;
        float magnitude = expected < 0 ? -expected : expected;
        if ((actual - actual) != 0.0f || difference > 1e-5f + 1e-4f * magnitude)
            ++mismatches;
    }
    // Valid global operand loads: padding positions read zero without a load.
    constexpr int loads = 2 * width * width * ((width + tile - 1) / tile);
    std::printf("Checked %d matrix values; mismatches: %d\n", width * width, mismatches);
    std::printf("C[0,0]: %.4f; input loads in this tiled algorithm: %d; shared bytes per block: %d\n",
                static_cast<double>(values[0]), loads, 2 * tile * tile * 4);
    check(cudaFree(left)); check(cudaFree(right)); check(cudaFree(output));
    return mismatches ? EXIT_FAILURE : 0;
}
