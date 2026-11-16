# What is a CUDA kernel?

The Lesson 1 recording uses the course’s own `examples/first-kernel.cu`.
It walks through the definition, launch, GPU store and CPU readback.
The illustrations show the execution and data path conceptually.

Edit the narration and titles in `content/first-kernel-scenes.json` and the
visuals in `scripts/render-first-kernel-recording.mjs`. The course transcript
and recording captions use the same scene text. Generate the cue WAVs for the
existing recorder at 24 kHz, one per scene sentence, in
`test-results/first-kernel-recording/audio`. This version used FFmpeg’s Flite
`slt` voice. Read “CUDA” as “Kooda” and “SM” as “ess em” in the spoken cues.
Use a cue name such as `s01-c1.wav` and record the voice in `durations.json`.
Run `python scripts/build-recording.py first-kernel` to render the deck and encode
the captioned MP4 and poster.
