# Recording production

Copyright © 2026 Christopher Snow.

GPU Lab uses the same narration workflow as
[Common Ground](https://github.com/snowch/common-ground-social-psychology/blob/main/production/README.md):
the [record-demo skill](https://github.com/snowch/claude-skills/blob/c9a7c521568632aa216932f4c965df386498602a/plugins/demo-video/skills/record-demo/SKILL.md)
at commit `c9a7c521568632aa216932f4c965df386498602a`. Settings are Kokoro-82M
v1.0, `af_heart`, speed 1.0, ONNX CPU. The original skill verifies model and voice
files against pinned SHA-256 hashes. No speech service or GPU is used.

The complete production covers 42 existing videos and 612 narration cues,
including recordings retained for bookmarked course pages. Canonical lesson
scripts, examples, numerical diagrams and qualifications remain unchanged.
Speech forms clarify code identifiers and pronunciation separately from captions.

## Rebuild

Clone `snowch/claude-skills` separately and check out the pinned commit. Its
original `tts.py`, `phonemes.py`, `asr.py` and `speech_backend.py` stay in that
checkout; upstream implementation code and model weights are not bundled here.

With Node, `uv`, FFmpeg, Chromium and Poppler installed, run from the repository:

```sh
uv run scripts/recording-production.py --skill-dir /path/to/record-demo --stage prepare
uv run scripts/recording-production.py --skill-dir /path/to/record-demo --stage narrate
uv run scripts/recording-production.py --skill-dir /path/to/record-demo --stage refine
uv run scripts/recording-production.py --skill-dir /path/to/record-demo --stage phonemes
uv run scripts/recording-production.py --skill-dir /path/to/record-demo --stage screen
uv run scripts/recording-production.py --skill-dir /path/to/record-demo --stage build
```

The supplied skill path is its `plugins/demo-video/skills/record-demo` directory.
The plan, raw audio, original logs and screening checkpoints are in
`test-results/record-demo-all`. They are ignored authoring files. Normal course
builds use committed media and never download speech models or synthesise audio.

Use `--stage resume` for an interrupted, unchanged campaign instead of `narrate`.
It validates completed WAV files and invokes the original TTS script for missing
cues. Use a new full production after editing canonical scripts. `refine` updates
speech forms within the same voice configuration. Its pending journal prevents
unfinished refinements from being encoded. Whisper `small.en` checks every cue
in resumable batches; unchanged WAVs retain their completed screens.

## Exports and verification

Frames render directly at 3840 × 2160. A size gate rejects incorrect dimensions;
720p/1080p images are not stretched to 4K. Existing Plex typography, teal palette
and GPU diagrams are retained. Inside an SM uses its approved vector PDF.

Exports use H.264 at 30 fps, AAC at 160 kbps/48 kHz, a −16 LUFS target and a
−1.5 dB true-peak target. CRF 18 retains code and diagram detail; the FFmpeg preset
controls encoding cost; the default is `veryfast`. Colour conversion precedes
frame repetition so each still is converted once. Captions follow measured cue lengths with deliberate
inter-cue and scene pauses. Videos contain English soft subtitles and also ship
WebVTT for the browser. Existing URLs stay stable.

For these static decks, the exporter encodes a closed four-second group of
frames for each scene, then repeats those packets for the scene's measured
duration. This preserves 4K/30 fps while avoiding repeated encoding of identical
pixels. Scene boundaries use cumulative frame rounding, within half a frame of
their caption/audio times. The full decoder checks the resulting stream.

The exporters update posters, chapters, caption times, byte counts and existing
slide PDFs. Fresh exports produce silent 4K masters, narrated copies and timecoded shot lists in
`test-results/record-demo-all/out`. Completed exports are reused only when their
recipe, frames, speech and published file hashes still match.

After confirming a completed recording is pushed, remove its duplicate MP4s in
`out`, its `encoded-scenes` directory and its assembled `narration.wav` to reclaim
space. Keep the published assets, raw cue WAVs, native slides and checkpoint JSON
until the campaign is verified. A silent copy can be reconstructed from the
published MP4 by copying its video stream without audio.

Review phonemes for CUDA, API names, number formats and indexing notation. Retain
raw Whisper flags and review both flagged lines and representative passing
transcripts. Number formatting and acronym spellings can explain ASR differences;
they do not justify concealing substantive omissions or pronunciation errors.
Regenerate and re-screen corrections.

After reviewing every raw speech flag, save its cue ID and review in
`test-results/record-demo-all/speech-review.json`. Run the final artifact checks:

```sh
uv run scripts/check-recordings.py --stage decode
uv run scripts/check-recordings.py --stage report
npm run check
```

The decoder reads every video frame, checks streams and chapters, measures the
encoded audio and extracts a frame from each scene. The report requires complete
speech coverage, an explicit review of every raw flag and unchanged captions.
Each extracted frame is compared with its reviewed native source (SSIM > 0.99),
checking scene order and preservation after packet repetition and muxing.
It publishes hashes and measurements in `content/recording-production.json` and
the original speech-screen results in `docs/recording-speech-screen.json`.
That file also records speech-only forms separately from canonical captions;
unexpanded comparison operators block the final report.
The repository test rejects media changes that invalidate that evidence.

Inspect slide sequences and encoded frames. Verify native dimensions, full
decoding, captions, seeking and paused restoration at phone, tablet and desktop
sizes and in both themes. Test the updated bytes through offline download and
restart. Automated screening and media tests do not establish human listening
approval or learner understanding.
