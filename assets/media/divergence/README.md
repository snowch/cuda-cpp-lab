# Active lane masks and unused positions recap

Copyright © 2026 Christopher Snow.

Chapter 8 links to this eight-slide recap after its independent exercise. Uniform,
alternating and rare paths lead into five-input examples, where other-path lanes
and unused positions are distinguished explicitly. A new 17-input example asks
for masks and arithmetic operations before its answer. All masks, input signs,
outputs and counts come from `branchWarp`; its numerical semantics are unchanged.

Lane cells show input signs, with the floating-point magnitudes in the legend.
Green cells identify the selected mask, white cells have inputs on another path,
and dashed cells have no input. The chosen trace issues positive arithmetic first,
then each negative operation, skipping empty paths. Loads, stores, branch overhead,
compiler transformations, reconvergence and GPU timing are outside this model.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC audio, embedded English captions
and scene chapters; `captions.vtt`; eight-slide `slides.pdf`; and `poster.jpg`.
Source cues are `content/divergence-scenes.json`; measured duration, bytes, cue
times and voice provenance are in `content/divergence-media.json`. The common
native player provides captions, transcript, downloads and offline restoration.
Parent inputs, results and selected trace step are checked on return.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
