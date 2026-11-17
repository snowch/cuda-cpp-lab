# Input conversion and FP32 accumulation recap

Copyright © 2026 Christopher Snow.

Chapter 11 links to this optional eight-slide recap after its independent exercise.
It traces near-one input conversion before sequential FP32 accumulation, exposes
lost information through cancellation, compares very small FP16/BF16 inputs, and
asks about exactly representable inputs before showing their result. All displayed
inputs, partial sums, reference sums and counts come from `precisionMatmul`.
Its numerical rules and the parent experiments are unchanged.

Input conversion is nearest-even; each addition rounds to FP32 in K order. The
original-input reference uses the same order. Displayed values are rounded by the
course's shared value formatter. The 4,096 scalar multiply–accumulates describe
arithmetic work, not hardware instructions, tensor-core execution or elapsed time.
The common speech writer explicitly pronounces matrix A as the letter name.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC audio, embedded English captions
and scene chapters; `captions.vtt`; eight-slide `slides.pdf`; and `poster.jpg`.
Source cues are `content/tensor-cores-scenes.json`; measured duration, bytes, cue
times and voice provenance are in `content/tensor-cores-media.json`. The native
player supports captions, transcript, downloads, state-preserving return and offline
restoration. Return checks preserve the selected trace step and independent work.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
