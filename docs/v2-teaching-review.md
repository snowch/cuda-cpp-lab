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
