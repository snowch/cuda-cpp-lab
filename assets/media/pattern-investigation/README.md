# Combine counts, bin starts and ranks for stable token grouping

Copyright © 2026 Christopher Snow.

Chapter 20's six-scene final recap distinguishes counts-only from stable grouping,
constructs disjoint category regions, follows token 5's bin start plus rank into
output slot 2, and checks identities/order. A concentrated-input question comes
before its answer, including empty-bin starts at the output end and the need for
stability beyond unique atomic arrival slots. Every count, offset, rank, partial
identity and completed output comes from `routing`.

The opening program uses PyTorch stable sorting; the browser studies a separate
count/scan/rank/scatter construction. Eight local tokens, four categories, no
dropping, transfers between devices or expert capacity limit are explicit. No
GPU timing, physical traffic, measured speedup or fastest implementation is claimed.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC narration, embedded English
captions and scene chapters, external captions, PDF slides and a poster. Source
cues are `content/pattern-investigation-scenes.json`; measured cue times, bytes, duration and
voice provenance are in `content/pattern-investigation-media.json`. The shared player supplies
manual playback, transcript, downloads and parent/player/map-return restoration.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
