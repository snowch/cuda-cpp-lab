# Build output positions from prefix sums

Copyright © 2026 Christopher Snow.

Chapter 16's six-scene narrated recap follows selection flags through completed
old/new snapshots, partner distances and the inclusive-to-exclusive shift. A
four-flag prediction precedes its answer. All row values, source positions and
output counts come from `scan`; arrows identify the previous-snapshot operands.
Repeated prefix values are allowed. Only selected tokens use exclusive offsets
for writes, and the output length includes the final flag.

The one-block integer teaching algorithm uses separate stage arrays and collective
ordering. Distances are dependencies, not hardware cycles or PyTorch's kernel
trace. Multiple blocks require an additional ordered combination of block totals.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC narration, embedded English
captions and scene chapters, external captions, PDF slides and a poster. Source
cues are `content/scan-scenes.json`; measured times, bytes, duration and voice
provenance are in `content/scan-media.json`. Manual native playback, transcript,
downloads, parent experiment restoration and paused player restoration use the
shared book components.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
