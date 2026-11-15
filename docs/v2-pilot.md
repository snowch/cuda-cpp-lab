# GPU Lab V2

The CUDA-first course opens at `/gpu-lab/`. Lesson URLs stay under `/gpu-lab/v2/`.
V2's 20 lessons progress from
per-thread arithmetic and CPU–GPU copies to warp execution, matrix operations,
attention, inference and stable token routing. The V1 course overview is at
`/gpu-lab/v1.html`. Each V2 lesson links to the related V1 lesson.

## Run the course

```sh
npm run dev
```

Open `http://localhost:5173/gpu-lab/` and start with **One thread, one element**.
Lesson 1 begins with one thread writing one value. The first three lessons
then share a complete downloadable CUDA program that processes an array. The
later lessons use focused CUDA excerpts or algorithm outlines. Their controls
change the displayed source and run a deterministic teaching trace. Enter a
prediction before running, step through the result and explain a new case.
The concept diagrams use original layouts and data from the lessons.
Traces are teaching models of addresses, dependencies, arithmetic or operation
counts. The workbench below compiles a supported subset of CUDA device code.

To use the course and compiler offline on a tablet, generate an HTML file with
the standalone workbench and open it in Chromium.

```sh
node scripts/build-v2-preview.mjs GPU-Lab-V2.html GPU-Lab-CUDA-workbench.html
```

The file includes all lessons, their controls, styles, fonts and the offline
compiler. Omit the second argument to build a smaller preview of the teaching
models. Links to the V1 course require a connection.

## Edit and run CUDA in WebAssembly

Lessons 1 and 2 include an editor and console in the page. Each lesson saves
its own draft. Use Ctrl or Command + Enter to run, Restore starter to undo
edits, and Export .cu to save the current source. Clang in WebAssembly compiles
the exact editor text to CUDA LLVM IR. A lesson-specific backend lowers the
supported instructions to PTX and GPGPU-Sim runs them in WebAssembly. The
first kernel runs as one block with one thread and one output value. The array
workbench uses two blocks of four threads with five inputs.
Learners can vary arithmetic, local and global indexing, and the bounds check.
Compiler diagnostics and generated PTX are visible in the browser.

The hosted workbench downloads about 127 MiB of pinned compiler assets on
first run. The standalone workbench bundles these assets. Source and build
instructions are in the
[cuda-sim-wasm workbench](https://github.com/snowch/cuda-sim-wasm/tree/experiment/editable-cuda/workbench).

## Review and validation

- Read from the declared inputs and CUDA source through the prediction,
  observed trace, transfer question and next lesson. Initial run results are
  hidden, and selecting new settings clears the earlier prediction and trace.
  Related V1 lessons provide the longer explanations and reference programs.
- `npm run check` covers all routes and calculates an expected prediction for
  every supported guided case. `python tests/browser.py` exercises navigation,
  result invalidation, persistence, keyboard input, no-script reading and
  phone, tablet and desktop layouts in both themes.
- The supplied hello.cu variants previously compiled with NVIDIA CUDA
  13.2.51 targeting sm_80. The Lenovo offline run verified the starter.
  The indexing and bounds edits were checked with the pinned WebAssembly
  compiler and functional simulator. Forty wrapped CUDA excerpt variants
  compiled with the same NVIDIA toolkit and target. The attention outline is
  pseudocode. Performance examples use synthetic models.
- Numerical model assumptions are documented in [model.md](model.md). CUDA
  mechanism references are in [sources.md](sources.md).
