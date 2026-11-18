# Learner wording and interface review

Copyright © 2026 Christopher Snow.

The current CUDA course assumes basic programming and array indexing. It introduces CUDA and
GPU architecture beside the examples. The earlier book assumes learners can also read Python,
lists and arrays. The review used those prerequisites and the reading-order checks in the
[authoring checklist](authoring-checklist.md). Dedicated UX and instructional-design skills
were unavailable in the workspace. The checklist supplied both reviews directly.

## Page and experiment coverage

The published inventory has 78 HTML routes. It includes the course landing page and V2
contents, 27 current lessons, the standalone CUDA editor, the earlier book and its 47
lesson, appendix, practice and recording routes. The per-lesson source and rendered pages
were read in sequence, including local code labels, action prompts, results, follow-on
questions, diagnostics and optional materials.

| Lesson or group | Learner action and evidence checked |
| --- | --- |
| Write your first GPU value | Run the supplied program, edit the output assignment in `hello` from 42.0f to 7.0f and read Console. The optional recording now compares the separate CPU and GPU values before the result copy; see the introductory recording review. |
| One thread, one element | Change the multiplier from 2.0f to 3.0f and inspect the value and position of the third output. |
| More threads than elements | Change four threads per block to three. Compare the launch line under Trace CUDA calls with the five output values in Console. |
| From CPU array to GPU result | Extend the input from five to nine values. Compare the byte counts, launch dimensions and output length. |
| Same load, different addresses | Run strides 1, 2 and 32 in `runKernel`. Compare 4, 8 and 32 aligned 32-byte sectors from the returned addresses. |
| What runs while a warp waits? | Compare 32 and 64 threads and their element counts in Console. The separate model follows waits and idle instruction slots. |
| When lanes take different branches | Disable alternating signs and compare the two labelled lane outputs. The two runs use the same branch condition. |
| Add values across a block | Use four and eight threads and compare the sums. Locate the barrier before the next partner reads. |
| When shared-memory addresses collide | Change the word stride from 32 to 33. Explain why grouping requests by bank changes 32 calculated service rounds to one. |
| Reuse inputs in a matrix tile and Investigate a matrix multiplication | Change the tile width from two to four. Compare input-element loads and shared bytes per block with zero mismatches. Then use width five or seven to check partial tiles. |
| What changes when inputs use fewer bits? | Disable the FP16 conversion and compare FP32 accumulation. The separate model shows individual input rounding. |
| How a warp cooperates on a matrix tile | Change the starting accumulator from 0.0f to 4.0f. Compare C[0,0]. The optional PTX inspection shows the matrix instructions. |
| Keep less intermediate data in attention | Increase keys per tile from two to four. Compare Tiles and weighted value for the eight-key input. |
| Follow the key-value cache during inference | Increase cached tokens from four to eight and compare old cache read and append, in bytes. |
| Count token destinations safely | Use eight zero categories. Compare Counts with block counters enabled and disabled. |
| Build positions from prefix sums | Switch from inclusive to exclusive and inspect Index 5 and index 7. |
| Pack surviving tokens in order | Change the kept category from zero to one. Compare the Kept token IDs and their input order. |
| Find a parallel program’s progress dependency | Increase readers from two to four and compare Read outputs. Locate the barrier that every thread still reaches. |
| Overlap copies with computation | Turn overlap off. Compare the first and last output with the chunk-synchronization count. The separate teaching schedule illustrates overlap. |
| Investigate stable token routing | Set hot to true, compare slots and inspect the input order of token IDs within one destination. |
| Check every GPU result | Change the safe indexing expression through `correctIndex`. Inspect the program’s mismatch fields and restore the original setting. |
| Process more inputs than the launch has threads | Change the element count to cover short, empty and longer inputs, then run one block with 129 inputs. Compare coverage with the launch size. |
| Carry a prefix across blocks | Compare sizes that cross a block boundary and an empty input. Inspect the offset count, blocks, total and mismatches. |
| Explain an SM resource trade-off | Change resource limits in the model. Explain occupancy using resident warps and the maximum for the same SM. |
| Measure a GPU kernel fairly | Follow the local capture without a GPU. Analyse a benchmark report only when a native run supplies one. The recorded ResNet50 workload and the fusion exercise have distinct inputs and claims. |
| Build and verify a stable softmax | Run the zero-writing scaffold. Console reports numerical mismatches from the program. Implement the three passes, then check the output and row sums at the stated shapes. |
| Earlier book, map, appendices and recordings | Read the current-course handoff, operation and model labels, original and changed settings, optional documentation questions, captions and local execution guidance. Kept the legacy navigation and recording content. |

## Interface and verification

The CUDA lesson now identifies its prepared source, names the starter’s evidence and gives
a literal change. The same workbench offers one run action and keeps compiler warnings,
inspection and export separately available. Edits and failed attempts visibly identify the
previous successful output. A program's nonzero exit and its printed numerical check are
reported separately from compiler or simulator errors.

Draft storage continues to use the existing lesson-specific keys. If the browser rejects
a persistent write, the workbench attempts a tab-scoped save and explains where to export
the current source. Restore starter retains the prior draft for Undo restore. These controls
are available in both the standalone page and the embedded workbench. Existing snapshots
can reopen without the new result-provenance field.

Checked phone, tablet and desktop layouts in light and dark themes. The checks included
keyboard access to editor tools, exact export, restoration after reload, draft recovery
after storage quota rejection and visible provenance after an invalid source edit.
Browser runs execute compiled CUDA through the functional simulator. The teaching models
calculate their own results with the displayed assumptions. Existing audio and captions
were retained as recorded. Native physical GPU execution and measured learner understanding
were outside this verification.
