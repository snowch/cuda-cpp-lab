# GPU Lab V2

The CUDA-first course opens at `/gpu-lab/`. Lesson URLs stay under `/gpu-lab/v2/`.
V2's 21 lessons progress from
per-thread arithmetic and CPU–GPU copies to warp execution, matrix operations,
attention, inference and stable token routing. The V1 course overview is at
`/gpu-lab/v1.html`. Each V2 lesson links to the related V1 lesson.

## Run the course

```sh
npm run dev
```

Open `http://localhost:5173/gpu-lab/` and start with **Write your first GPU value**.
Lesson 1 runs one thread that writes one value. Lessons 2–4 share a complete
CUDA program that processes an array. Every subsequent lesson opens with an
editable CUDA program that exercises its concept. The architecture models
below the editors let readers predict, step through and inspect selected
cases. They use original diagrams and data. Their address groupings,
dependencies and timing explanations are teaching models.

In Lesson 1, the kernel definition and launch appear beside their explanations.
The full program follows in the editor. The optional recording after the editor
uses that lesson’s source and follows the launch, store and readback. Build later
recordings around the relevant lesson’s example and concept. Place references at
the end so learners can look up the constructs they just used.

For the hosted course, open **App status** and choose **Download for offline use**
or **Update**. Both save the complete course, including the CUDA compiler. After
an update, choose **Restart to update**; no separate offline download is needed.
The displayed package size includes the compiler assets. A restart preserves
editor drafts, console results, diagnostics and generated PTX. A compile/run in
progress blocks the restart until it finishes.

For a separate file that opens without hosting on a tablet, generate an HTML file
with the standalone workbench and open it in Chromium.

```sh
node scripts/build-v2-preview.mjs GPU-Lab-V2.html GPU-Lab-CUDA-workbench.html
```

The file includes all lessons, their controls, styles, fonts and the offline
compiler. Omit the second argument to build a smaller preview of the teaching
models. Links to the V1 course require a connection.

## Edit and run CUDA in WebAssembly

Every lesson includes a complete CUDA C++ program. The compiler builds
`main()` as WebAssembly and emits PTX for the device code. GPGPU-Sim executes
the compiled kernels. CUDA calls in `main()` control device allocation,
transfers, and launch dimensions. Architecture examples also exercise shared
memory barriers, atomics, WMMA, successive kernels, stream queues and events.

The browser workbench uses functional simulation. Its console shows the
program's output and CUDA call trace. Operation counts calculated by programs
and timing in the teaching models have their own stated assumptions. Each
lesson saves its own draft. Use Ctrl or Command + Enter to run, Restore
starter to undo edits, and Export .cu to save the current source.

The hosted build includes about 127 MiB of pinned Clang assets and about 5 MiB
of additional architecture runtime assets under its immutable release URL.
The compiler is shipped in small compressed parts; the panel counts those
download bytes. Each reconstructed compiler file is checked against its original
SHA-256 before use. A complete App status download makes the first compile/run
work offline. Without that download, first run fetches the compiler from the
same site. The standalone workbench bundles these assets.

The first hosted build downloads the three compiler assets into the ignored
`vendor/v2-compiler/` cache, checking their SHA-256 hashes against the workbench
metadata. Later builds verify and reuse that cache; a missing or corrupt asset is
fetched again. Publish the whole `dist/`, including `assets/v2-compiler/`, `assets/cuda-workbench/`
and their immutable release copies. Source and build
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
- `python tests/v2_editor.py` compiles and runs every starter and a source
  edit in Chromium. It checks the console or launch trace and the generated
  PTX. Set `CUDA_TEST_COMPILER_DIR` to a local mirror of the pinned
  Compiler.js, Compiler.wasm and Compiler.data files when testing in an
  environment that restricts access to the compiler host.
- Numerical model assumptions are documented in [model.md](model.md). CUDA
  mechanism references are in [sources.md](sources.md).
