# Course lessons row and inline outline

CUDA C++ Lab uses the CUDA Python Lab’s expanded course-outline style. The closed
row reads `Course lessons ▾ / section / current lesson`. Opening Course lessons
reveals the overview link and all 27 lesson links, grouped under four section
headings. The expanded outline occupies the page width and pushes the lesson
introduction down in normal reading flow. It has no floating card, shadow or
nested section disclosures.

The current lesson uses a quiet accent background, stronger text and
`aria-current="page"`. Its Current lesson text remains available to assistive
technology without adding a second visible line to the link. Numbers retain the
actual course sequence. Four columns fit desktop widths; two fit tablets, and
one column gives long C++ lesson titles room on phones.

A distinct inline-outline marker isolates the component from popup dismissal
handlers that may remain in an older reading window. Native details preserves
the no-script outline. With JavaScript, the panel moves
after the complete breadcrumb row and follows the disclosure’s open state.
Outside clicks and tabbing into the lesson leave the inline outline open: closing
it during another interaction would shift the content under the learner’s pointer
or keyboard focus. Escape within navigation closes it, returns focus to Course
lessons and brings the trigger below the sticky header when needed. Selecting a
lesson or overview link closes it as navigation proceeds.

The entire navigation is marked transient and excluded from reading-state
snapshots. Opening it must not shift saved model/reference disclosures or replay
lesson actions. The existing course catalogue remains the single source for
section membership, titles, numbering and destinations.

Design and learning review uses frontend-design and instructional-design skill
guidance. Keep the existing Plex typeface, page/panel/ink/accent tokens, comfortable
tap targets and current-lesson cue. Match the Python outline’s grouped columns
and open spacing. Put course location beside the course control, keep every
section available without a second disclosure, and leave the essential lesson
explanation in the reading flow. No new GPU terms or learning tasks are introduced.

Verification reviews the header → course row → open/closed outline → lesson
heading, lead and first explanation at phone, tablet and desktop widths in both
themes. Browser checks cover all destinations, readable 1/2/4-column layouts,
non-overlap with the lesson, Escape and focus return, outside interaction, native
fallback and saved model state. Model/editor/media checks run separately. These
functional and design checks do not establish learner effectiveness.
