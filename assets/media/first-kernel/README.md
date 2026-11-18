# Follow the value through the GPU and back

The Lesson 1 recording uses the course’s own `examples/first-kernel.cu`.
It follows CPU launch, SM execution, GPU storage and CPU readback on an original
recurring architecture map. A new 13.0f prediction separates changed data from
unchanged launch dimensions. Placement and timing are conceptual.

Edit the narration and titles in `content/first-kernel-scenes.json` and the
shared visuals in `scripts/intro-recording-deck.mjs`. The course transcript
and recording captions use the same scene text.

The 18 November recording uses Common Ground's pinned
[record-demo skill](https://github.com/snowch/claude-skills/blob/c9a7c521568632aa216932f4c965df386498602a/plugins/demo-video/skills/record-demo/SKILL.md):
Kokoro v1.0 ONNX CPU, `af_heart`, speed 1.0. It has native 3840 × 2160 frames,
30 fps video, 48 kHz AAC audio, English soft subtitles and matching WebVTT cues.
Measured timing, byte count and speech provenance are in
`content/first-kernel-media.json`.

Follow the [shared production guide](../README.md) to prepare the campaign and
generate its cue WAVs with the separately checked-out skill. Export this recording
with `python scripts/build-recording.py first-kernel`. Normal course builds use
the committed recording and do not run speech synthesis.
