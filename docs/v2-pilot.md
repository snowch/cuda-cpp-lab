# GPU Lab V2 pilot

The CUDA-first pilot lives under `/gpu-lab/v2/`. Its first three lessons use the
same `hello.cu` program to introduce a per-thread calculation, a bounds check,
and the CPU–GPU data path. Each lesson exposes one source change next to the
output to inspect. The controls generate the complete downloadable program from
the same parameters used by the browser teaching model.

The remaining 17 lessons are marked **Planned**. Each has a learning goal, a
stable route, Previous/Next links and a related lesson in the current course.
The branch adds the V2 routes to the static build and offline release manifest.
The current course keeps its existing entry point and lesson routes.

## Try the pilot

```sh
npm run dev
```

Open `http://localhost:5173/gpu-lab/v2/` and start with **One thread, one element**.
The browser executes the teaching model. Use the desktop CUDA setup to compile
the downloaded C++ source. The coalescing lesson is still a stub in this pilot.

To open the same pilot from a single file on a tablet, generate its offline
preview and open it in Chrome.

```sh
node scripts/build-v2-preview.mjs GPU-Lab-V2-preview.html
```

The preview contains all 20 pilot routes and their controls. Links back to the
current course point to the published site.

## Review checks

- Read the pilot in order from the input and source to the edit, run result,
  transfer question and next lesson. Each new concept appears next to the code
  that needs it. The opening uses CUDA with basic programming knowledge as its
  prerequisite.
- Inspect the served pages at phone, tablet and desktop widths in light and dark
  themes. Verify the edited source, output, keyboard step controls and download.
- Verify all 20 routes, the planned-page labels and current-course fallback,
  result invalidation on edits, restoration on reload, and the offline tablet
  preview in Chromium.
- Run the existing course unit and browser checks separately from the pilot
  preview. The browser model labels its output as a model and provides no GPU
  timing results.

All eight supported `hello.cu` variants compiled to objects with NVIDIA CUDA
13.2.51, targeting `sm_80`. Physical GPU execution
is outside this pilot's verification.

## Editable CUDA source workbench

Lesson 1 links to the editable workbench. Clang running in WebAssembly compiles
the exact editor text to CUDA LLVM IR. A lesson-specific backend lowers the
supported instructions to PTX and GPGPU-Sim runs the result in WebAssembly. The
lesson supplies the input and launch. Learners can vary the FP32 expression or
bounds check, see compiler diagnostics, and inspect emitted PTX.

The hosted workbench downloads about 127 MiB of pinned compiler assets on the
first run. The separate standalone workbench bundles those assets for offline
use. The source and build instructions live in the
[cuda-sim-wasm workbench](https://github.com/snowch/cuda-sim-wasm/tree/experiment/editable-cuda/workbench).

Browser checks covered starter and edited outputs, a malformed edit, an
unsupported operation, and restoring the starter. The link from lesson 1 and
return link were tested against the built V2 routes. Offline runs were tested
at phone and tablet widths in Chromium.
