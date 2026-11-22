# V2 breadcrumb course navigation

The breadcrumb now reads Course / part / current lesson. Course opens a native
navigation disclosure with the overview link and all 27 lessons grouped into the
four existing parts. The overview and breadcrumb renderer share one group catalogue.
The current part starts expanded and the current lesson has both aria-current and
an explicit Current lesson label, independent of colour.

With scripts, the panel overlays the reading area, fits the available viewport and
scrolls internally. Opening it brings a clipped current lesson into its own panel's
view. Escape closes it and returns focus to Course; an outside click or tabbing away
closes it without trapping focus. Navigation links retain their normal behaviour.
The static part breadcrumb still links directly to its overview section. Without
scripts, native details keep the full course navigation usable in normal page flow.
The standalone preview uses the same renderer and mounts the same enhancement when
its route changes, with document dismissal handlers registered only once.

Dedicated design/UX and instructional-design skills were unavailable, so the chapter
authoring checklist was applied directly. Review covers the preceding app header,
breadcrumb, open/current/expanded panel states and the following lesson introduction
in light and dark themes at phone, tablet and desktop widths. The panel uses existing
Plex type, shared colour variables, full lesson titles and comfortable tap targets.
It is a navigation disclosure, not an ARIA menu with special arrow-key behaviour.

Validation covers current groups and destinations throughout the 27-lesson catalogue,
keyboard opening and Escape focus return, outside dismissal, expansion, bounded panel
geometry, overview and cross-part navigation, native no-script fallback and six
viewport/theme combinations. V2's existing model, editor and media checks also run
alongside the footer/reference audits. Reference sources remain paired with their
questions once each, following the duplicate-source audit.


The enhanced panel is anchored below the entire breadcrumb, so a wrapped current
lesson remains visible above it on phones. Navigation disclosures are excluded
from positional reading-state snapshots: adding a course menu must not shift saved
lesson/model/reference disclosures from older releases. A restart check saves an
open menu alongside a model result and verifies that the menu reopens closed while
the model input and result are restored.

## Combined Course lessons row

The Python lab’s named course row is the reference for the C++ lab’s combined
`Course lessons ▾ / section / current lesson` row. The disclosure is the root
breadcrumb, so learners see one navigation row above the lesson heading. A quiet
full-width divider separates navigation from the lesson introduction. The section
link and current lesson wrap together within that row on narrow screens; the
dropdown remains anchored below the entire breadcrumb.

Design plan: retain the existing Plex typeface, shared background/panel/ink/accent
colours, 44px disclosure target and single divider. Avoid a second course bar or
new typography. Opening the existing grouped dropdown remains optional navigation;
the lesson’s question and essential explanation stay visible in normal reading
flow. The section link and Current lesson marker retain their meanings.

The frontend-design and instructional-design skill guidance was applied to this
focused navigation change: use the established visual language, keep a single
navigation entry point, make the disclosure’s purpose explicit in its label, and
keep the learner’s course location beside it. Functional checks cover existing
destinations, keyboard/outside dismissal, bounded panels, native fallback and
retained lesson state. They do not establish learning effectiveness.

Built-page review covered the header, combined row and the following lesson
heading, lead and explanation on the opening, next, scheduling and final practical
lessons at 390, 820 and 1440px in light and dark themes. The closed row and open
dropdown were inspected visually. The long section and lesson names wrap without
horizontal overflow; the open panel remains below the complete breadcrumb.
