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

#include <cmath>

constexpr int keys = 8;
constexpr int keysPerTile = 2;
constexpr float query = 1.0f;
static_assert(keysPerTile == 2 || keysPerTile == 4 || keysPerTile == 8);

__global__ void onlineAttention(const float* key, const float* value, float* output) {
    float maximum = key[0] * query;
    float denominator = 0.0f, weighted = 0.0f;
    for (int begin = 0; begin < keys; begin += keysPerTile) {
        float next = maximum;
        for (int i = begin; i < begin + keysPerTile; ++i) {
            float score = query * key[i];
            if (score > next) next = score;
        }
        float keep = expf(maximum - next);
        denominator *= keep;
        weighted *= keep;
        for (int i = begin; i < begin + keysPerTile; ++i) {
            float weight = expf(query * key[i] - next);
            denominator += weight;
            weighted += weight * value[i];
        }
        maximum = next;
    }
    output[0] = weighted / denominator;
}

int main() {
    const float key[] = {-2,-1,0,1,2,3,4,5};
    const float value[] = {1,2,3,4,5,6,7,8};
    float *deviceKey, *deviceValue, *output;
    check(cudaMalloc(&deviceKey, sizeof(key)));
    check(cudaMalloc(&deviceValue, sizeof(value)));
    check(cudaMalloc(&output, sizeof(float)));
    check(cudaMemcpy(deviceKey, key, sizeof(key), cudaMemcpyHostToDevice));
    check(cudaMemcpy(deviceValue, value, sizeof(value), cudaMemcpyHostToDevice));
    onlineAttention<<<1, 1>>>(deviceKey, deviceValue, output);
    check(cudaGetLastError());
    float result;
    check(cudaMemcpy(&result, output, sizeof(result), cudaMemcpyDeviceToHost));
    std::printf("Tiles: %d; weighted value: %.3f\n", keys / keysPerTile, static_cast<double>(result));
    check(cudaFree(deviceKey));
    check(cudaFree(deviceValue));
    check(cudaFree(output));
}
