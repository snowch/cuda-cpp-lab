# Place surviving token identities with exclusive offsets

Copyright © 2026 Christopher Snow.

Chapter 17's six-scene narrated recap distinguishes token identity from category,
constructs keep flags and exclusive destinations, follows token 5 into output slot
2, and compares forward/reverse inspection before a changed-selection prediction.
Every category, flag, offset, destination, partial output and completed identity
comes from `compaction`. A question mark denotes a genuinely unwritten model slot.
An empty selection uses no output slots while retaining eight input positions.

All flags/offsets are complete before scatter. Unique destinations preserve stable
survivor order independently of the two chosen write inspection sequences. These
are not GPU schedules, allocation measurements or performance results.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC narration, embedded English
captions and scene chapters, external captions, PDF slides and a poster. Source
cues are `content/compaction-scenes.json`; measured cue times, bytes, duration and
voice provenance are in `content/compaction-media.json`. The shared player supplies
manual playback, transcript, downloads and parent/player/map-return restoration.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
