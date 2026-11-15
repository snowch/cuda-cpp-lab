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

#include <cuda_fp16.h>
#include <mma.h>

__global__ void tile(const __half* a, const __half* b, float* c) {
    constexpr float startingValue = 0.0f;
    namespace w = nvcuda::wmma;
    w::fragment<w::matrix_a, 16, 16, 16, __half, w::row_major> left;
    w::fragment<w::matrix_b, 16, 16, 16, __half, w::row_major> right;
    w::fragment<w::accumulator, 16, 16, 16, float> sum;
    w::fill_fragment(sum, startingValue);
    w::load_matrix_sync(left, a, 16);
    w::load_matrix_sync(right, b, 16);
    w::mma_sync(sum, left, right, sum);
    w::store_matrix_sync(c, sum, 16, w::mem_row_major);
}

int main() {
    __half input[256];
    for (auto& value : input) value = __float2half_rn(1.0f);
    __half* deviceInput;
    float* output;
    check(cudaMalloc(&deviceInput, sizeof(input)));
    check(cudaMalloc(&output, 256 * sizeof(float)));
    check(cudaMemcpy(deviceInput, input, sizeof(input), cudaMemcpyHostToDevice));
    tile<<<1, 32>>>(deviceInput, deviceInput, output);
    check(cudaGetLastError());
    float result;
    check(cudaMemcpy(&result, output, sizeof(result), cudaMemcpyDeviceToHost));
    std::printf("C[0,0]: %.1f\n", static_cast<double>(result));
    check(cudaFree(deviceInput));
    check(cudaFree(output));
}
