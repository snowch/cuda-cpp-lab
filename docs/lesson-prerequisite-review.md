# Lesson preparation and recording alignment

Copyright © 2026 Christopher Snow.

The learner knows basic programming and array indexing; CUDA syntax and GPU
architecture are introduced by the course. This review follows the current
27-lesson catalogue (21 core lessons and six practical extensions). It screens
visible introductions, terms, starter explanations, tasks, optional model
assumptions and the first two recording scripts. It does not constitute listening
approval or a learner study of all recordings.

## Gaps addressed

| Lesson | Missing preparation | Visible addition |
| --- | --- | --- |
| 1 · First GPU value | The result-copy call appears in the program and recording, but the main text only says “copies it back”. The editable `float` literal and pointer parameter also lacked a local explanation. | Explain the GPU address and `f` suffix; show the actual result-copy and print excerpt; explain CPU destination, GPU source, byte count, direction and supplied error checking before Try it. Link to lesson 4 for the array workflow. |
| 2 · One thread, one element | The displayed kernel uses CUDA index names and a bounds guard before lesson 3 explains them. | Define block and local indices, block size, and the purpose of the guard beside the starter; retain lesson 3’s deeper launch experiment. |
| 4 · CPU array to GPU result | The primary edit asks about bytes and input length, but the explicit `sizeof` explanation was in the optional model. Copy argument roles and `CUDA_CHECK` were implicit. | Explain automatic element/byte counts and copy argument order in the essential reading before the editor. |
| 10 · Matrix reuse | The starter moves from one-dimensional indexing to two-dimensional blocks and flat row-major matrices. | Explain local row/column indices, block coordinates and the flat array offset beside the starter. |
| 18 · Compaction | The explanation relies on stream ordering before streams are defined in lesson 20. | Define a stream locally and connect the default stream to the flag → scan → scatter dependencies. |
| 20 · Pipelines | Pinned host allocation and the third/fourth launch arguments appear without a local explanation. | Explain pinned CPU memory, its role in possible overlap, zero dynamic shared-memory bytes and the selected stream using the actual starter launch. |

The later lessons already provide local preparation for warp/lane grouping,
shared memory and barriers, scalar-format rounding, WMMA fragments, online
softmax, prefixes, stable grouping and CPU-reference checking. The practical
extensions explicitly separate correctness, synthetic resource limits and real
GPU measurement. This focused review does not establish that every sentence or
every recording is free of further gaps.

## Design and learning decisions

- [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): reuse the existing code panels, Plex typography and code-explanation styles. Add essential explanations in reading order without new controls or disclosures.
- [Instructional Design](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md): prepare the exact interpretation or action requested next. Keep introductory readback separate from the later array-management exercise. Explain only the CUDA helpers and arguments needed here.

The L1 excerpt is extracted from `examples/first-kernel.cu`, which also supplies
the editor; line breaks change only for reading width. The lesson uses its normal
link builder so the lesson-4 link also works in assembled book exports. Saved
source, storage keys, starter values and execution code are untouched.

Additional reading preparation is separate from the recorded talk-track fields.
Existing tests verify that all published captions still match their visible
transcripts. The newer L1 recording remains a separate review copy; this change
does not treat its creation as approval to replace the published recording.

## Verification

Functional checks and built reading-order observations are recorded on the PR.
The affected starter and edited programs are run through the actual source editor
in fresh browser contexts. Phone, tablet and desktop checks cover both themes,
code containment, the preceding and following sections and keyboard navigation.
These checks verify behaviour and presentation; they do not prove understanding.
