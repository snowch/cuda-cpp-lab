# V2 teaching and hardware-context review

Copyright © 2026 Christopher Snow.

The revision extends Lesson 1's code-first teaching structure across the remaining
20 V2 lessons. It preserves the existing CUDA starters, numerical engines, model
control identifiers and saved-state keys. Original recaps explain the V2 examples;
V1's different examples are not substituted for them.

## Design and learning review

Dedicated design/UX and instructional-design skills were not available in this
session. The review followed `AGENTS.md` and the chapter authoring checklist directly.
The skill catalogue was checked; neither kind of dedicated review skill was present.

Reviewed sequence: lesson question and assumptions → fixed starter excerpt and
explanation → launch and complete editor → execution relationships → hardware
context → optional captioned recap/transcript → optional execution model → local
application → annotated references and documentation applications → next lesson.
The first lesson retains its single-thread explanation and existing recording.

The recurring map shows CPU/RAM as host peers, SM resources inside the chip and
separate device memory inside the GPU device. Dashed assigned-block/warp boundaries
represent logical grouping, not physical processors. Load/store units, rather than
L2 alone, are emphasised for warp address generation. Shared-memory banks, tensor
cores and copy engines enter only when their lessons need them. The KV cache is
explicitly distinguished from hardware caches. The hardware key is initially open
when a new group of components enters the map.

Design findings: the initial repeated descriptions made the phone map excessively
tall. Shorter component labels, paired resource columns and a compact other-SMs
panel improve scanning without shrinking body text. Focus uses an explicit “This
lesson” label and border as well as colour. The compute-chip/device-memory boundary
remains visible in both themes. Scoped code panels retain scrolling; prose stays
at the shared reading measure. The header Contents link is removed in both hosted
and standalone views; the brand and lesson breadcrumb retain navigation.

Learning findings: model-only shapes and synthetic machine assumptions are placed
inside the execution-model disclosure, so the opening describes the actual CUDA
starter. This is particularly important for attention, inference, pipelines and
the safe barrier-participation example. Fixed source excerpts must be distinguished from editor drafts
and model cases. Attention's one-thread recurrence is not a production parallel
attention implementation. Precision's FP16 round-trip leaves the arrays FP32.
WMMA fragment layout is not a portable lane-to-coordinate map. Pipeline streams
express dependencies, not guaranteed physical overlap. First-lesson documentation
questions stay with its one-thread launch and readback rather than requiring later
indexing and bounds-check concepts. Existing worked diagrams are retained and the
missing execution relationships are supplied for all other lessons.

## Review evidence

`tests/v2_browser.py` exercises all 21 routes and existing model variants at phone
(390), tablet (820) and desktop (1440) widths in both themes, including keyboard
navigation, invalidation, step restoration and JavaScript-disabled reading.
`tests/v2_context.py` checks all 21 recordings for playback, seeking, caption cues
and readable transcripts, and restores a saved WMMA-video position paused through
the shared restart snapshot. Its review captures cover the introductory, warp,
shared-memory, matrix and copy-engine stages in both themes. Selected opening and
hardware screenshots were inspected directly; they are saved in ignored
`test-results/v2-*.png` files. The standalone model preview was inspected separately.

The offline suite verifies every new recap file against the updated release's
byte count and SHA-256 while the network is disabled, then plays and seeks a recap
offline. It also retains the real editor compilation/restart checks. Unit checks
verify the actual source excerpts, lesson ordering, progressive component exposure
and committed media coverage. Documentation targets were fetched and checked for
the referenced section anchors.

This is an authoring and automated review, not a learner comprehension study or a
physical GPU performance measurement. Narration is synthetic; no independent human
pronunciation review is claimed. Rebuild commands and audio/caption provenance are
in `assets/media/v2/README.md`.

## 2026-11-17: clear wording and uncluttered UI

This pass reviews the current 27-lesson course, its shared editor, model controls,
feedback, figures, hardware explanations, reference questions and model-only preview.
The prerequisites remain basic programming, Python/array indexing and floating-point
familiarity; CUDA and GPU architecture are introduced in the lessons. The home page
now states the prerequisite. Original bookmarked course pages remain available.

The supplied clear-wording/UI checklist is incorporated into the authoritative
chapter checklist and AGENTS.md. Dedicated design/UX and instructional-design skills
are unavailable in the session catalogue, so the equivalent checklist review is
performed directly. This is an author review, not an observed learner study.

### Sentence and action review

The review distinguishes the editable CUDA program, fixed starter excerpts and
independently controlled teaching models. Instructions name the actual declaration
or selector, change, run action and visible evidence. The editor runs the learner's
program; model selectors do not modify that draft. Read-only previews link to an
actual editor rather than requesting unavailable edits.

| Lesson | Reviewed target and resulting clarification |
| --- | --- |
| First kernel | Define thread; change output[0] in the editor and inspect Console. Missing highlight guidance is neutral and explains how to export before restoring. |
| One thread, one element | Name the multiplier expression and Output index 2; model tasks name Multiplier and Thread index. |
| More threads than elements | Change threadsPerBlock in main; inspect the launch trace. The model calculates block count automatically and reports guarded array accesses. |
| CPU array to GPU result | Append named values to x; inspect copy bytes, launch dimensions and nine outputs. The diagram includes only valid-index reads/writes. |
| Coalescing | Define alignment/lane; inspect Sectors touched, not unprinted indices. Explain the schematic's eight lanes versus the program's 32. main launches the kernel. |
| Scheduling | Compare Threads and values, since adding warps changes work. The separate model examines idle issue slots, not measured elapsed time. |
| Divergence | Change alternateSigns; inspect lane 1 and path participation. Remove an unexplained utilisation percentage from the model summary. |
| Reduction | Change threads; inspect Sum and barriers between shared writes/reads. Clarify the diagram's initialisation-to-next-stage scope. |
| Shared-memory banks | Change stride; inspect Modelled service rounds. Do not ask for addresses the program does not print. Define a model service round. |
| Matrix reuse | Compare calculated loads/shared bytes and zero mismatches against the CPU reference, rather than claiming two CUDA kernels are checked. Define dot product. |
| Precision | Change narrowInputs; inspect FP32 accumulation. Individual rounded operands are available in the separate model, not the program Console. |
| Tensor cores | Define accumulator; change startingValue and inspect C[0,0]. A warp issues a collective operation; PTX inspection is optional and explained. |
| Attention | Change keysPerTile; compare Tiles and weighted value. Define softmax/expf and explain rescaling without production parallel-attention claims. |
| Inference | Change cached; distinguish Old cache read bytes from the fixed append payload and from measured device-memory traffic. |
| Matrix investigation | Compare tile width, full CPU verification, source-load counts and shared bytes; keep imaginary SM budgets with the model. |
| Histograms | Name the actual categories array and blockCounts setting; compare Counts for the same inputs and both strategies. |
| Scan | Change inclusive; inspect the two printed indices and identify the flag omitted from an exclusive prefix. |
| Compaction | Name category IDs separately from token IDs. The model question means the kept token with the highest input index, not the last physical writer. |
| Progress | Change readers in the safe program. Conditional-barrier failure is a model-only diagnostic, not a request to run invalid CUDA. |
| Pipelines | Compare first/last outputs and chunk synchronisation counts; these do not establish physical overlap or time. |
| Token routing | Change hot; inspect Slot lines and stable order. Use Next step until the model places token 4. |
| Full-output verification | Name correctIndex above transform and Console's mismatch fields. Prepared matrix inputs appear beside optional candidate comparisons. |
| Grid-stride loops | Compare checked values with launched threads; edit count/blocks above scale. The optional visit model shows individual ownership. Empty inputs have a different explicit Console message. |
| Multi-block scan | Edit count above localScan; the program checks every offset automatically. Optional Flag count controls expose block totals/starts; distinguish these from source edits. |
| Resource trade-offs | Keep the primary calculator visible before hardware context; name limits and units. Optional native inspection names a downloadable program and complete compile command. |
| Measurement | Keep correctness, timing and profiling separate. Native commands are optional; identify Perfetto's Open trace file and the Python reader's file argument for the published capture. |
| Softmax | Locate rows/columns/shift above rowSoftmax and give an exact equal-input assignment. The optional row checker gives a reproducible editor setup and shows missing/extra values explicitly. |

### Interface and saved-work review

The primary action is Compile and run, or the resource/report form where no editor
is present. Editor tools holds export/restore and compiler-download notes. Compiler
warnings are optional; compilation/execution errors open their messages immediately.
A nonzero main() exit reports the program's own checks separately from those errors.
Console text is preserved faithfully. Changing the intended calculation may require
updating its independent CPU reference; a different value alone is not a run failure.

Extra practical models/row checking are optional when an editor is present. In the
model-only preview they remain visible, since there is no competing editor. Native
sanitizer/profiler commands and reference solutions are optional. Core explanations,
contracts, worked calculations and instructions remain visible. Specific model labels
replace generic disclosure names; duplicate headings and repeated installation prose
are removed. Existing code, figures and result tables retain their width and fonts.

No existing route, source-draft key, experiment key or control ID is repurposed.
Workbench snapshot version 1 accepts the new optional outcome/message fields while
retaining source, Console, PTX and trace state. Reset activity still leaves the CUDA
draft alone. The two changed recording explanations are regenerated with matching
captions and metadata; mathematical examples remain unchanged.

### Verification boundaries

Functional validation is recorded with the PR: model/build tests, original/edited
CUDA runs, compiler-warning/error/program-exit paths, snapshot restoration, model
variants, preview availability and phone/tablet/desktop keyboard/theme checks.
The published trace also runs through the actual standard-library Python reader.
Native CUDA benchmark/profiler/sanitizer execution requires an NVIDIA GPU/toolkit
and is not established by these browser checks. No learner-comprehension result
or physical GPU performance measurement is claimed.
