# Five-thread memory-sector recap

Copyright © 2026 Christopher Snow.

Chapter 6 links to this optional eight-slide recap after its explanation and
memory-explorer sections. It groups five FP32 input reads into aligned 32-byte
sectors, compares a row, column and packed copy, and demonstrates a row crossing
a sector boundary. A different row is left as a question before its answer.
All values, relative offsets, sector groups and counts come from `readTensor`
and `simulateLoad`; neither numerical model is changed.

The chosen mapping uses five participating lanes in one 32-position warp. Every
allocation begins on a sector boundary. The accounting covers one input load,
excluding packed-copy construction and output stores. Covered bytes are not
physical DRAM traffic, cache misses or a timing prediction.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC audio, embedded English captions
and scene chapters; `captions.vtt`; eight-slide `slides.pdf`; and `poster.jpg`.
Source cues are `content/requests-scenes.json`. Measured duration, bytes, cue times
and voice provenance are in `content/requests-media.json`. The common native player
provides captions, a transcript, downloads, saved-state return and offline playback.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
