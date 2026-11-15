# Concept diagrams review

Copyright © 2026 Christopher Snow.

This review keeps the existing course questions, examples and assessments. A
new diagram must make a relationship visible: ownership, dependencies, data flow,
or the boundary between an algorithmic count and hardware evidence. A numerical
result table alone does not necessarily provide that relationship. Existing
concept diagrams are retained where they already explain it.

The learner and self-paced format follow `plan.md`: AI/ML practitioners who read
Python and arrays, with no assumed CUDA or computer-architecture background.
Diagrams support the existing outcomes; they do not add a second curriculum.
The review applies the pinned
[Course Builder alignment checks](https://github.com/ericrisco/rsc-harness/blob/f3765d35e91690c0c7e511447da6cd0176ab38e0/skills/course-builder/SKILL.md)
and
[UX Design guidance](https://github.com/f0d010c/stark/blob/ff94e5b4e1c98d259f3cde9f806406c4528deed4/skills/ux-design/SKILL.md).
Existing curriculum and shared styling constrain their application; no new
profile wiki, course sequence, assessment system or navigation is required.

## Review contract

- **Job:** connect the familiar calculation to the hardware, storage or algorithm
  relationship needed by the next example.
- **Reader mode:** a first-time learner, or a returning reader inspecting a worked
  example. Reading is low risk; existing experiment controls remain the actions.
- **Pattern:** a local, visible concept figure in the downward reading flow.
  Avoid new controls, decorative cards and diagrams that merely repeat a result.
- **Cognitive load:** reuse the chapter's terms and small dataset. Define necessary
  new terms before the figure. Use native text, tables and labelled boundaries;
  preserve 16px body text, both themes and phone layouts.
- **States:** initial unknown results, Run, changed inputs, answer comparisons,
  return/restart restoration and no JavaScript must keep their existing meaning.
- **Evidence:** inspect preceding → changed → following content, phone/tablet/
  desktop in both themes, keyboard and relevant state paths. Automated checks
  and author inspection are not learner-comprehension testing.

## Completed chapters

| Chapter | Relationship and outcome | Decision and evidence |
| --- | --- | --- |
| 1 · Threads and a kernel | Explain why separate logical threads do not own separate arithmetic units. | Add a fixed worked diagram beside “Where do these threads run?”. Model-derived inputs/results for threads 0 and 1 stay separate while one shared arithmetic category performs their doubling. GPU array storage is outside the compute chip; working values and arithmetic are inside the illustrated SM. Keep thread/block/index/bounds maps and all prediction boundaries. |
| 2 · Tensor storage | Separate processors from tensor storage and locate CPU/GPU copies. | Existing opening architecture figure and matching narrated recap were completed in PR #136. Retain them. |

### Chapter 1 reading and design review

Reviewed the worked block tiles and selected index → SM definition and new fixed
hardware diagram → CUDA launch explanation and visible complete kernel. The
launch paragraph now names the Worked grouping example, avoiding an ambiguous
reference to “the diagram” after the new hardware figure is inserted.

The figure follows known inputs 1.0 and 2.0 into separate working values and the
shared multiply operation, then back to outputs 2.0 and 4.0. Its numeric data comes
from `simulateIntro`; array indices and thread IDs remain integers. The chosen
pair is explicitly from block 0. It introduces neither warp scheduling nor
register-allocation rules, and makes no placement, unit-count or timing claim.
The existing Inside an SM recording remains a narrated explanation of the same
relationship and needs no changed talk track.

Inspected at 390, 820 and 1440px in light/dark themes. On narrow layouts the memory
and chip stack and the read/write arrows turn down/up. Labels, values and chip/SM
boundaries stay readable without horizontal page overflow. No diagram content
requires JavaScript or a disclosure. Changed-multiplier and regrouping paths keep
the fixed example distinct from each experiment's result; the complete CUDA
function and launch-completion explanation remain visible.

## Whole-book baseline and decisions

Reviewed all twenty built pages at 390px dark and 1440px light after their
local guided Runs and initial trace steps; inspected the resulting figures and
the preceding/changed/following source explanations. No baseline page overflow
was found. This is author inspection, not observed learner testing.

| Chapter | Decision | Relationship to make visible, or reason to retain |
| --- | --- | --- |
| 1 | Add; PR #137 | Separate thread values use shared SM arithmetic; GPU arrays sit outside the compute chip. |
| 2 | Retain; PR #136 | Existing opening architecture locates processor/storage peers and labels transfer directions. |
| 3 | Add | One input count drives matching storage and launch coverage; copying results back establishes CPU availability. |
| 4 | Retain | Highlighted source coordinates map to selected values and their individual results. Extra storage detail belongs in chapter 5. |
| 5 | Add | Original tensor and column view share storage; packing this strided column creates separate storage. |
| 6 | Add | Warp lane reads generate addresses that are grouped into aligned sectors; several reads can share a sector. |
| 7 | Retain | Existing visible hardware/data-flow figure distinguishes working values from shared units; warp readiness and block ownership have dedicated diagrams. |
| 8 | Add | Condition membership selects positive/negative lane masks; paths only run for non-empty masks. |
| 9 | Add | Shared writes precede partner reads through a barrier reached by all block threads, including threads that do not add. |
| 10 | Add | Shared input tiles feed distinct threads' partial output sums, so a loaded input serves several outputs. |
| 11 | Add | A cooperating warp supplies matrix tiles to supported multiply-and-accumulate hardware; numeric format and hardware execution are separate choices. |
| 12 | Add | Full score/weight intermediates versus repeated key tiles and running normalisation/weighted totals. |
| 13 | Add | Paired key/value rows are extended per sequence/layer and reused by the new query; this is model data, separate from hardware caches. |
| 14 | Add | Correctness and model counts support a hypothesis; controlled completion-aware hardware measurements support a recommendation. |
| 15 | Retain | Input-category contributions map to counter bins, with selected updates and block-partial merging. |
| 16 | Retain | Previous and new scan snapshots show partner dependencies without mixing stage values. |
| 17 | Retain | Flags and exclusive offsets map surviving tokens into distinct stable output slots. |
| 18 | Retain | Fork ownership/request arrows expose wait dependencies; barrier participation and resident-block progress have separate states. |
| 19 | Retain | Shared copy/compute timeline shows ready/consumed events and slot lifetimes on a synthetic time axis. |
| 20 | Retain | Count-only and stable-grouping diagrams connect bin starts and ranks to disjoint output regions. |

The main continuation lessons in chapters 8–14 currently use numerical cards and
tables. Related diagrams in legacy explorers or companion recordings do not
replace a local diagram of the relationship needed for the main exercise.
All twenty chapters already have recorded recaps, captions, transcripts and PDF
slides. The planned inline additions visualise existing explanations; matching
recordings remain relevant without a new topic or blanket media regeneration.

Change gates remain chapter-specific: build/model checks, full browser suite,
focused six-layout/theme and reading-order review, PR/production CI, merge, then
public release/figure/interaction verification before the next changed chapter.

## Remaining review

The remaining chapters are reviewed in reading order, with each changed chapter
committed, merged and verified publicly before the next chapter is changed.
Review findings and release evidence are added here as that work completes.


### Chapter 1 release evidence

[PR #137](https://github.com/snowch/gpu-lab/pull/137) merged as
`c7aa4e95ee76da460d8c9749f698a5dee6a64c2d`. PR and production checks passed,
including offline packaging, the full browser suite and CPU example validation.
Public release metadata and page footer matched that SHA. Inspected the live
phone/dark and desktop/light figures, confirmed their hierarchy and values,
changed the original multiplier and verified the visible complete CUDA function
and launch-completion explanation before starting chapter 3.

### Chapter 3 reading and design review

Connect the already-explained input count to matching CPU/GPU storage and to
launch coverage, then distinguish a queued launch from the blocking result copy.
The fixed worked figure follows the result-copy and cleanup explanation and
precedes the complete reference and nine-input transfer exercise. Its counts
come from the existing five-input and launch models; it exposes no new-case
answer. A different block count never changes the kernel's element count.

The existing recap already narrates the count/storage/launch/copy relationship.
The new inline diagram provides a local overview rather than adding another
concept, exercise or recording. Shared diagram styles apply only to the new
concept components; existing chapters retain their presentation.

Inspected the built sequence and figure at 390/820/1440px in both themes.
Ordered arrows turn downward in the stacked layout; both storage/launch
branches explicitly name n as their source. No overflow or small-text workaround.
Focused browser checks passed keyboard answers, exact-source download, preserved
chapter-2 return state and visible no-JavaScript content. The nine-input answer
stays collapsed until the reader opens the comparison.


### Chapter 3 release evidence

[PR #138](https://github.com/snowch/gpu-lab/pull/138) merged as
`a75ecfcd5229b47c1aee2c2bf065bb08a37a80e9`. Local, PR and production checks
passed. Public release metadata and footer matched that SHA; automated checks
and actual phone/dark and desktop/light inspection confirmed the diagram,
count/launch/completion wording and keyboard comparison before chapter 5 began.

### Chapter 5 reading and design review

The column view follows the existing row/view/stride explanation. The new
storage-reference diagram sits after the packed-copy explanation and before its
prediction task. Two tensor references share one original storage; packing this
strided column copies its selected values into new storage. Both originals
remain available. This is a logical storage relationship before multiplication,
not a device floor plan or an assertion that every `.contiguous()` call copies.

No offsets, byte totals, tensor values or new-column answers appear in the
figure. The interactive memory strip still reveals those only after Run. The
existing recap already explains sharing and packing, so its narration remains
applicable without adding another topic or exercise.

Inspected the preceding column section, packed explanation/diagram, task and
current source/result states in the built page at 390/820/1440px in both themes.
References stay paired on phones; both lead to original storage, while the copy
arrow changes direction and the packed tensor leads to separate storage.
Focused checks passed unknown offsets/results, independent column/packed runs,
changed-column invalidation, keyboard Run and no-JavaScript visibility. No page
overflow, hover-only content, new controls or reduced diagram text size.


### Chapter 5 release evidence

[PR #139](https://github.com/snowch/gpu-lab/pull/139) merged as
`6bd7721c5a5d21d89673ad3c2c0c9aa8e18b377e`. Local/PR/production checks passed,
and public metadata/footer matched the merged release. Inspected actual public
phone/dark and desktop/light figures; shared/separate storage, unknown offsets
and outputs, independent changed-column/packed runs and keyboard operation passed.

### Chapter 6 reading and design review

The warp/lane and sector definitions precede the experiment's aligned-allocation
assumption. The new diagram follows that assumption, before the prediction:
element offset to byte offset, sector number by division/rounding down, then
group matching sector numbers. The unit constants come from the existing model.
It exposes no particular read pattern's addresses, sector count or output.

The existing task still compares row, column and packed reads, then applies the
rule to a row crossing a boundary. Initial sector cards/results remain unknown
until Run. The figure describes one input read's addressed regions; physical
DRAM traffic and time remain outside the model. The recap already narrates this
relationship and needs no new topic or talk track.

Inspected the built assumptions → diagram → task/source/results sequence on
390/820/1440px in both themes. Shared flow arrows turn downward on narrow
layouts, without overflow or reduced text. Keyboard and no-JavaScript checks
passed. Initial/changed answers remain unknown; row, column, packed and
boundary-crossing runs agree with the model. A row wholly in sector 1 confirms
that a sector number is distinct from the count of sectors.

### Chapter 6 release evidence

[PR #141](https://github.com/snowch/gpu-lab/pull/141) merged as
`d6c889921445cd9c2f7b01e5dd4d81d50422b955`. Local and PR checks passed.
Production checks/deploy passed on retry after a local test-server connection
reset while fetching a download. Public release/footer matched the merged SHA;
inspected actual phone/dark and desktop/light figures and verified keyboard
row/column/packed/boundary cases before continuing.

The separate user-requested Chapter 1 menu removal landed in
[PR #142](https://github.com/snowch/gpu-lab/pull/142), release
`415d8387a0f75b10e26036f1f5e90c9b4f88314d`. Full local/PR/production checks and
actual public phone/desktop, keyboard, direct-section-link and static checks
passed. The five section targets and visible complete CUDA function remain.

### Chapter 8 reading and design review

The opening distinguishes the chosen branch model from Python's evaluation of
both expressions supplied to `torch.where`. The lane-mask definition and the
first experiment's two possible operations precede the new condition-to-mask
figure. The prediction and independent source/Run controls follow it. The next
section introduces mixed paths and its separate three-operation negative case.
The figure is explicitly scoped to the first experiment's non-zero inputs.

True and false masks select different arithmetic; each included lane retains its
own output. No participant indices/counts, output values or new-case answers are
shown. The scope note excludes simultaneous execution and dedicated units. The
existing recap explains these same masks and remains aligned.

Inspected 390/820/1440px in both themes and read the built preceding/changed/
following sequence. The first phone draft stacked alternatives like a sequence;
the revised pair stays side by side at readable shared text sizes. Condensed
labels avoid awkward hyphenated wrapping. No page overflow or new controls.
Focused checks passed uniform signs, alternating masks, a rare three-operation
negative path, unused positions, independent invalidation, keyboard Run/step and
no-JavaScript visibility. Results remain hidden until Run.
