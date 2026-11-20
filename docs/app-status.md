# App status and release lifecycle

Issue #22 replaces the GitHub branch-head indicator and automatic offline save
with one App status control on every generated course page. The public labels
match the contract in Assembly Lab #35, Metadata Systems #2 and Video Lab #6.
The installed app and a normal browser tab use the same lifecycle.

## Release contract

`release.json` is same-origin, app-relative metadata (`schema: 1`):

- `id`: a deterministic 64-character SHA-256 build identity. The build hashes
  every shipped course file and the worker implementation before substituting
  the identity into HTML. It changes even when assets change without a new commit.
- `commit`, `date`: the checked-out source commit and its UTC date, or `null`
  for archives and dirty development builds. HTML embeds the running build ID
  and retains a source link/date only for a clean Git revision.
- `files`: sorted `{path, bytes, sha256}` records for every required lesson,
  module, stylesheet, image, manifest and example download.
- `bytes`: the exact sum of file body bytes. This is decoded content size;
  compression, HTTP headers and browser storage bookkeeping differ.

`releases/<id>/release.json` describes that immutable snapshot; its files live
under the same directory. Root HTML and the cached HTML reference scripts,
styles and images under that release ID, including on an uncontrolled first
visit. Publish the whole built `dist/` atomically, as the Pages workflow does.
Do not rewrite immutable files in place. Retaining older immutable directories
on other hosting platforms allows repairs of older releases; Pages publishes
only the current snapshot. A missing old file can be recovered from the live
root only if its byte count and original hash still match. Changed bytes are
rejected; the learner can reload the lesson online to use the current release.

Checks use an eight-second deadline, a unique URL, `cache: no-store`, a no-cache
request header and strict metadata validation. GitHub Pages legitimately returns
positive `Age` values from its shared cache. Accept them only with an explicit
`max-age` of at most 600 seconds while `Age` is below that lifetime; reject expired,
unbounded or malformed cache responses. The panel explains that publication may
take up to ten minutes. Immutable running manifests need validation, not freshness.
The worker always forwards release metadata to the network. Aborted/late checks
cannot mark the app up to date. A check cancelled when the app is hidden preserves
the last verified status and retries on return. A failed check clears the offered
release, so Retry cannot appear alongside a stale deployment and Update button. Opening, focus, reconnect and visibility changes
check with a 15-second throttle; visible connected pages check once a minute.
Manual checks bypass the throttle and concurrent checks are deduplicated.
No version check prepares app assets. Static hosting cannot prove freshness
against a misconfigured intermediary that ignores cache directives and lies
about response age; the deployment must honour the network-only contract.

## Online visits and offline access

Normal top-level navigation and reload request the published page from the
network, bypassing the browser HTTP cache. Network failure, an eight-second
connection deadline or a server error falls back to the selected saved course.
A genuine HTTP 404 remains a 404, so a retired online page is not resurrected
from an old cache. An active lesson is never automatically reloaded.

Each document retains immutable script, style, media and source-download URLs. Embedded editors
carry a `gpu-release` query pin, preserving both the parent's version and the
editor's normal base URL. Ordinary online visits do not select another offline
copy or download unvisited lessons, recordings or compiler files.

Completed per-tab state is saved on ordinary navigation/reload and restored
when the route opens again. Editor version pins do not change snapshot keys.
Ordinary link navigation restores exercise values while honouring the requested
section and browser history position. Reloads and coordinated restarts also
restore their saved reading position and focus.
Back/forward cache preserves its existing live document; busy operations are
never replayed. When editor storage is constrained, automatic reading snapshots
defer to its existing durable/tab draft and Undo restore recovery copies rather
than overriding their selection. Explicit coordinated restarts retain their
stronger save guards.

App status distinguishes the current online page from a different saved offline
version. Update course prepares the complete offline copy. Reading current
content online requires no complete-course download.
When a newer published version is known, an older prepared copy is not offered
as a restart target in that page's panel. The complete current copy can be saved
instead. Metadata checks finish before a restart control is enabled.

## Downloads and activation

Worker installation fetches no course assets. Once a document has loaded, its
already-visited HTML and resource URLs are retained and verified as a small
visited-page cache. Later visits are cached on demand. It does not pin future
online visits to that version and does not download
unvisited lessons or claim that a partial copy is available offline. Initial retention can require a
repeat request when the browser has no reusable HTTP response. The single Update course action prepares the selected manifest, checks every file's length and SHA-256,
and reports verified bytes. Cancellation/failure retains valid partial files for
resume and leaves the previously selected complete release intact. The real
browser quota test verifies the same failure path under storage pressure.

Background cleanup and explicit cache mutations are coordinated: an operation
reserves its lock before waiting for in-progress pruning to finish. Cleanup cannot
delete a staging cache created during a download. Cancellation still reaches a
queued download. A deterministic worker test pauses cleanup and starts an update;
it reproduces the former race without relying on timing.

The worker stores a small selection record separately from per-release caches.
Concurrent completeness checks share one in-progress byte/hash verification per
release, so a status broadcast to many tabs does not reread every recording once
per tab. Results are discarded when the scan finishes, including on errors;
subsequent checks still verify current cache contents and detect eviction.
Preparing a newer release sets `pending`; only Restart to update changes `active`.
Closing all tabs, reopening the browser, visibility changes and ordinary refresh
never select a pending offline release. Online navigation can independently
read the published version. Later dismisses the dialog, not its badge.

Update course saves a complete offline copy, including recordings and the pinned
CUDA compiler assets. The same control handles the first save, resume, repair and
new versions. It selects the latest published release when a newer version is
known; otherwise it completes the running release. Metadata checks finish before
the control is enabled, and failed checks offer Retry instead of a stale update.
The package byte count includes the compiler; the first compile/run needs no
additional connection after a complete save. A prepared new version offers
Restart to update. A complete running copy shows the verified-ready status and
hides Update course. There is no separate Download button or second offline opt-in.
The worker's existing offline/update modes remain unchanged for pinned older clients.

Earlier updates could leave a complete cache without its saved flag. On loading,
the page checks whether every running-release file is already present, then asks
the existing worker to verify and retain that copy using the same save protocol.
Recognition retries after busy worker operations finish, including when online
metadata is unavailable. Its verification-only request cannot download missing
files or replace a selected or cancelled update. Older explicit first-save
requests keep their original behaviour. This works offline with an
already-installed worker. Partial visited-page caches do not pass the presence
check and never trigger a background book download.
Focus/reopen still rechecks completeness; eviction becomes Offline download
incomplete with a repair action.

Before committing, every supported open course window must acknowledge a
snapshot saved to its own session storage. Controls, visual selections, outputs,
trace positions, challenge state, expanded details, scroll position and routes
are restored. V2’s embedded CUDA editors also restore their source, console
results, diagnostics and generated PTX. An active compile/run blocks restart;
the parent lesson reloads its embedded editors once after activation. Composition, registered busy/unsaved guards, missing experiment
initialisation, inaccessible session storage and non-responsive windows block
the whole restart. Prepared participants lock their controls, unlock on abort,
and reload only after the selection record is committed. Navigation requests
wait during that transaction. Assets are pinned per document, so a delayed window
cannot accidentally load a different release's JavaScript. Snapshot failures on
restore retain a downloadable JSON recovery copy instead of discarding inputs.

Restart records a bounded set of participating navigation IDs before committing
the selection. Its reloads open the exact verified release even if the host has
published another version. The record and selection share a transaction token;
an aborted selection cannot make a ticket effective. Later ordinary navigation
is network-first again. This also works when the worker process restarts.

The stable worker protocol is separate from the app release. Future incompatible
protocol changes require a migration; do not use unconditional `skipWaiting`.
Caches are scoped to the exact registration base URL. Cleanup keeps the saved,
previous, pending, resumable, recently visited and currently open versions. It
waits for arriving windows to identify themselves and retains legacy copies.
Remove offline copy asks
for confirmation, unregisters this app only, and deletes its scoped caches. It
never clears localStorage, sessionStorage, learner work or sibling app caches.

## Existing installations

The previous worker's complete caches remain intact during migration. Its waiting
worker can still require all old tabs/windows to be closed once before the new
protocol controls the app. Reopen online to load the new App status interface.
Legacy caches count as prior offline consent, but are not asserted to match the
new running manifest. Update course verifies and completes the new release
explicitly; an update also preserves that existing offline intent. The regression
fixture is the actual worker from commit `4875086`, not a mock worker API.

## Validation and review

- `npm run check`: dependency-free Node model/build tests and production build.
- `python tests/online_navigation.py`: independently built releases, fresh online
  visits without full downloads, stable open editors, restored edits on reload,
  the unchanged saved offline copy, exact prepared restarts despite republishing,
  complete-copy recognition after busy startup, relative imports after verified
  live-file recovery, six status layouts/themes and activation of an installed
  former worker.
- `python tests/browser.py`: all existing lesson flows, phone/desktop themes,
  keyboard navigation, no-JavaScript content, plus deployed metadata comparison,
  unchanged running identity, failed/malformed/cached responses, real timeout,
  late-response rejection and dialog focus restoration.
- `python tests/offline.py`: two independently built releases with real Chromium
  workers. Explicit save, measured size, cancel/resume, every offline asset/page,
  real quota failure, failed replacement, Later, input composition, unsaved guard,
  denied snapshot storage, non-responsive tab, multi-tab route/input/result/trace
  restoration, eviction/repair, confirmed scoped removal, update-as-offline deferred refresh/reopen,
  recognition of older complete copies without network access, real V2 compiler
  execution and editor restoration across an offline update, persistent cold offline
  startup, no activation on closing windows, and legacy-worker migration.
- Screenshots: [before phone](app-status/before-mobile.png),
  [after phone](app-status/after-mobile.png),
  [before desktop](app-status/before-desktop.png),
  [after desktop](app-status/after-desktop.png). Before images use the previous
  main implementation; after images use the independently built test release,
  which correctly identifies itself as a development/archive build.

Tests use pinned Playwright 1.58 / Chromium 145, matching CI. Browser screenshots
are also uploaded by CI. No new CUDA code is introduced. Native installation UI,
Safari/iOS worker/storage behaviour and manual screen-reader output have not been
validated in this environment. The dialog uses native modal focus behaviour,
explicit labels, status regions and a labelled progress element; reduced-motion
and touch-sized layouts are exercised in Chromium.

The implementation received a local source/behaviour review, including cache
scope, late-check rejection, atomic selection, all-window guards, restore paths
and truthful labels. That is author review, not independent human review. The
pull request remains the place for the independent review requested by #22;
CI provides separate automated verification but is not described as human review.

### Recovery of a completed update selected by an older worker

The pinned page and installed worker may come from different releases. A worker
from `7ee4913` can report a verified completed download as active while an older
page still runs. The page recognises that finished request and re-prepares its
cached manifest as a pending update through the existing `PREPARE` protocol with
`save: false`. The saved copy retains its offline flag, and explicit Restart still
saves/guards all open windows. This repair does not activate a waiting worker,
reload the page automatically or request the published release again.

For a tab already pinned to an older client without this recovery, closing every
GPU Lab tab/app window and reopening permits the waiting worker to activate and
opens the downloaded copy. Keep the scoped caches and learner storage intact.
`tests/offline_background.py` reproduces the original loop with the actual
`ace5867` client and compiled `7ee4913` worker, checks that one-time recovery, and
checks the new client against that installed worker in six layouts/themes and
both native and foreground paths, including offline and two-tab guarded restarts.

Automatic recognition of a complete running cache reads worker status afresh.
The worker protects a different pending/resumable update from unlabelled
running-copy PREPARE requests, including older clients using a stale startup
snapshot. The deterministic worker test covers preservation of the paused
selection, request and verified files through subsequent cleanup. Recovery of
Restart requires a completed update associated with this build/current action
or the published manifest; it never treats an ordinary offline save or unrelated
older update as permission to restart the current page into that cache.
