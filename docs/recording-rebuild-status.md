# Recording rebuild checkpoint

Copyright © 2026 Christopher Snow.

This branch checkpoints an unfinished rebuild, requested to use the same
record-demo skill as Common Ground. It is not ready to merge.

- The production plan covers all 42 existing videos and 612 narration cues.
- The pinned skill is `snowch/claude-skills` at
  `c9a7c521568632aa216932f4c965df386498602a`, using its original speech,
  phoneme and Whisper screening scripts from a separate checkout.
- Voice settings are Kokoro v1.0 ONNX CPU, `af_heart`, speed 1.0.
- The first-kernel sample has been regenerated as native 4K video with matching
  captions and speech provenance. The refreshed slide PDFs are also retained.
- The remaining videos have not yet been regenerated. The all-recording speech
  job was interrupted; generated WAVs and the plan remain local for resumption.
- Full speech screening, encoded-frame review, browser/offline checks and the
  final production manifest remain outstanding.

The production workspace is `test-results/record-demo-all`, with a `plan.json`
and two worker folders. Raw audio and model caches are ignored authoring files;
they are not included in this checkpoint. Ordinary builds continue using the
committed media.
