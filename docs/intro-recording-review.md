# First two recordings: architecture walkthroughs

Copyright © 2026 Christopher Snow.

The audience can read basic programs and array indexing, but needs no prior CUDA
or architecture knowledge. The gap is connecting a correct Console result to
execution hardware and storage, rather than hearing the lesson text again.

The first recording asks where a GPU-written value travels before the CPU prints
it. The second follows input index 2 through thread working state, arithmetic and
an output store. The same original discrete-GPU map distinguishes the host, GPU
device, compute chip, SM and device memory. Logical blocks use dashed boundaries;
physical resources use solid boundaries. Caches, exact register allocation,
placement policy and timing remain outside the illustration.

Each scene changes a meaningful relationship or state alongside the source.
Predictions use a new stored value (13.0f) and multiplier (0.5f), with a five-second
hold before the comparison and precise instructions for trying the edit. The
second recording distinguishes three launched threads that skip array operations
from 28 unoccupied positions in each block's warp. Values and participation are
derived from the existing introductory model and checked against the starter.

Design review uses [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md):
retain the technical-field-guide palette and Plex typography; keep the source
beside one stable map; use colour, boundaries, labels and directed arrows together.
No decorative transitions or additional player controls are needed.

Learning review uses [Instructional Design](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md):
connect source to a visible dependency, introduce terms at their first use, and
ask a new mapping-versus-calculation question. Captions and transcripts are the
same reviewed script. A successful example or media test does not establish
learner understanding.

Phone review found that long narration captions obscured the map. Short speech
cues and top-positioned WebVTT captions keep the diagram available during
playback. Native controls can still cover the bottom of the video while visible;
the caption placement does not depend on those controls hiding.

Production uses the same pinned [record-demo skill](https://github.com/snowch/claude-skills/blob/c9a7c521568632aa216932f4c965df386498602a/plugins/demo-video/skills/record-demo/SKILL.md)
and voice as the rest of the course. Automated speech checks and author visual
review are distinct from human listening approval or learner testing.

Functional and reading-order verification results are recorded on the merge PR.
