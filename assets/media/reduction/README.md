# Shared memory and barriers recording

Copyright © 2026 Christopher Snow.

Chapter 9 links to this optional recap after its transfer exercise. The recording
follows four inputs through shared-memory writes, the initial block barrier,
partner-distance-2 additions, another barrier and the final addition. A separate
diagnostic shows an unwritten partner read and assigns no numeric result. An
eight-thread question checks barrier participation and write-before-read ordering.

- `reduction.mp4`: native 3840 × 2160, 30 fps H.264/yuv420p, AAC 160 kbps/48 kHz,
  embedded English subtitles and scene chapters.
- `captions.vtt`: native browser captions, timed to individually synthesised
  sentence cues rather than estimated from word counts.
- `slides.pdf`: the eleven-slide deck; `poster.jpg`: opening slide at 1920 × 1080.
- `content/reduction-scenes.json`: titles and narration; also generates the page
  transcript. `content/reduction-media.json`: measured file size, duration, scene
  and cue times, and speech-model provenance.

These are conceptual diagrams of the chapter's chosen algorithm, not a captured
PyTorch implementation, a compiler trace or GPU timing evidence. Values, shared
snapshots and contribution sets come from `reduceBlock` in `src/ai-models.mjs`.
No simulator semantics were changed for the recording. The video uses manual
playback, captions, a transcript, downloads and paused playback restoration. The
whole-course offline download includes all media and supports byte-range seeking.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
