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

constexpr bool narrowInputs = true;

__global__ void dot(const float* input, float* output) {
    float total = 0.0f;
    for (int k = 0; k < 16; ++k) {
        float value = input[k];
        if (narrowInputs) value = __half2float(__float2half_rn(value));
        total += value; // The second operand contains only ones.
    }
    output[0] = total;
}

int main() {
    float values[16];
    for (int i = 0; i < 16; ++i) values[i] = i < 8 ? 1.0003f : -1.0f;
    float *input, *output;
    check(cudaMalloc(&input, sizeof(values)));
    check(cudaMalloc(&output, sizeof(float)));
    check(cudaMemcpy(input, values, sizeof(values), cudaMemcpyHostToDevice));
    dot<<<1, 1>>>(input, output);
    check(cudaGetLastError());
    float total;
    check(cudaMemcpy(&total, output, sizeof(total), cudaMemcpyDeviceToHost));
    std::printf("FP32 accumulation: %g\n", static_cast<double>(total));
    check(cudaFree(input));
    check(cudaFree(output));
}
