# Recording rebuild checkpoint

Copyright © 2026 Christopher Snow.

This is a recovery checkpoint of the ongoing 42-recording rebuild. It is not ready
to merge. All 612 narration cues have been generated and pronunciation forms
checked with Common Ground's pinned record-demo workflow: Kokoro v1.0 ONNX CPU,
`af_heart`, speed 1.0, skill commit `c9a7c521568632aa216932f4c965df386498602a`.

All 42 native 4K slide sets have been captured and visually reviewed. Exports and
Whisper screening are still running. The first revised export passed full decode,
stream, loudness and per-scene source-image checks. Remaining artifact checks,
complete speech-flag review, browser/offline verification and the final production
manifest remain outstanding.

See [the production guide](../assets/media/README.md). The resumable plan, raw WAVs,
original logs and export/QA checkpoints are ignored authoring files under
`test-results/record-demo-all`. Original skill scripts remain in a separate checkout;
model weights and upstream implementation are not bundled with the site.
