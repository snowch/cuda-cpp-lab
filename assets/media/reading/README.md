# Tensor row and column selection recap

Copyright © 2026 Christopher Snow.

Chapter 4 links to this optional recap after its explanation exercise. Eight
slides connect zero-based coordinates and colons to five selected inputs, then
to their elementwise results. A new column-3 question checks interpretation
before its answer. Grid values, coordinates and outputs come from `readTensor`
in `src/foundations-model.mjs`. The diagrams describe logical selections; storage
offsets are left to Chapter 5, and no thread mapping or GPU timing is inferred.

Assets: native 3840 × 2160 / 30 fps H.264 video with AAC sound, embedded English
subtitles and scene chapters; browser `captions.vtt`; eight-slide `slides.pdf`;
and `poster.jpg`. Narration and transcript share `content/reading-scenes.json`.
Measured duration, bytes, cue times and voice provenance are in
`content/reading-media.json`. The page uses the common native player, captions,
transcript, downloads, saved-state return and offline update restoration.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
