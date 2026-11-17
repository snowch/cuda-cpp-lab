# CPU and GPU tensor storage recap

Copyright © 2026 Christopher Snow.

Chapter 2 links to this optional recap after its new-case exercise. Eight slides
open with a processor/memory overview, then follow CPU input storage, GPU copy,
GPU calculation and CPU result copy. The overview shares its labels with the
chapter opening in `src/device-architecture.mjs`: CPU and system RAM are peers;
the GPU device includes a compute chip and separate dedicated memory. They
distinguish zero inter-device transfer from GPU memory activity, then ask about
an eight-value result. All buffers, values and payload counts come from
`deviceJourney` in `src/foundations-model.mjs`. This chosen separate-memory example
does not predict timing, physical bus traffic or allocator behaviour.

The committed assets are native 3840 × 2160 / 30 fps H.264 video with AAC sound,
embedded English subtitles and scene chapters, `captions.vtt`, an eight-slide
`slides.pdf` and `poster.jpg`. Narration and transcript share
`content/devices-scenes.json`; measured times, size and voice provenance are in
`content/devices-media.json`. Native manual playback, captions, transcript,
downloads, parent-state return and paused offline restoration use the common player.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
