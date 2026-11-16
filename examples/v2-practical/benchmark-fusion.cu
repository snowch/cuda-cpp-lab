// Copyright © 2026 Christopher Snow.
// Native NVIDIA GPU only. Events do not measure physical time in the browser.
#include <cuda_runtime.h>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <cmath>
void check(cudaError_t status) {
    if (status != cudaSuccess) {
        std::fprintf(stderr, "%s\n", cudaGetErrorString(status));
        std::exit(EXIT_FAILURE);
    }
}
__global__ void twice(const float* x, float* y, int n) {
    for (int i = blockIdx.x * blockDim.x + threadIdx.x; i < n;
         i += blockDim.x * gridDim.x) y[i] = x[i] * 2.0f;
}
__global__ void plusOne(const float* x, float* y, int n) {
    for (int i = blockIdx.x * blockDim.x + threadIdx.x; i < n;
         i += blockDim.x * gridDim.x) y[i] = x[i] + 1.0f;
}
__global__ void fused(const float* x, float* y, int n) {
    for (int i = blockIdx.x * blockDim.x + threadIdx.x; i < n;
         i += blockDim.x * gridDim.x) y[i] = x[i] * 2.0f + 1.0f;
}
int main() {
    constexpr int n = 1048579, warmup = 10, repetitions = 200, samples = 5;
    int device = 0, runtime = 0;
    check(cudaGetDevice(&device));
    check(cudaRuntimeGetVersion(&runtime));
    cudaDeviceProp prop{}; check(cudaGetDeviceProperties(&prop, device));
    const int blocks = prop.multiProcessorCount * 4, threads = 256;
    std::vector<float> input(n), output(n);
    for (int i = 0; i < n; ++i) input[i] = ((i % 257) - 128) * 0.125f;
    float *x = nullptr, *tmp = nullptr, *y = nullptr;
    const size_t bytes = n * sizeof(float);
    check(cudaMalloc(&x, bytes)); check(cudaMalloc(&tmp, bytes));
    check(cudaMalloc(&y, bytes));
    check(cudaMemcpy(x, input.data(), bytes, cudaMemcpyHostToDevice));
    auto launch = [&](int variant) {
        if (variant == 0) {
            twice<<<blocks, threads>>>(x, tmp, n);
            check(cudaGetLastError());
            plusOne<<<blocks, threads>>>(tmp, y, n);
        } else fused<<<blocks, threads>>>(x, y, n);
        check(cudaGetLastError());
    };
    // Validate each entire output independently before any reported timing.
    for (int variant = 0; variant < 2; ++variant) {
        for (float& value : output) value = NAN;
        check(cudaMemcpy(y, output.data(), bytes, cudaMemcpyHostToDevice));
        launch(variant);
        check(cudaMemcpy(output.data(), y, bytes, cudaMemcpyDeviceToHost));
        for (int i = 0; i < n; ++i) {
            const float expected = input[i] * 2.0f + 1.0f;
            if (!std::isfinite(output[i]) ||
                std::fabs(output[i] - expected) > 1e-5f + 1e-4f * std::fabs(expected)) {
                std::fprintf(stderr, "Variant %d failed at index %d\n", variant, i);
                return EXIT_FAILURE;
            }
        }
    }
    for (int i = 0; i < warmup; ++i) { launch(0); launch(1); }
    check(cudaDeviceSynchronize());
    cudaEvent_t begin, end;
    check(cudaEventCreate(&begin)); check(cudaEventCreate(&end));
    float timings[2][samples]{};
    for (int sample = 0; sample < samples; ++sample) {
        for (int order = 0; order < 2; ++order) {
            int variant = (sample + order) % 2;
            check(cudaEventRecord(begin));
            for (int i = 0; i < repetitions; ++i) launch(variant);
            check(cudaEventRecord(end)); check(cudaEventSynchronize(end));
            float elapsed = 0; check(cudaEventElapsedTime(&elapsed, begin, end));
            timings[variant][sample] = elapsed / repetitions;
        }
    }
    std::printf("{\n  \"schema\": 1, \"scope\": \"kernel-only\",\n");
    std::printf("  \"gpu\": \"%s\", \"runtime_version\": %d,\n", prop.name, runtime);
    std::printf("  \"elements\": %d, \"checked_elements\": %d,\n", n, n);
    std::printf("  \"warmup\": %d, \"repetitions\": %d,\n", warmup, repetitions);
    std::printf("  \"blocks\": %d, \"threads\": %d,\n", blocks, threads);
    std::printf("  \"samples_ms\": {\n");
    for (int variant = 0; variant < 2; ++variant) {
        std::printf("    \"%s\": [", variant == 0 ? "separate" : "fused");
        for (int i = 0; i < samples; ++i)
            std::printf("%s%.9g", i ? ", " : "", timings[variant][i]);
        std::printf("]%s\n", variant == 0 ? "," : "");
    }
    std::printf("  }\n}\n");
    check(cudaEventDestroy(begin)); check(cudaEventDestroy(end));
    check(cudaFree(x)); check(cudaFree(tmp)); check(cudaFree(y));
}
