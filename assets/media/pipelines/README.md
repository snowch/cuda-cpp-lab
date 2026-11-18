# Order copy, compute and buffer reuse before expecting overlap

Copyright © 2026 Christopher Snow.

Chapter 19's six-scene recap distinguishes ready from consumed handoffs, compares
serial and overlapping synthetic schedules on the same axis, and follows chunk 2
reusing slot 0. A changed-copy-duration question precedes its answer. Every
interval and total derives from `pipeline`; slot holding ends at consumer
completion, not copy completion. The opening PyTorch program has independent
allocations and is not claimed to implement this reusable-slot model.

One copy engine, one compute queue, two reusable slots and fixed equal-chunk
durations are explicit teaching assumptions. These are not GPU timings, profiler
traces or measured speedups. Queuing launches and event waits do not imply a CPU
wait, and a non-blocking option alone does not prove real overlap.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC narration, embedded English
captions and scene chapters, external captions, PDF slides and a poster. Source
cues are `content/pipelines-scenes.json`; measured cue times, bytes, duration and
voice provenance are in `content/pipelines-media.json`. The shared player supplies
manual playback, transcript, downloads and parent/player/map-return restoration.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
