# First two recordings: focused architecture walkthroughs

Copyright © 2026 Christopher Snow.

The audience knows basic programming and array indexing. The first recording
explains how the GPU-written scalar reaches the CPU Console. The second connects
one array index to the SM executing its instructions and the memory holding its
data. Essential CUDA preparation stays visible in the parent lessons.

## Lesson 1

The reviewed story is retained: supplied setup → kernel → CPU launch → SM
execution → GPU write → separate CPU variable → pause before the copy → result
copy → CPU print. The checkpoint explicitly assumes the GPU write and CPU
initialisation have finished. It asks whether the GPU write also changed the CPU
variable. The answer follows the pause. The recording does not ask learners to
edit supplied memory-management or error-checking code.

Both introductory recordings were regenerated with the same pinned voice after
checking the native player with captions and paused controls. The pictures zoom
into the relationship being explained and reserve the lower part of the frame
for those controls. The source, voice provenance and raw speech checks remain
in the normal production workflow.

## Lesson 2

The starter inputs and launch are unchanged. Follow block 0's local thread 2:
its array index is 0 × 4 + 2 = 2. It reads input[2] = 3.0, uses the SM's arithmetic
hardware to multiply by 2.0, and writes 6.0 to output[2] in GPU memory. Its index
chooses the destination regardless of other threads' completion order. The CPU
then copies and prints the results.

The recording introduces the SM before showing its execution role. It uses the
term thread working value without asserting exact compiler register allocation.
Detailed warp, lane, scheduler and register discussion stays in later lessons.
The picture distinguishes the GPU compute chip from GPU memory and logical
thread state from shared execution hardware.

The next experiment uses multiplier 4.0f, distinct from the page's 3.0f editor
exercise and 0.5 model question. It asks for the third Output value and the
hardware doing the multiplication. It names runKernel, the CUDA source editor,
Compile and run and Console's Output. Editing and pause instructions precede
the comparison. The expected third value is 12.0, generated from the same
introductory model as the worked example. Array values keep floating-point
notation; the illustrative Console reproduces the actual starter's print format.

## Design and learning review

[Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
guides the hierarchy: Plex typography, existing CUDA blue and teal, one dominant
relationship per shot, large operation/value labels, and no full architecture
catalogue beside every code line. The relevant code and diagram stay above a
reserved caption area. Model boundaries describe an illustrative discrete GPU,
not measured timing or a chip floor plan.

[Instructional Design](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md)
guides the sequence: prepared state → question → focused explanation → pause or
experiment → comparison. Terms precede their use, narration distinguishes
supplied setup from learner actions, and the hardware view adds a relationship
to the parent lesson's logical flow. Consecutive transcript sections with the
same heading are merged.

Native captions are toggleable. Display chunks preserve the complete canonical
script and contain at most 48 characters. Their boundaries are interpolated
inside each measured speech cue; this is not forced word alignment. The player
uses automatic bottom positioning so its controls can move captions; it no
longer places them on the header. Inspect actual encoded playback with captions
and controls at phone, tablet and desktop sizes in both themes.

The phone review caught captions overlapping scalar values when controls were
open. The final layout raises the graphics and uses shorter display chunks;
it also balances the last chunk to avoid flashing a trailing word alone.
Source checks cover all 28 shots. Encoded copy, prediction and multiplication
shots were inspected with native captions and controls at 390, 820 and 1440
pixels, with light and dark page surroundings, plus fullscreen playback.

The built reading-order review covers the preceding lesson question, optional
recording and following References section for both lessons at those three
widths in both themes. Essential preparation remains in the lesson; the
recording and transcript are optional. Keyboard disclosure controls work and
consecutive transcript headings no longer repeat.

The original examples and recording edits were followed through the actual
CUDA editor: L1 prints 42.0 then 7.0; L2 prints [2, 4, 6, 8, 10] then
[4, 8, 12, 16, 20] with multiplier 4.0f. These are browser simulator checks,
not results from a physical GPU or evidence of learning effectiveness.

Production uses the pinned [Common Ground record-demo skill](https://github.com/snowch/claude-skills/blob/c9a7c521568632aa216932f4c965df386498602a/plugins/demo-video/skills/record-demo/SKILL.md),
Kokoro v1.0 ONNX CPU, af_heart, speed 1.0. Functional verification, independent
ASR screening and author visual review are distinct from human listening
approval or evidence of learner understanding. The raw flags, explicit reviews,
media hashes, full decode and scene comparisons are retained in the production
reports. Unselected recordings must keep their existing hashes.
