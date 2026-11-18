# Count token destinations without losing updates

Copyright © 2026 Christopher Snow.

Chapter 15's six-scene narrated recap distinguishes token identity from category,
protects competing increments with atomic addition, merges per-block partials,
then asks about concentrated input before revealing its merge count. Figures use
`histogram` model results; the atomic-update close-up shows only the selected
input prefix. Two blocks of four use four integer bins. Counts and operation
totals are neither a hardware instruction schedule nor measured GPU performance.

Committed assets: native 3840 × 2160 / 30 fps H.264 with AAC narration, embedded
English captions and scene chapters, `captions.vtt`, `slides.pdf` and `poster.jpg`.
The scene/script source is `content/histograms-scenes.json`; measured cue times,
bytes, duration and voice provenance are in `content/histograms-media.json`.
The common player provides manual playback, a transcript and downloads. Parent
settings, result and selected step survive a return; paused playback also restores.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
