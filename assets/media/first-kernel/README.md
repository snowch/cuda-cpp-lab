# What is a CUDA kernel?

The Lesson 1 recording uses the course’s own `examples/first-kernel.cu`.
It walks through the definition, launch, GPU store and CPU readback.
The illustrations show the execution and data path conceptually.

Edit the narration and titles in `content/first-kernel-scenes.json` and the
visuals in `scripts/render-first-kernel-recording.mjs`. The course transcript
and recording captions use the same scene text.

The 17 November recording uses Common Ground's pinned
[record-demo skill](https://github.com/snowch/claude-skills/blob/c9a7c521568632aa216932f4c965df386498602a/plugins/demo-video/skills/record-demo/SKILL.md):
Kokoro v1.0 ONNX CPU, `af_heart`, speed 1.0. It has native 3840 × 2160 frames,
30 fps video, 48 kHz AAC audio, English soft subtitles and matching WebVTT cues.
Measured timing, byte count and speech provenance are in
`content/first-kernel-media.json`.

The current sample is part of the unfinished 42-recording rebuild. Prepare the
campaign with `scripts/recording-production.py` and the separately checked-out
skill, generate its cue WAVs, then export this sample with
`python scripts/build-recording.py first-kernel`. Normal course builds use the
committed recording and do not run speech synthesis.
