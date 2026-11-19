# Recording rebuild and verification

Copyright © 2026 Christopher Snow.

The 19 November 2026 rebuild covers all 21 current course recordings: 280
narration cues and approximately 38 minutes of video. Unused V1 recordings have
been removed. Current media URLs, learner drafts and CUDA examples are preserved.
The later recordings now explain execution resources, data ownership and
dependencies, with a new prediction before showing the answer.

The [shared production guide](../assets/media/README.md) documents Common Ground's
pinned record-demo workflow: Kokoro-82M v1.0, ONNX CPU, `af_heart`, speed 1.0,
using the original scripts at commit `c9a7c521568632aa216932f4c965df386498602a`.
Model/voice hashes and actual media hashes are retained in
[the production manifest](../content/recording-production.json).

Speech forms now explicitly pronounce comparisons, CUDA helper names and plural
identifiers. They are recorded separately from canonical captions in
[the speech review](recording-speech-screen.json). The original Whisper `small.en`
checker screened every cue. All raw flags are retained with explicit reviews;
retained flags include number formatting, acronym/word spelling and pacing
differences. Corrected speech was generated and screened again.

## Functional verification

- All 21 videos passed complete decoding, native 3840 × 2160/30 fps stream checks,
  English subtitle/chapter checks and source-image comparisons for every scene.
  Per-video scene comparisons and hashes are in the production manifest.
- Encoded speech measured approximately −16.7 to −16.4 LUFS. No encoded clipping
  was found. Encoder targets remain −16 LUFS and
  −1.5 dBTP; measured results are recorded separately.
- `npm run check` passed all 102 tests and built the static course. The compact
  duration catalogue is refreshed from measured metadata after exports.
- Local player checks covered every recording at 390 px and 1440 px in light
  mode, plus five representative recordings across phone/tablet/desktop and both
  themes: playback, caption, seeking, keyboard-disclosure and paused-restart
  checks. Native paused controls and captions are inspected separately for the
  introductory copy and multiplication pictures and landscape fullscreen.
  Restored frames must have current/future data before visual capture.
- All 21 starter programs and source edits passed in the browser compiler and
  simulator. Additional edits follow the recordings' distinct predictions.
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
