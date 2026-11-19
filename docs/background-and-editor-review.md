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
