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

## Remaining review

The remaining chapters are reviewed in reading order, with each changed chapter
committed, merged and verified publicly before the next chapter is changed.
Review findings and release evidence are added here as that work completes.
