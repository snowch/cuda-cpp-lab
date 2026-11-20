# GPU Lab

Copyright © 2026 Christopher Snow.

[GPU Lab](https://snowch.github.io/gpu-lab/) is an interactive CUDA C++ course for
AI practitioners who want to understand how GPUs execute their programs. Edit,
compile and run complete CUDA examples in your browser using GPU simulation.
No installation or GPU is required.

Start with one thread writing one value, then follow memory access, warp execution,
synchronisation and the parallel patterns behind AI workloads. The examples assume
basic programming and array indexing; each lesson introduces the CUDA concepts it
uses. Browser models and simulated execution do not measure physical GPU performance.

## CUDA foundations

1. [Write your first GPU value](https://snowch.github.io/gpu-lab/v2/first-kernel.html): Launch one thread, write one value, and read it back in main().
2. [One thread, one element](https://snowch.github.io/gpu-lab/v2/one-thread-one-element.html): Change a CUDA multiplier and follow each input to its output.
3. [More threads than elements](https://snowch.github.io/gpu-lab/v2/more-threads-than-elements.html): Change the block size and see which threads stop at the bounds check.
4. [From CPU array to GPU result](https://snowch.github.io/gpu-lab/v2/from-cpu-array-to-gpu-result.html): Change the input length and follow allocation, copies and the kernel launch.

## GPU execution and AI workloads

5. [Same load, different addresses](https://snowch.github.io/gpu-lab/v2/coalescing.html): Change a warp’s input stride and predict which 32-byte sectors its reads touch.
6. [What runs while a warp waits?](https://snowch.github.io/gpu-lab/v2/scheduling.html): Follow a load dependency and compare what happens with one ready warp or two.
7. [When lanes take different branches](https://snowch.github.io/gpu-lab/v2/divergence.html): Change the signs in a warp’s inputs and track which lanes execute each branch.
8. [Add values across a block](https://snowch.github.io/gpu-lab/v2/reduction.html): Trace a block reduction and identify the barrier that makes each partial sum safe to read.
9. [When shared-memory addresses collide](https://snowch.github.io/gpu-lab/v2/shared-memory-banks.html): Change the stride of a shared-memory read and group the simultaneous requests by bank.
10. [Reuse inputs in a matrix tile](https://snowch.github.io/gpu-lab/v2/matmul.html): Compare a direct CUDA matrix product with a tiled kernel and trace which loads the tile reuses.
11. [What changes when inputs use fewer bits?](https://snowch.github.io/gpu-lab/v2/precision.html): Change the input format and compare rounded operands, storage and the resulting sum.
12. [How a warp cooperates on a matrix tile](https://snowch.github.io/gpu-lab/v2/tensor-cores.html): Follow a CUDA warp-level matrix operation and distinguish its input fragments from its accumulator.
13. [Keep less intermediate data in attention](https://snowch.github.io/gpu-lab/v2/attention.html): Compare full score storage with a tiled calculation that carries an online softmax state.
14. [Follow the key-value cache during inference](https://snowch.github.io/gpu-lab/v2/inference.html): Change sequence length and account for the key-value data read and appended during decoding.
15. [Investigate a matrix multiplication](https://snowch.github.io/gpu-lab/v2/matmul-investigation.html): Choose a tile width, predict its resource trade-off and decide what to measure on a GPU.

## Parallel patterns

16. [Count token destinations safely](https://snowch.github.io/gpu-lab/v2/histograms.html): Trace competing updates and compare global atomics with per-block partial counts.
17. [Build positions from prefix sums](https://snowch.github.io/gpu-lab/v2/scan.html): Step through shared-memory scan stages and convert inclusive totals to exclusive offsets.
18. [Pack surviving tokens in order](https://snowch.github.io/gpu-lab/v2/compaction.html): Use selection flags and exclusive offsets to explain each surviving token’s write destination.
19. [Find a parallel program’s progress dependency](https://snowch.github.io/gpu-lab/v2/progress.html): Find which threads reach a block barrier and explain why the rest must also arrive.
20. [Overlap copies with computation](https://snowch.github.io/gpu-lab/v2/pipelines.html): Order copies, kernels and buffer reuse with explicit dependencies.
21. [Investigate stable token routing](https://snowch.github.io/gpu-lab/v2/token-routing.html): Combine counts, starts and ranks to place every token once, then design a performance measurement.

## Practical GPU investigations

22. [Check every GPU result](https://snowch.github.io/gpu-lab/v2/verify-every-output.html): Compare every output with a CPU reference, then diagnose a safe indexing error.
23. [Process more inputs than the launch has threads](https://snowch.github.io/gpu-lab/v2/grid-stride-loops.html): Give each input one owner with a grid-stride loop, including tails and empty inputs.
24. [Carry a prefix across blocks](https://snowch.github.io/gpu-lab/v2/multi-block-scan.html): Combine local scans, block totals and block starts in an ordered GPU pipeline.
25. [Explain an SM resource trade-off](https://snowch.github.io/gpu-lab/v2/resource-tradeoffs.html): Calculate a residency limit and identify which hardware observation could test an optimisation.
26. [Measure a GPU kernel fairly](https://snowch.github.io/gpu-lab/v2/measure-a-kernel.html): Separate correctness, kernel timing and profiling, then interpret recorded evidence.
27. [Build and verify a stable softmax](https://snowch.github.io/gpu-lab/v2/softmax-capstone.html): Implement an independent row-wise kernel, verify unseen shapes and explain its bottleneck.

Original book and lab URLs remain available for existing bookmarks.
See [the model contract](docs/model.md) for the scope of the teaching models.

## Run examples on your desktop

The [desktop appendix](https://snowch.github.io/gpu-lab/lessons/desktop.html) provides
complete Python downloads for every chapter, CPU/CUDA setup, and a pinned GPGPU-Sim
container for supported CUDA examples without a physical GPU. Complete PyTorch
panels also have a Download Python button that preserves the current settings.
PyTorch runs separately from GPGPU-Sim. CPU and functional simulator checks do not
validate real GPU performance. See [setup and coverage](docs/run-cuda.md).

## Use offline

Choose **Install** in the course header to add GPU Lab to your apps with its own GPU-chip
icon and standalone window. Chrome and Edge offer a native install prompt when available;
the dialog also explains Safari’s Add to Dock / Add to Home Screen options. Installed apps
use the same offline course. Installation and shortcut placement are controlled by your browser.

Online visits and reloads request the currently published pages. An already-open
lesson stays stable, with its own version of scripts, editor and examples. Offline
visits use the saved course; reading current content online needs no full download.

Open **App status** and choose **Save offline copy** to save the complete course.
**Up to date online** describes the page version; it does not mean the course is saved offline.
The panel shows the package size before saving every lesson, recording, simulator,
diagram and CUDA/PyTorch example, including lessons you have not visited. Wait for
**Downloaded and ready to use offline** before disconnecting. External links need internet access;
running downloaded examples requires their usual local tools. Installing the app
and checking for updates do not automatically download the offline course.

App status distinguishes the current online page from its saved offline copy.
Use **Update offline copy** for a newer version, or **Repair offline copy** if saved files are incomplete.
If an offline lesson is unavailable, its recovery page explains how to return or retry; it does not replace the cached lesson with an error page.
Choose **Restart to update** when a prepared offline update is ready. Open GPU Lab windows save
their experiment state before restarting together; a busy or non-responsive window
blocks the restart. **Later** keeps the pending badge visible. Closing all windows
or refreshing does not select a prepared offline copy automatically; online visits
can independently read the published version.

Cancelled downloads can resume from verified files. Failed replacements leave the
previous complete copy usable. App status detects missing/evicted files and offers
repair. **Remove offline copy** asks for confirmation and preserves learner work,
preferences and other apps. Offline access requires HTTPS (or localhost) and browser storage.
See [the release contract, migration notes and validation](docs/app-status.md).

## Develop

Node.js 22 or newer. The application and model tests have no package dependencies.

```sh
npm run dev      # http://localhost:5173/gpu-lab/
npm run check    # model tests and static build
```

`npm run dev` builds once before serving. Re-run `npm run build` after changing lesson content.

Browser checks run against the built site at `/gpu-lab/`, at desktop and phone sizes, in both themes:

```sh
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
python tests/browser.py
python tests/offline.py
```

CI runs the model/build and both browser suites before deploying `dist/` from `main` through GitHub Pages Actions.
Pull requests run checks without deployment. All application assets use relative paths.

The build emits `release.json`, immutable `releases/<build-id>/` assets and a stable
`sw.js` lifecycle engine. Clean Git builds retain their source commit/date in the
footer; archives and dirty development builds identify themselves without a fake
revision. App status uses network-only deployed metadata, never GitHub `main`.
The worker prepares files only on request and verifies size and SHA-256 before
selection. During development, use App status to update, or unregister the worker
in browser developer tools while iterating. The browser suites exercise both root
and `/gpu-lab/` hosting, complete offline access and multiple real built releases.

A separate workflow compiles and runs small CUDA examples in GPGPU-Sim on a CPU runner.
It validates outputs against a CPU reference and saves logs; it does not yet compare timing
or memory counters. See [validation layers](docs/validation.md).

## Try CUDA

The browser needs no GPU. [examples/gather.cu](examples/gather.cu) is an optional standalone
CUDA program with input bounds, runtime error checks and CPU-result comparison:

```sh
nvcc -O2 examples/gather.cu -o /tmp/gpu-lab-gather
/tmp/gpu-lab-gather 8 0 32
```

It requires the CUDA toolkit and an NVIDIA GPU. It is a correctness exercise, not a benchmark.
The initial implementation has not been validated on GPU hardware.

`examples/ai-kernels.cu` adds self-checking naive matmul, tiled matmul and block reduction.
The GPGPU-Sim workflow compiles and checks those kernels as well as gather. The current course also provides complete WMMA and scalar online-attention starter programs; their functional simulation limits are described in the lessons.

## Repository layout

- `src/model.mjs`: pure address model; all figure values derive from its result.
- `src/architecture.mjs`: scheduling, divergent paths and shared-memory bank models.
- `src/ai-models.mjs`: reductions, tiled matmul, numeric conversion, attention and inference budgets.
- `content/v2-course.mjs`, `content/v2-view.mjs`: current course catalogue and page renderer.
- `content/v2-cuda-source-workbench.html`: editable CUDA programs and compiler integration.
- `src/v2-model.mjs`, `src/v2-traces.mjs`: teaching models and execution traces.
- `src/theme.mjs`: theme persistence.
- `content/v2-appendices.mjs`, `content/profiling.mjs`: current desktop and profiling appendices.
- `src/style.css`, `src/v2.css`: shared course presentation.
- `tests/`: model invariants, boundary cases, browser interactions and responsive layout.
- `examples/`: optional runnable CUDA exercises.
- `docs/`: curriculum, model scope, sources and development rules.

Inspired by the model-driven learning approach in [Digital Design](https://github.com/snowch/digital-design)
and [Assembly Lab](https://github.com/snowch/assembly-lab). This small standalone prototype does
not yet integrate `snowch/learning-platform`; migration is a separate curriculum/platform decision.
