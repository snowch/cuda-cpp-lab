# Background updates and lesson editor focus

Copyright © 2026 Christopher Snow.

The course assumes basic programming and array indexing. Downloading the course
is a tool task, not a new learning objective. A learner should be able to switch
apps without losing completed files or having an open lesson unexpectedly reload.
The source editor should identify the current experiment without asking the
learner to study its supplied setup first.

## Download behaviour

An explicit download or update records a persistent request. Completed files are
verified and cached individually. Supported browsers use Background Fetch, started
by the page; the worker receives and verifies the results even after the page
closes. Other browsers keep the foreground path and resume its recorded request
when the learner returns or reconnects. Merely visiting the course does not start
a full download. Cancel stops future automatic retries, including cancellation
through the browser's own background-download control.

The old course remains selected until the complete update is verified and the
learner chooses Restart to update. The existing restart transaction saves open
windows and blocks a restart if a window cannot save. Downloaded bytes and verified
bytes have distinct progress labels; errors stay beside the relevant download
control. A rejected response never makes the new version ready. Valid responses
are retained so repairing one rejected file does not fetch the large valid files
again. Failed writes of a cancellation record remove only that retry request,
leaving the course cache and learner work intact.

A new page can still be controlled by a previous worker until its last window
closes. The compatibility path records the same request in the existing metadata
cache, so the new worker can recover it when it activates naturally. It does not
force worker activation over an unprepared window. The migration fixture is the
actual compiled production worker from commit
`72c5e0e5d9b5737bd8bf58a209afe108e77cf76e`, not a version-only substitute.

Background Fetch is a progressive enhancement, not a promise that every Android
browser or OS state keeps the process running. The implementation follows
[MDN's API description](https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API)
and [Chrome's lifecycle guidance](https://developer.chrome.com/blog/background-fetch).
Testing page closure and worker termination in desktop Chromium is distinct from
physical Android testing, particularly force-stop and battery restrictions.

## Code and error checks

All 25 editable lessons identify their kernels, launches and experiment locations.
Two course lessons provide model or local-measurement activities without an inline
CUDA editor. Kernels and launches use blue text; editable experiment locations use
gold text on one uniform background. A decorative paint layer, hidden from assistive technology, follows
the native textarea's exact text, font metrics, size and scrolling. The textarea
retains native editing, selection, caret, export and accessibility. Forced colours
hide the paint layer and use normal system text. No draft is rewritten.

The cue follows source offsets after edits, including nested braces and comments,
rather than fixed line numbers. The finder buttons bring the requested source into
view without selecting it for replacement. Multiple edit locations remain coloured;
the finder starts at the experiment's primary location.

L1 removes the check() helper and tests CUDA status directly after allocation,
launch and copying. Its actual editor starter now comes from the same
`examples/first-kernel.cu` as the lesson. The small readback excerpt labels omitted
error checks explicitly. Changing 42.0f to 7.0f is a successful experiment; numerical
differences from the starter are not reported as execution failures. The recording's
kernel, launch and copy operations remain accurate and its media is unchanged.

Existing saved drafts remain in place. Editor tools → Restore starter loads the
new starter; Undo restore retains the previous draft through the existing recovery
mechanism.

## Design and learning review

[Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
guides the existing Plex typography, teal controls and code colours. One progress
area stays with its owning action, preserves control focus and distinguishes
transferring data from verification. No extra notification-permission workflow or
automatic restart is added. The native browser supplies its background-download UI.

[Instructional Design](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md)
guides the prepared-state and action wording. The helper's indirection is removed
from L1, the lesson names the status checks it supplies, and editor guidance names
the learner's editable location while keeping setup separate. Colour is reinforced
by named variables and keyboard finder buttons. Functional verification does not
establish learning effectiveness; no learner study is claimed.

## Verification record

`npm run check` passes all 204 unit checks and builds the production course. The
focused browser runs pass nine download lifecycle cases, all 25 editors at
390px/dark and 1440px/light, six additional touch/DPR cases, L1's detailed native
editing checks and both introductory starter/edit exercises. The built App status
dialog and L1 reading sequence were reviewed at 390px, 820px and 1440px in both
themes, including keyboard opening, closing and focus return. Download, update,
cancellation, verified completion and rejected-file states were also inspected.

The native suite also downloads the complete production course across page
closure, reopens it offline and verifies a saved CUDA edit. The older offline
suite explicitly exercises the unsupported-browser foreground fallback:
Playwright's minimal headless shell advertises Background Fetch but accepts jobs
without transferring bytes. Native checks use full Chromium. An immediate
download waits for shared startup retention, avoiding concurrent initialisation
and download operations.
The lesson retains its visited same-origin embedded documents and resources in
one operation, preventing a hidden editor frame from competing with the update.
Automatic resume and a button press share one in-flight request, including while
metadata is loading. A new request's storage error remains visible beside its
own action even when the last recorded job completed successfully.
Cancel hides transfer progress immediately and shows a stopping state while the
worker finishes its cancellation and cache-status check, rather than leaving a
large completed cache's verification looking like an active transfer.
The cancelled page request joins the Cancel handler's single status refresh;
it does not repeat full-course hash scans before releasing its control lock.
The complete-course browser case also checks that Update becomes usable after
cancelling a replacement while the large verified course remains available.

The focused lifecycle checks use the production builder, actual workers,
CacheStorage, network responses and native Chromium Background Fetch. They cover
page closure, worker termination, resuming verified files, explicit restart with
saved input, application/browser cancellation, rejected responses and upgrading a
previous production worker. Unit checks exercise cancellation races, storage failure
and damaged request metadata.

The editor review covers the preceding task, guidance/editor and following output.
It checks real glyph pixels, keyboard finding, horizontal scrolling, resizing,
selection, export, restore/undo, reload, snapshot restoration, compiler messages,
valid edited output and separately reported nonzero program exit. Phone, tablet,
desktop, both themes, forced colours and mobile/touch/DPR emulation are included.
Physical Android background execution is not claimed from these checks.

## Installation guidance

The header keeps App status and the theme control. Browser installation guidance
is a native disclosure labelled “Add GPU Lab to your apps” at the end of App
status. Its closed default keeps the download and update controls prominent;
opening it explains the browser menu choices and distinguishes an app icon from
the saved offline files. The old installation modal and its script are removed.
The app manifest, icons and browser-managed installation remain available.

The same design and instructional reviews favour one status dialog with optional
help over another header action and nested modal. The built header, preceding
offline controls and expanded guidance were checked at 390px, 820px and 1440px in
both themes, including keyboard expansion, Escape, focus return and overflow.
All six contexts, the manifest check, unit/build checks and the nine download
lifecycle cases pass. Saved lesson source and inputs are unchanged.

## Update completion and a quieter status dialog

A browser can lose its active-release metadata while a pinned lesson remains
open. The 72c5e0e client and worker reproduce a completed download followed by
“Update available” and no Restart: PREPARE treated an absent active cache as an
initial offline save, selected the candidate as active and left no pending update.
This reproduces the reported symptom; it does not establish the contents of the
reporter's browser storage.

The worker now uses the requesting page's running release to distinguish saving
that release from preparing another release. Native downloads retain this context
in the durable request. Both paths keep the candidate pending until verification
and explicit Restart, even if active metadata is missing. The real older client
protocol is exercised alongside the older compiled worker: the original defect
is reproduced, the normal older upgrade works, and the new worker fixes the
missing-state case without changing the open page or losing its saved draft.
An already verified candidate with the old incorrect active selection also
recovers Restart through the native planning path without another payload transfer.
Immediate cancellation before startup also keeps Update usable without starting
a transfer. The full offline cancellation case waits for the server's first
candidate request before asserting an incomplete download; visible startup
progress alone does not establish that any transfer has started.
Foreground downloads also announce the final verification phase separately from
transfer. No forced activation, automatic reload or storage clearing is added.

The frontend-design and instructional-design skills were applied proportionately.
This is a tool/usability gap, rather than a new GPU learning objective. Success
means a learner can identify whether the download is transferring, incomplete or
verified, and find its next action without reading build metadata. The design
keeps the existing type and fern/teal palette; the download or Restart action has
the existing primary-button treatment. Busy states show one progress group,
human-readable MB quantities and Cancel. Unrelated disabled controls, competing
offline actions and optional help disappear during transfer. Commit/build hashes,
raw byte sizes, included files and removal controls live in Version and download
details. Errors remain visible beside the action that failed. Keyboard focus
moves to a usable control when a state change hides the previous action.

The built lesson header → App status → optional installation guidance sequence
was reviewed at 390, 820 and 1440 pixels in both themes. The same six layouts
exercise idle, downloading, cancellation/incomplete and verified-ready states
against real downloads, including visible keyboard Cancel, Escape/focus return,
closed technical details and absence of horizontal overflow. Native and fallback
lifecycle checks, the actual older client/worker regression and a complete-course
offline download pass. The production build and all 204 unit checks pass. These
are functional and presentation checks, not evidence of learning effectiveness
or physical Android background execution.

## Page excerpts and editor colours

The current course has 27 lessons, with 48 starter CUDA excerpts across 25 inline
editors. The resource-budget and native-measurement activities have no CUDA editor.
The audit found three gaps in the former kernel/launch-only highlighting:

- First kernel: the CPU result variable, device-to-host copy and print call.
- CPU array to GPU result: GPU allocation and the input copy.
- Pipelines: the ready event and compute-stream dependency.

Starter code panels now declare `editorExcerpt: true`. The editor reads the
rendered excerpts from its owning lesson and locates their tokens in the current
source. Whitespace, indentation and numeric edits do not move the association to
an unrelated line. Comments and quoted fake calls do not act as anchors. Separate
statements can match an excerpt that omits intervening checks; wrapped CUDA calls
also remain identifiable in older saved drafts. Only the paint layer changes.

Existing kernels and launches remain blue; gold edit targets take precedence.
The three newly covered host-code regions use the same blue text on the same dark
editor surface. No source text, saved draft, native selection behaviour or editor
control is replaced. PyTorch, shell commands, optional teaching-model code and the
separate capstone reference solution remain distinct from starter excerpts.

The frontend-design and instructional-design reviews favour a direct visual
connection between the code being explained and its actual editable location.
This is a navigation/attention gap, not a new GPU learning objective. The existing
monospace type, colour meanings and finder controls stay consistent; guidance
explains the additional blue regions. Essential instructions stay beside the
editor, without introducing another disclosure or control.

All 207 unit checks and the production build pass. The excerpt audit resolves all
48 rendered starter excerpts to the canonical programs and checks omitted checks,
formatting/literal edits and misleading comments/strings. Browser checks verify
actual painted glyphs and every excerpt in all 25 editors at 390px/dark and
1440px/light, plus six touch/DPR cases. They also reject unmarked CUDA panels in
the main reading flow. The three changed lessons' excerpt → task → guidance →
editor → Console sequence was reviewed at 390, 820 and 1440 pixels in both themes.
Native editing, selection, scrolling, resizing, export, restore/undo and saved
source remain functional. These are functional/presentation checks, not evidence
of improved learning outcomes or tests on a physical Android device.
