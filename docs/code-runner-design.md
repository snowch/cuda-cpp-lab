# Reusable browser code runner for static labs

This design keeps CUDA C++ Lab’s compiler warm between lessons while allowing the
learner to release its memory. It is a reference implementation for other labs,
not a shared package. It complements the [offline/update design](offline-update-design.md):
saved course files and a running WebAssembly toolchain have different lifetimes.

## Learner contract

- **Compile and run** starts the runner automatically. A separate startup step is
  unnecessary. **Start code runner** can prepare it without executing the program.
- The header shows **Stopped**, **Starting**, **Compiling**, **Running** or **Ready**.
  **Ready** means the execution tools are resident in this reading window; it does
  not establish that the whole course has been saved offline.
- **Stop run** cancels the active operation. **Stop startup** cancels a manual
  preparation before any program is executed. **Free memory** terminates the idle
  worker. Both keep editor text and previous results. Neither deletes downloaded
  files, drafts or manual completion marks.
- Thirty minutes without a run releases the worker by default. **Keep ready
  between runs** offers 5, 15, 30 or 60 minutes. The choice is saved in this
  browser for this course and synchronised across its tabs. The idle interval
  starts after an operation finishes. Changing the choice counts from that same
  completion, so shortening an already-expired interval releases an idle worker
  immediately. If storage is unavailable, explain that the choice applies only
  to this tab. A running compile/simulation is never cancelled by the
  idle policy; the separate execution deadline still applies.
- The first startup opens a compact introductory modal immediately, whether
  requested through **Start code runner** in the header or automatically through
  **Compile and run**. Both entry points share the same acknowledgement. Dim the
  page and keep the lesson inert until **Back to lesson**, **Runner settings** or
  Escape. Startup and any requested compile/run continue behind the dialog;
  acknowledgement is not a second confirmation to start work. Do not wait for a
  result, auto-expire the introduction, or dismiss it on a backdrop click.
- Explain device CPU/memory use, reuse and the selected idle interval. Manual
  preparation starts tools without executing the editor's program. Show distinct
  preparation and ready guidance, not a request to inspect a result that does not
  exist. **Ready** permits **Compile and run**; that later operation must not show
  another introduction. The same applies to a Run queued during preparation.
- Returning to the lesson restores editor focus for automatic startup, or header
  focus when startup came from its controls. **Runner settings** opens the usual
  nonmodal controls. Remember acknowledgement per browser/course only after an
  explicit dismissal and recheck it on first activation in an already-open tab.
  Keep a separate per-document presentation flag so progress cannot reopen the
  dialog. An unread introduction can reappear on the next startup after reload.
  Keep existing acknowledgements, timeout choices and all saved learner work.
- Each run receives fresh simulated program state. Compiler reuse must never
  carry simulated allocations, streams, events, output or errors into another run.

The browser can suspend timers or discard a tab. The idle deadline is best effort,
checked again on focus and visibility changes. A browser cannot promise that a
runtime will survive backgrounding or release physical RAM at an exact second.
When a worker ends, its WASM heaps become reclaimable; the browser controls actual
memory reclamation. The next run starts the tools again.

## Findings from the first-run introduction

The initial implementation used a persistent corner notice after the first
completed run. A learner reported on Android that it took too long to appear
and was easy to miss. Their screenshot showed the notice overlapping the lower
Console area without dimming the lesson. This is direct usability feedback from
one learner, not evidence of a general learning-effectiveness improvement.

Two decisions caused the mismatch: completion was the wrong trigger for an
introduction, and a corner notification did not give it enough prominence.
Removing an expiry timer made the notice persistent but did not fix either issue.

Use a **one-time modal introduction** at the first accepted startup request. A real
native modal supplies a dimmed backdrop and makes the background inert; a grey
overlay alone would leave misleading keyboard and pointer interactions possible.
Focus the heading initially so a short screen starts at the explanation, then
keep Tab/Shift+Tab within the two actions. **Back to lesson** returns focus to the
editor for automatic startup, or the header for a start from its controls; **Runner settings** opens the usual nonmodal controls. Escape acknowledges
and closes the introduction. Clicking the backdrop does not acknowledge it.

The modal explains an operation already requested by the learner. It must not
hold the compile until a second confirmation. Let startup/compilation/simulation
continue, keep the introduction open after completion, and direct the learner
back to the result or execution message when a program was requested. When only
preparation was requested, explain that no program is being executed and direct
the learner to **Compile and run** after the tools become ready.

A follow-up report exposed another timing error: the learner chose **Start code
runner**, waited for **Ready**, then chose **Compile and run** and received the
introduction. The earlier rule deliberately kept manual preparation quiet, so it
introduced tools only after the learner had already prepared them. This is the
wrong lifecycle boundary. Introduce the first startup through either entry point,
and do not introduce the later use of an already-ready runner.

Preparation and program execution need separate feedback. Preparation must leave
Console, completed-run count and last-run duration unchanged. Its ready message
is **Ready to compile and run your code**, not **Ready for another run**. The
introduction describes preparation while it is happening and explains the next
editor action when preparation finishes. A program run instead points back to its
result or execution message. Existing acknowledgement remains valid: this timing
fix must not reset the preference and show every learner the introduction again.

Store acknowledgement only after an explicit return, settings choice or Escape,
not merely after displaying the dialog. Keep a per-document presentation flag
so progress events cannot reopen it. An unread introduction can appear again on
the next startup after reload. The former corner-notice preference remains untouched;
its presence does not prove that the learner acknowledged the new introduction.
Never reset source, results, completion marks or timeout preferences to deliver it.
Before presenting in an already-open tab, recheck browser storage for another tab’s
acknowledgement. Do not automatically close an introduction already being read in
this tab when another tab acknowledges it.

Verify timing by holding a real compiler request: the introduction must already
be modal before any result exists. Check the backdrop, inert background, keyboard
cycle, explicit dismissal, no expiry, execution continuing behind the modal,
short-screen scrolling, both themes, acknowledgement across reload and an unread
reload retaining an edited source. Exercise **Start → Ready → Compile and run**
and **Start → dismiss while preparing → queue Compile and run** as separate
journeys, with one introduction and one worker in each. Check acknowledgement in
a tab opened before the other tab dismissed the introduction. A queued-start test
alone does not cover the completed-preparation journey. Verify header controls separately: they
remain nonmodal and should not interrupt every experiment. These functional checks
establish behaviour; they do not establish that learners understood the message.

## Controls and resource measurements

The header opens a compact **nonmodal** popover for repeated resource management
after the one-time introduction. Close and Escape return focus to the invoking control; clicking
outside dismisses it without moving focus from the newly selected content.
Keep controls keyboard accessible, at least 44 CSS pixels high, scrollable on
short screens and usable in both themes. An explicit Close/Escape/outside-click
fallback covers browsers without native popovers. A lesson change closes the
controls. The saved timeout choice never interrupts a running operation.

**WASM memory allocated** reports the most recent sample of allocated WebAssembly
linear memory, in MiB. Capture actual memory objects from imports/exports as each
compiler, simulator and host-program instance is created; deduplicate identical
objects. Inspect only memory descriptors: enumerating dynamic-linker import
proxies can alter symbol resolution. Retained compiler heaps remain counted after a run; discard references
to per-run heaps on every terminal path. Report zero after terminating the worker.
This is not total browser RAM, physical resident memory or a claim that the browser
has already reclaimed memory. JavaScript objects, compiled code and other tabs
are excluded. Samples are event-driven, not a continuous memory monitor. Display
**Unavailable** if the allocation cannot be determined, rather than inventing a
number. Instrumentation must not change compiler heap sizes or program semantics.

**Last compile and run** is wall-clock elapsed time from the accepted Run request
to its completed response. It includes initialisation, time waiting for manual
startup, compilation and simulation. It is neither CPU utilisation nor physical
GPU timing. Failed compilation, cancellation and manual preparation do not replace
the last successful duration. Stopping preserves that duration in the current
reading window. A fresh document starts without a completed duration.

Do not display a CPU percentage: there is no portable browser API for accurate
per-runner utilisation. No diagnostic counter should distract from the lesson's
actual output or imply GPU hardware performance.

## Why a persistent reading document

A dedicated worker belongs to its document. Normal full-page navigation destroys
that worker. Cached compiler files avoid a network transfer but do not preserve
an instantiated compiler or its heap. A service worker may be terminated by the
browser and must not host long-running compilation. SharedWorker lifetime/support
must not be the sole guarantee for a mobile reading session.

CUDA C++ Lab therefore enhances ordinary links with same-document navigation while
the runner is resident. The top-level document, header, App status and worker stay
alive; the next lesson replaces `main`, remounts its controllers and creates its
normal release-pinned editor iframe. Static HTML, ordinary links and no-script
reading remain available. Reload, a new tab, unsupported navigation or a different
release uses a complete page load and a cold runner. A memory release also permits
subsequent links to take the ordinary page-load path.

A mature lab should change lessons infrequently. Most navigation then reuses one
release and one resident toolchain. During active development, crossing releases
will cause more cold starts. Do not hide new online content to improve a benchmark,
or retain incompatible execution assets across releases.

```mermaid
flowchart TD
    Window[Persistent reading window] --> Header[Code runner controls]
    Window --> Lesson[Replaceable lesson main]
    Lesson --> Editor[Release-pinned editor iframe]
    Editor -->|Source and run configuration| Runner[One worker owner per window]
    Runner --> Compiler[Resident Clang and optional NVPTX compiler]
    Runner --> Modules[Compiled simulator modules]
    Modules --> State[Fresh simulator and host program state per run]
    Header -->|Cancel or release| Runner
    Timer[Idle deadline] -->|Release only when idle| Runner
```

This is one owner per reading window, not a global singleton across tabs, browser
profiles or labs. Different tabs can run independent experiments without stealing
one another’s jobs. Multiple tabs that run code can each consume memory.

## Lifecycle and message ownership

| State | What is resident or executing | Available action |
| --- | --- | --- |
| Stopped | No runtime worker; lightweight configuration may remain | Compile and run, or Start code runner once an editor has supplied its configuration |
| Starting | Verified execution assets are loading/initialising | Stop run, or Stop startup for manual preparation |
| Compiling | Current editor text is being compiled | Stop run |
| Running | Compiled host code and GPU simulation are executing | Stop run |
| Ready | Compiler/module caches remain, no active job | Compile and run, or Free memory |

One active job owns its reply callback. A compile requested during manual startup
waits for preparation and runs automatically; stop/detach cancels both preparation
and the pending compile. Startup errors also reach the waiting editor. Reject other
competing submissions without replacing the active job. Detaching a finished editor must not terminate the shared
worker. Detaching an editor with an active job cancels that job. Explicit stop,
startup/runtime errors and timeout terminate the worker and clear timers. Late
messages from a terminated worker are ignored by worker identity. Compilation
errors retain the usable compiler; the editor distinguishes compiler failures,
program-written checks and ordinary changed results.

The embedded client waits for the matching parent owner rather than starting an
accidental second runtime during a slow page load. Only a same-origin editor with
the same release ID attaches. A standalone workbench owns its own runner. Source
editing remains read-only until starter/draft restoration hooks finish loading.

Opening lessons and later architecture lessons use different simulator adapters.
Cache their compiled WASM modules separately and load a later adapter only when
needed. Both reuse Clang. Restore the appropriate CUDA header shim before each
compilation, including when returning to an opening lesson. Create a fresh
simulator instance and host program instance for every run.

## Navigation, saved work and updates

Save the outgoing parent and editor state before requesting a replacement and
again immediately before committing it. The second check covers edits or a run
started while HTML is arriving. Respect composition, storage, completion-mark and
restart guards. A failed guard keeps the current lesson intact. Read-only editors
that have not initialised cannot contain new edits and need not block navigation.

Abort an in-flight lesson request when the document leaves or reloads, and reject
its stale continuation. It must not later replace content in a resumed document.

Initial static visits leave browser history untouched. Mark entries only when
enhanced navigation is used. Preserve native fragment scrolling; track clicked
fragment entries without reloading the lesson. Unknown history uses the native
fallback rather than guessing which lesson a history entry represents.

History changes the URL before `popstate` runs. Keep the outgoing reading route
explicitly so its snapshot cannot be stored under the destination’s key. Remount
model, recording and completion controllers once; pause outgoing media; clear stale experiment hooks;
restore results without rerunning code. Keep Back/Forward scroll positions and
move keyboard focus to the new heading. Guarded history transitions return to the
outgoing history entry. Rebase main-content links against the requested normal
lesson URL, and keep shared chrome URLs absolute when moving between `/` and `/v2/`.

Same-document navigation is still an **online navigation**, not an immutable
same-release asset fetch. It must request current published HTML, preserve genuine
404s, and fall back to verified saved HTML offline. The worker implements the same
routing/verification rules for GET requests marked `X-Lab-Navigation: 1`, and echoes
that header on its response. If a controlling older worker does not acknowledge
this contract, the client uses ordinary full-page navigation. Never let an old
worker’s cached page silently masquerade as the latest online lesson.

The response must contain the expected course shell marker, main region and the
same release ID before its main can be adopted. Different releases require a full
page load, preserving drafts through the existing state protocol. Metadata checks
do not automatically replace an open lesson or instantiate a toolchain. Explicit
**Restart to update** still guards every participant and reloads the complete
window; it must wait for or explicitly stop active compilation/simulation.

All runner modules/styles and both execution adapters are included in the complete
release manifest. A successful saved course can start a cold runner offline. RAM
being warm is an optimisation, never a condition for offline readiness.

## Implementation map

| File | Responsibility |
| --- | --- |
| [src/code-runner.mjs](../src/code-runner.mjs) | Worker ownership, serial jobs, cancellation, deadlines and idle release |
| [src/code-runner-host.mjs](../src/code-runner-host.mjs) | Parent owner, header popover/first-run modal, saved preferences, restart guard and visibility checks |
| [src/code-runner-client.mjs](../src/code-runner-client.mjs) | Same-release editor attachment and worker facade |
| [src/course-session.mjs](../src/course-session.mjs) | Same-release navigation, URL handling, state guards, remounting and history |
| [src/experiment-state.mjs](../src/experiment-state.mjs) | Existing snapshots plus explicit reading-route context for remounts |
| [content/v2-warm-toolchain.mjs](../content/v2-warm-toolchain.mjs) | Build-time extension of the vendored worker’s compiler/adapter cache and allocation samples |
| [src/code-runner-settings.mjs](../src/code-runner-settings.mjs) | Idle choices, preference keys and measurement formatting |
| [src/code-runner.css](../src/code-runner.css) | Compact header status and accessible controls using the existing palette/type |

Keep worker transformation assertions and real basic → advanced → basic execution
checks when updating the vendored toolchain. The cache is an internal optimisation;
never rewrite a learner’s source to obtain a cached result.

## Verification and adaptation

Before porting, inventory controller mount/dispose hooks, editor ownership, run
messages, version pins, snapshot keys, routing and restart guards. A lab without
safe remounting should retain ordinary navigation until those contracts exist.
Do not copy this router into an application with different link or state semantics.

Verify these journeys using real workers and real code:

- Cold run, same-editor repeat, Next, a different adapter, return and Back/Forward:
  one worker/compiler, correct outputs, fresh program state and retained edits.
- Manual preparation executes no learner code or new duration/result. First
  manual startup introduces the tools; Start → Ready → Compile and a compile
  queued during preparation do not repeat the introduction. Release/restart keeps
  results and acknowledgement.
- Stop while downloading, compiling and running; timeout/crash; a late old reply;
  another submission while busy; each can recover with the next run.
- Default and changed idle intervals, shortening an expired deadline, persistence
  across reload/tabs, unavailable storage, delayed background timers and a running
  operation crossing an idle deadline.
- Introduction before any result with a held startup request, native modal focus
  containment, dimmed/inert background, no auto-expiry, explicit return/settings/Escape,
  remembered acknowledgement and no repetition between lessons. Verify normal
  popover keyboard/light dismissal and measured heaps after release separately.
- Basic and advanced allocation samples, memory unavailable rather than guessed,
  and elapsed time including a run queued during preparation.
- New tab, reload, full page load, missing runtime APIs and a blocked owner startup.
- New published HTML while an older version is saved; genuine 404; unreachable
  host; verified/corrupt offline HTML; old worker without navigation acknowledgement.
- Composition or denied snapshots, new edits while HTML arrives, completion marks,
  model results, recording position, relative links, keyboard and six layouts/themes.
- Save the complete course, close the browser, disable network, open an unvisited
  lesson and compile with a cold runtime. An already-warm heap cannot prove this.

Measure cold startup, same-page repeat, next-lesson startup and adapter upgrade
separately. Record compiler asset requests and worker initialisations as well as
wall time. Do not assert a universal speed ratio from one machine’s timings.
The integration suite records timings under `test-results/code-runner/timings.json`;
unit tests exercise deterministic lifecycle/race cases. Functional tests and
simulator timings do not establish learning effectiveness or physical GPU speed.

## Initial timing observation

A single Chromium 145 headless run on the Linux development workspace, served over
local HTTP, recorded these wall times from clicking Compile and run to the enabled
button/result. The initial implementation also exercised the first-use guidance.
These samples are not a device-independent benchmark or a GPU measurement.

| Journey | Previous page-owned worker | Persistent runner |
| --- | ---: | ---: |
| First lesson, cold run | 7.089 s | 8.092 s |
| Same lesson, repeat | 1.030 s | 2.064 s |
| Next lesson, first run | 9.107 s | 0.975 s |

The intended saving is next-lesson initialisation; this observation does not show
an improvement in cold startup or same-page compilation. The stronger regression
checks assert one worker across navigation and no repeated compiler asset requests.
The first upgrade to the later adapter took 3.016 s, and returning to the opening
adapter took 1.022 s in the same run. Use multiple samples on representative mobile
and desktop devices before making a general performance claim.
