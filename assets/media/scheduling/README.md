# Ready and waiting warp recap

Copyright © 2026 Christopher Snow.

Chapter 7 links to this optional eight-slide recap after its independent transfer
exercise. Loads, thread registers and shared execution hardware lead into the
single-issue teaching scheduler. The slides follow one and two resident warps,
compare idle slots alongside changing instruction counts, and ask about a new
load latency before revealing readiness. Every timeline, card and count is derived
from `scheduleWarps`; scheduler semantics and chapter experiments are unchanged.

All warps are resident and ready initially. The round-robin search skips waiting
and completed warps. The fixed-latency model ends at final store issue, without
store-drain delay; it models neither resource limits nor bandwidth competition.
It does not compute tensor values or capture a compiler trace or GPU timing.

Assets: native 3840 × 2160 / 30 fps H.264 with AAC audio, embedded English captions
and scene chapters; `captions.vtt`; eight-slide `slides.pdf`; and `poster.jpg`.
Source cues are `content/scheduling-scenes.json`; measured duration, bytes, cue
times and voice provenance are in `content/scheduling-media.json`. The common
native player supports captions, transcript, downloads and offline restoration.
Parent inputs, results and the selected trace step survive the return journey.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
