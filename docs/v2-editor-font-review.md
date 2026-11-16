# V2 first-kernel font emphasis

Copyright © 2026 Christopher Snow.

The first editor uses a uniform dark surface. The complete hello kernel and its
launch use blue text; the assignment uses warm gold text. Supporting allocation,
error checking and copying code stays in the normal source colour. The guidance
still names output[0] and the two reveal buttons work independently of colour.

The original textarea remains the editable and accessible source. A gradient is
clipped to its glyphs rather than painting line backgrounds. Source ranges follow
edits, nested braces and multiline launches; Firefox receives an explicit ink offset while Chromium scrolls its local text
paint natively, keeping colours on the same code in both engines. Source export, selection,
caret placement and saved drafts retain native behaviour. High-contrast mode uses
Canvas/CanvasText without custom colour emphasis. Browsers without text clipping
retain the normal readable source style.

Contrast against #0f211d: kernel/launch blue #8fcbff 9.68:1; assignment gold #ffe09a
13.05:1; supporting source #edf8f1 15.37:1. Font size, weight and spacing are unchanged.

No dedicated design/UX or instructional-design skill was available; the repository
chapter authoring checklist was applied directly. Reading-order review covers the
kernel and launch explanation → Try it → editor guidance, source and reveal buttons
→ Console → next hardware section. Existing labels provide the task's meaning
without a colour legend. Checked phone/tablet/desktop in both themes, edited/missing
source, keyboard reveal, native selection and horizontal/vertical scrolling, export,
reset and restart recovery. Review captures remain under ignored test-results/.
No learner study is claimed.

Chromium 156 and Firefox 146 were available for local inspection. WebKit downloaded
but could not launch because this host lacks its system libraries; Safari execution
is not claimed. CI uses the repository's pinned Playwright Chromium configuration.
