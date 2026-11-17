# Derive CUDA memory and launch sizes recap

Copyright © 2026 Christopher Snow.

Chapter 3 links to this optional dedicated recap after its application exercise.
The user approved the full talk track on 13 November 2026. Eight model-derived
slides reinforce the chapter’s reasoning, with a pause before a new-case answer.
The diagrams use launchPlan from src/hello-model.mjs and the chapter’s stated four-byte FP32 value representation. They distinguish element count, bytes per array, launch coverage, separate allocations, copies and cleanup. The nine-input exercise checks that all counts are derived together.
These diagrams illustrate the declared teaching example; they do not establish
PyTorch’s chosen implementation or physical GPU performance.

Assets: native 3840 × 2160 / 30 fps H.264 video with AAC sound, embedded English
subtitles and scene chapters; browser captions.vtt, eight-slide slides.pdf and
poster.jpg. Narration and transcript share content/launch-from-input-scenes.json.
Measured duration, bytes, cue times and voice provenance are recorded in
content/launch-from-input-media.json. The page uses the common native player, captions,
transcript, downloads, saved-state return and offline update restoration.

## Rebuild

Follow the shared [recording production workflow](../README.md) with the pinned
record-demo skill, Kokoro v1.0 ONNX CPU, `af_heart` and speed 1.0. It prepares
the source cues, checks phonemes and speech, and exports native 4K video, captions,
posters and measured metadata together. Existing speech-specific overrides in the
renderer are retained. Ordinary course builds use the committed media.
