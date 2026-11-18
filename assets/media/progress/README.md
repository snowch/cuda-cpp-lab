# Distinguish resource waits, barriers and scheduling dependencies

Copyright © 2026 Christopher Snow.

Chapter 18's six-scene narrated recap follows model-derived exclusive fork
ownership and next-request wait edges. B can finish first in the chosen ordered
execution; the own-fork-first policy closes a three-way wait cycle. Four-thread
barrier participation is a separate agreement. A one-resident-block question
precedes the ordered producer/consumer launch explanation.

Ownership states come from `philosophers`; barrier states come from `barrier`.
The capacity picture illustrates the chapter's stated dependency, not a residency
simulator. No fairness proof, GPU schedule, guaranteed hardware hang or timing
result is claimed.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC narration, embedded English
captions and scene chapters, external captions, PDF slides and a poster. Source
cues are `content/progress-scenes.json`; measured cue times, bytes, duration and
voice provenance are in `content/progress-media.json`. The shared player supplies
manual playback, transcript, downloads and parent/player/map-return restoration.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
