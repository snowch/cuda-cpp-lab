# Matrix input reuse recording

Copyright © 2026 Christopher Snow.

Chapter 10 links to this optional recap after its transfer exercise. Ten slides
connect one output's dot product to shared input tiles, reuse across output rows
and columns, private partial sums retained between K phases, and complete input
load counts. A separate 8 × 8 question asks about one phase and the scope of sharing.

- `matmul.mp4`: native 3840 × 2160, 30 fps H.264/yuv420p, AAC 160 kbps/48 kHz,
  embedded English subtitles and scene chapters.
- `captions.vtt`: browser captions timed to individually synthesised sentence cues.
- `slides.pdf`: ten-slide deck; `poster.jpg`: opening slide at 1920 × 1080.
- `content/matmul-scenes.json`: titles and narration, also generating the transcript.
  `content/matmul-media.json`: measured size, duration, scene/cue times and voice provenance.

Values and counts come from `tiledMatmul` in `src/ai-models.mjs`. These diagrams
illustrate the chapter's teaching algorithm, excluding caches, physical memory
transaction counts, PyTorch implementation selection and measured GPU speed.
No model semantics change. Playback is manual; captions, transcript, downloads,
paused restoration and whole-course offline byte-range seeking are supported.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
