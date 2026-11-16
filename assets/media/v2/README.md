# V2 CUDA example recaps

Copyright © 2026 Christopher Snow.

These twenty original three-scene recordings cover lessons 2–21. They use each
lesson's actual starter excerpt, conceptual execution relationships and hardware
connection from `content/v2-lesson-context.mjs`. Lesson 1 retains its existing
recording. No supplied reference image was copied or incorporated.

Rebuild from the repository root with Chromium, Python Playwright and FFmpeg
(with libflite, libx264 and AAC) installed:

```
python scripts/build-v2-recordings.py
```

To rebuild selected lessons, append their URL slugs, for example:

```
python scripts/build-v2-recordings.py coalescing
```

The Node renderer generates original HTML slides with the course's bundled Plex
fonts. The Python builder checks frame bounds, captures slides, synthesises each
sentence using Flite's `slt` voice, measures its audio duration and uses those exact
cue intervals for WebVTT captions. The resulting MP4, JPEG poster and VTT files
are stored per lesson. Scene durations, file sizes and voice information are in
`content/v2-media.json`. Ordinary course builds use the committed assets.

The visible transcript and speech derive from the same lesson text. Spoken
notation expands CUDA, SM, FP16 and FP32 for pronunciation. These are synthetic
narrated concept recaps, not screen recordings of GPU execution or measurements.
Review covers slide layout, caption/audio intervals and browser playback; no
learner comprehension study or independent human pronunciation review is claimed.
