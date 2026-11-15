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
static_assert(tile == 1 || tile == 2 || tile == 4, "Choose a tile width of 1, 2 or 4.");

__global__ void multiply(const float* a, const float* b, float* c) {
    __shared__ float left[tile][tile], right[tile][tile];
    int x = threadIdx.x, y = threadIdx.y;
    int row = blockIdx.y * tile + y;
    int col = blockIdx.x * tile + x;
    float sum = 0.0f;
    for (int begin = 0; begin < width; begin += tile) {
        left[y][x] = a[row * width + begin + x];
        right[y][x] = b[(begin + y) * width + col];
        __syncthreads();
        for (int k = 0; k < tile; ++k) sum += left[y][k] * right[k][x];
        __syncthreads();
    }
    c[row * width + col] = sum;
}

int main() {
    float values[width * width];
    for (int i = 0; i < width * width; ++i) values[i] = 1.0f;
    float *input, *output;
    check(cudaMalloc(&input, sizeof(values)));
    check(cudaMalloc(&output, sizeof(values)));
    check(cudaMemcpy(input, values, sizeof(values), cudaMemcpyHostToDevice));
    dim3 blocks(width / tile, width / tile), threads(tile, tile);
    multiply<<<blocks, threads>>>(input, input, output);
    check(cudaGetLastError());
    check(cudaMemcpy(values, output, sizeof(values), cudaMemcpyDeviceToHost));
    constexpr int loads = 2 * width * width * width / tile;
    std::printf("C[0,0]: %.1f; input loads in this tiled algorithm: %d; shared bytes per block: %d\n",
                static_cast<double>(values[0]), loads, 2 * tile * tile * 4);
    check(cudaFree(input));
    check(cudaFree(output));
}
