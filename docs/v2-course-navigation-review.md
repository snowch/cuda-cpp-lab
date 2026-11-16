# V2 breadcrumb course navigation

The breadcrumb now reads Course / part / current lesson. Course opens a native
navigation disclosure with the overview link and all 21 lessons grouped into the
three existing parts. The overview and breadcrumb renderer share one group catalogue.
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

Validation covers current groups and destinations throughout the 21-lesson catalogue,
keyboard opening and Escape focus return, outside dismissal, expansion, bounded panel
geometry, overview and cross-part navigation, native no-script fallback and six
viewport/theme combinations. V2's existing model, editor and media checks also run
alongside the footer/reference audits. Reference sources remain paired with their
questions once each, following the duplicate-source audit.
