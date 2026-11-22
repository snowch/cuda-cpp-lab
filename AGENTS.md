# Working on CUDA C++ Lab

Copyright © 2026 Christopher Snow.

Use the [shared course design guide](https://github.com/snowch/cuda-python-lab/blob/main/docs/course-design-guide.md) for common layout and interaction decisions.

Use the [chapter authoring checklist](docs/authoring-checklist.md) for every new or revised chapter.
Complete its required reading-order review for every learner-facing edit, including
small copy changes: review the preceding, changed and following sections in the built
page before marking the change complete. Passing automated checks does not replace
that review.

Apply the checklist's **Clear wording and uncluttered UI** review to headings,
instructions, labels, examples and feedback. Verify requested edits and comparisons
through the actual controls, distinguish execution from example/prediction checks,
and preserve saved learner work.

For every new or edited learner-facing page, exercise, diagram or recording,
use both a relevant design/UX skill and a learning/instructional-design skill when
available. Complete the checklist’s [design and learning review](docs/authoring-checklist.md#design-and-learning-review)
before merging, with depth proportional to the change, and record the skills and
findings in the PR. If either skill is unavailable, say so and perform the equivalent
checklist review; never claim a skill was used when it was not.

Read `docs/plan.md`, `docs/model.md` and `docs/sources.md` before extending the course.

- Keep AI workloads as the motivation and introduce hardware terms at first use.
- Generate figures and prediction answers from model results; no scripted performance claims.
- Separate CUDA programming semantics, the teaching machine and real hardware measurements.
- State assumptions beside the experiment. Do not present sector counts as DRAM reads or time.
- Keep planned modules clearly marked until their lessons and experiments work.
- Follow [shared chapter styling](docs/chapter-styling.md); reuse the common opening-code and browser-guidance components.
- Use clear British English, accessible labels and keyboard controls. Preserve mobile layouts.
- Keep the first build dependency-free unless a feature justifies adding a dependency.
- Use relative asset paths; the production site is hosted beneath `/cuda-cpp-lab/`.
- Run `npm run check` and `python tests/browser.py` for simulator or interface changes.
- Validate new CUDA examples on a named toolkit/GPU when available; record untested status otherwise.
- Regenerate recordings with Common Ground's pinned `record-demo` workflow:
  Kokoro v1.0 ONNX CPU, `af_heart`, speed 1.0. Follow `assets/media/README.md`;
  do not substitute Flite or another voice when authoring tools are unavailable.
- Main is the authorised branch for the initial implementation; never force-push over remote work.
