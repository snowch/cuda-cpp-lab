# V2 practical course extension

Copyright © 2026 Christopher Snow.

The original 21 lessons introduce CUDA behaviour and GPU execution. Six practical
investigations now continue that sequence: independent full-output checks,
grid-stride coverage, cross-block scan, SM resource hypotheses, completion-aware
measurement and an independently implemented stable softmax. Existing URLs and
saved editor keys remain valid. The new section is part four of the course.

The practical section assumes the core block/barrier/prefix lessons. Early copy,
scan and matrix-investigation pages link to the relevant later practice. It does
not introduce compiler front ends, MSHRs or multi-GPU collectives as prerequisites.
Those remain possible advanced extensions rather than claims of current coverage.

## Correctness and scaling

The new CUDA starters compare all outputs to serial CPU calculations. Inputs are
nonuniform, output is poisoned before execution, floating checks reject NaN and
infinity, and integer prefixes compare exactly. Empty elementwise/scan inputs
skip allocations and launches. Grid-stride coverage supports up to 4096 inputs;
the two-level scan supports up to 1024 flags (32 block totals). The latter explains
recursive extension without claiming its fixed second level handles arbitrary size.

The core tiled matrix examples now pad partial input tiles with zero while all
threads participate in barriers, guard output writes, use distinct nonuniform
operands and check every product against a serial CPU reference. Their supported
width is 1–32. Fixed execution models retain their explicitly displayed inputs.
Compaction uses a staged shared scan before scatter; routing uses per-category
shared scans rather than repeated per-thread earlier-token counting. Stable CPU
comparisons verify the complete small outputs. Four V2 recaps are regenerated
from their updated source/context, including captions and metadata.

## Evidence boundaries

Browser compilation and GPGPU-Sim execution establish supported program behaviour,
not GPU performance. The host math shim adds FP32 expf for the independent CPU
softmax reference; device expf continues to use the existing PTX approximation.

`benchmark-fusion.cu` requires native CUDA. It verifies both paths, warms up,
alternates sample order, records CUDA events around repeated complete variants,
excludes allocation/copies and reports all samples and GPU/runtime metadata.
No NVIDIA GPU or native toolkit was available for this revision, so its native
compilation/execution, sanitizer commands and performance remain unvalidated.

The measurement lesson includes eight original events extracted unchanged from
Kineto's published ResNet50 V100 trace. The source commit, compressed-input hash,
extraction boundary and BSD notice are stored beside the excerpt. Missing capture
settings remain unknown. Those profiled durations do not benchmark our kernels.
The timing importer has no prefilled performance numbers and cannot authenticate
an imported report's provenance.

The softmax harness limits rows to 128 and total elements to 8192, keeping its
32-thread blocks within the browser simulator’s 4096-thread launch budget. This
is an exercise limit rather than a CUDA hardware limit.

The resource calculator is explicitly synthetic: 65,536 registers, 64 KiB shared,
64 warps, 2048 threads and 16 blocks per SM; it omits allocation granularity and
reserved storage. It predicts residency bounds only, not spills or elapsed time.

## Instruction and interface review

No dedicated design/UX or instructional-design skill was available in the session
catalogue. The repository authoring checklist is applied directly. No learner
study is claimed.

Reading-order review covers each new opening and its PyTorch calculation, local
concept definitions, worked example, source/ownership contract, activity, hardware
connection, transfer question and reference comparisons. Core review covers tile
loads → barrier/reuse → full product verification, flags → shared scan → scatter,
and histogram → category prefix → stable placement. Optional reference solutions
use native disclosures and never overwrite editor drafts.

New activity results start hidden, invalidate when inputs change, save only the
activity's own state and restore through the app restart hook. Reset clears only
that activity; editor drafts remain independent. Native references and complete
code stay readable without JavaScript. Both themes are reviewed at 390, 820 and
1440 pixels, including initial, failed, successful, changed, restored and reset
states. Screenshots are review artifacts under test-results rather than published
course assets. Automated checks are recorded separately from visual inspection.
