# Recording rebuild and verification

Copyright © 2026 Christopher Snow.

The 17–18 November 2026 rebuild covers all 42 existing recordings: 21 current
course clips and 21 recordings retained for bookmarked pages. They contain 612
narration cues and approximately 94 minutes of video. Existing URLs, canonical
captions and CUDA examples are preserved.

The [shared production guide](../assets/media/README.md) documents Common Ground's
pinned record-demo workflow: Kokoro-82M v1.0, ONNX CPU, `af_heart`, speed 1.0,
using the original scripts at commit `c9a7c521568632aa216932f4c965df386498602a`.
Model/voice hashes and actual media hashes are retained in
[the production manifest](../content/recording-production.json).

Speech forms now explicitly pronounce comparisons, CUDA helper names and plural
identifiers. They are recorded separately from the unchanged captions in
[the speech review](recording-speech-screen.json). The original Whisper `small.en`
checker screened every cue. All 152 raw flags are retained with explicit reviews;
retained flags include number formatting, acronym/word spelling and pacing
differences. Corrected speech was generated and screened again.

## Functional verification

- All 42 videos passed complete decoding, native 3840 × 2160/30 fps stream checks,
  English subtitle/chapter checks and source-image comparisons for every scene.
  The minimum measured scene SSIM was 0.996504.
- Encoded speech measured −16.94 to −16.45 LUFS, with a maximum true peak of
  −0.98 dBTP. No encoded clipping was found. Encoder targets remain −16 LUFS and
  −1.5 dBTP; measured results are recorded separately.
- `npm run check` passed all 194 tests and built the static course. The compact
  duration catalogue is refreshed from measured metadata after exports.
- Local player checks covered every recording at 390 px and 1440 px in light
  mode, plus eight representative recordings across phone/tablet/desktop and both
  themes: 116 playback, caption, seeking, keyboard-disclosure and paused-restart
  cases. The corrected compaction clip was checked again in all six combinations.
  Restored frames must have current/future data before visual capture.
- The [required CI workflow](../.github/workflows/deploy.yml) runs the complete
  offline/update suite, course browser checks, practical compiler checks and CPU
  reference examples on the final PR head before merge. Its outcome is recorded
  on the merge PR.

## Design and learning review

Applied the [Frontend Design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
and [Instructional Design skill](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md),
alongside the pinned recording skill. Reviewed all slide sequences and the player
in its surrounding lesson context. Retained the course's Plex typography, teal
palette, logical diagrams and recurring hardware map. Code, data paths and
hardware locations retain their distinct roles and model qualifications.
Captions and the optional transcript support the same explanation; speech-only
clarifications make code notation explicit without changing the examples.

These checks establish functional/media consistency. Review limits remain:
automated speech screening and author visual review, without human listening
approval or evidence from a learner study.

Confirmed pushed intermediate copies are removed to reclaim authoring space.
Source files and published media remain in the repository; raw inputs and
checkpoints are kept while verification and CI are in progress.
