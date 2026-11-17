# Tensor storage, stride and packed-copy recap

Copyright © 2026 Christopher Snow.

Chapter 5 links to this optional recap after its explanation exercise. Eight
slides distinguish values from element/byte offsets, follow row and column views
through row-major storage, compare a packed copy, and show an already-contiguous
row sharing storage at a non-zero offset. A column-3 copy question applies these
ideas before its answer. Values, offsets, strides, copy payloads and outputs come
from `readTensor` in `src/foundations-model.mjs`; no model semantics change.

The memory strip wraps after ten elements for display. Small labels count
elements from the start of the named storage; these are relative offsets, not
physical addresses. Original storage remains visible beside a new packed buffer.
Counts describe FP32 values copied and make no GPU timing claim.

Assets: native 3840 × 2160 / 30 fps H.264 video with AAC sound, embedded English
subtitles and scene chapters; `captions.vtt`; eight-slide `slides.pdf`; and
`poster.jpg`. Narration/transcript source is `content/layout-scenes.json`.
Measured bytes, duration, exact cue times and voice provenance are in
`content/layout-media.json`. The native player supports captions, transcript,
downloads, state-preserving return and paused offline restoration.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
