# Lesson 1 recording review

This branch contains a review copy requested before replacing the published lesson recording.

The learning objective is to explain three separate roles: an SM executes a thread,
GPU memory holds its output, and a device-to-host copy supplies the CPU variable
that `main()` prints. The question before the copy asks whether writing GPU memory
also changes that CPU variable. Its checkpoint explicitly assumes that the GPU write
and CPU initialisation have both finished; the diagrams do not claim execution timing.

Design decisions: use the existing Plex typefaces, teal and CUDA blue; reveal only
needed hardware; distinguish CPU memory from the processor; zoom into the transfer;
route printing through the CPU; reserve a caption band and space below it for player
controls. The MP4 has captions built into its picture, so reviewing it does not depend
on a player's subtitle settings. This is a fixed light-theme illustration, not a
replacement for the editable lesson.

The script introduces kernel, thread and SM locally. It names supplied setup and
asks no edits to read-only excerpts. The final tracing prompt refers to the learner's
existing experiment. The adjacent published lesson's 42.0-to-7.0 task supplies that
context; this recording does not repeat it with another constant.

Skills applied:

- [Common Ground record-demo](https://github.com/snowch/claude-skills/blob/c9a7c521568632aa216932f4c965df386498602a/plugins/demo-video/skills/record-demo/SKILL.md): original scripts, Kokoro v1.0 ONNX CPU, `af_heart`, speed 1.0.
- [Frontend design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): hierarchy, larger code and diagram labels, progressive detail and caption clearance.
- [Instructional design](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md): one objective, defined terms, explicit preparation and a pause before explanation.

## Reproduce

From the repository root, render and capture with a Python environment containing
Playwright and Pillow, plus system Chromium. Set `SKILL_DIR` to the pinned external
skill's `plugins/demo-video/skills/record-demo` directory.

```sh
node previews/l1-recording/render.mjs
python previews/l1-recording/capture.py
uv run "$SKILL_DIR/scripts/tts.py" test-results/l1-recording-review af_heart 1.0
uv run "$SKILL_DIR/scripts/phonemes.py" test-results/l1-recording-review --all
uv run "$SKILL_DIR/scripts/asr.py" test-results/l1-recording-review small.en
DEMO_FFMPEG_PRESET=ultrafast DEMO_FFMPEG_THREADS=4 uv run "$SKILL_DIR/scripts/deck.py" test-results/l1-recording-review l1-review 'GPU Lab: how the GPU result reaches Console'
```

The source deck and speech output stay in ignored `test-results/l1-recording-review`.
The 4K narrated MP4 copies the export's video/audio streams without the optional
soft-subtitle stream, since its captions are already in the picture. The smaller
review MP4 is a 1920×1080 encode of the same recording for convenient playback. The silent
4K picture master and timecoded shot list are produced by the same upstream build.

Functional and media verification is recorded in `verification.json`. Speech
screening and phoneme inspection do not establish human listening approval or
learning effectiveness. The review copy is for the user's evaluation.
