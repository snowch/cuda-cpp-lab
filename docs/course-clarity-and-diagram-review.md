# Course clarity and concept diagram review

Reviewed 20 November 2026 against `c13e98d357d22c873376ce25e441e55fe5613a92`.
These are findings and proposed changes; the learner-facing text and diagrams have
not been rewritten as part of this review.

The later [sentence clarity followup](sentence-clarity-followup.md) records applied
written fixes, including the lesson-1 opening missed here. Diagram proposals and
published recording wording are tracked separately there.

## Audience and coverage

The public introduction assumes basic programming and array indexing, and promises
to introduce CUDA and GPU architecture. The internal [course plan](plan.md) also
assumes reading Python. The review does not assume prior knowledge of CUDA,
occupancy, attention implementation or GPU scheduling.

Read the 27 current lessons in course order, including headings, definitions,
excerpts, prepared-state explanations, tasks, optional model instructions,
application questions, references and all 21 published recording transcripts.
Also reviewed both course index routes, the desktop/profiling appendices, README
instructions, shared editor cues, completion/status messages and dynamic model
feedback. There are 31 generated main-content pages plus the shared standalone
editor; the two indexes repeat the same course content. Retired V1 pages are outside
this inventory.

Checked generated text against the source templates, actual edit targets, model
result labels and existing diagrams. Ordinary pronouns with an immediate, clear
referent are not findings. A short definition or named comparison is preferred to
an additional diagram when it resolves the problem.

## Changes to make first

### F01 Installation instructions point to a removed control

Source: [README, Use offline](../README.md#use-offline).

> Choose Install in the course header to add GPU Lab to your apps

There is no header Install button. Installation help is inside App status and the
browser performs installation. This instruction cannot be followed as written.

Replace the opening instruction with: “Open **App status** and expand **Add GPU Lab
to your apps** for your browser’s installation instructions. Installing the app
does not save the complete course; choose **Save offline copy** separately.” Keep
the following offline-readiness explanation. No diagram is needed.

### F02 The profiling illustration identifies the wrong lesson

Source: [profiling appendix renderer](../content/profiling.mjs), Read grid and
block dimensions.

> Illustration · chapter 1’s handwritten launch, not measured PyTorch output

The illustration is `grid: [2, 1, 1]`, `block: [4, 1, 1]`. Current lesson 1 launches
one block of one thread. The two-block/four-thread example belongs to lesson 3.
The surrounding calculation is correct; its attribution is stale.

Use “Illustration · lesson 3’s five-input launch; not measured PyTorch output” and
link to **More threads than elements**. Replace the later “book’s small launch”
reference with “this illustrative launch”. Keep the warning that dimensions do not
establish simultaneous execution or performance.

### F03 The scheduling activity does not expose its main comparison

Sources: [lesson goal](../content/v2-course.mjs),
[CUDA task](../content/v2-programs.mjs),
[scheduling model](../src/v2-core-lessons.mjs).

> Follow a load dependency and compare what happens with one ready warp or two.

> Both runs double every input; the optional model examines idle instruction slots rather than timing these runs.

The main editor activity compares `Threads` and `values`: both increase when
`warpsPerBlock` changes. That is valid output accounting, but it does not reveal
which instruction runs during a wait. The observable scheduling comparison is
inside **Explore the model: ready and waiting warps**, which looks optional.

Keep the CUDA check, then make the scheduling experiment part of the main flow:
“Select **One warp** under **Resident warps** and click **Run model**. Use **Next
step** to locate the first idle issue slot. Select **Two warps**, predict how many
instructions issue before the first idle slot, and run again. Which warp can issue
while the other waits for its input?” Keep the one-instruction-per-slot and
six-slot load assumptions visible. A new diagram is unnecessary: the existing
load/wait/multiply schematic and issue trace already show the relationship.

### F04 The softmax instructions give two different first actions

Source: [practical lesson renderer](../content/v2-practical-view.mjs), Build and
verify a stable softmax.

> First replace the body of rowSoftmax in the CUDA source editor.

Later:

> Click Compile and run with the starter. Console reports Mismatch at index and a nonzero mismatch count because rowSoftmax writes zero.

The earlier imperative bypasses the deliberately failing starter that the later
task asks learners to inspect. Use one order: run the unchanged scaffold, interpret
its printed numerical failure, implement the three passes, rerun, then test shapes.

Replace the earlier imperative with “You will replace the body of `rowSoftmax`;
keep the supplied allocation, copying, CPU reference and checks.” Keep the contract
and numerical worked example before the editor; place the shape-testing checklist
after the first-run/implementation task. Preserve the distinction between a
running program reporting mismatches and a compilation or execution failure.

### F05 The pipeline model omits a consumer included by the program

Sources: [pipeline model explanation](../src/v2-core-lessons.mjs),
[parallel model](../src/parallel-models.mjs),
[program explanation](../content/v2-lesson-context.mjs).

> A copy takes two units and computation takes three units in this model.

> Later, used[s] is recorded after the output copy; the next reuse waits for it.

The synthetic timeline models input-copy and compute operations, and releases a
slot at compute completion. The runnable program also copies the result back and
records `used[s]` after that copy. Both can be correct, but the model’s shorter
consumer chain is not stated beside its assumptions. Readers can otherwise infer
that compute completion is always sufficient for reuse.

Add: “This schedule models input copies and kernels only; it omits result copies.
The CUDA program also copies each result back, so its `used[s]` event follows that
last consumer.” Extend the visible dependency diagram as specified in D02. Keep
synthetic durations separate from measured overlap.

## Focused wording changes

Each finding quotes the passage that needs attention and gives a local correction.
These are not requests to remove all short references such as “this” or “it”.

### F06 Word indices and byte addresses

Location: lessons 5 and 9; [program notes](../content/v2-programs.mjs), [lesson context](../content/v2-lesson-context.mjs).

> The CPU groups those addresses into 32-byte sectors

> The returned integers identify word addresses.

The program returns element/word **indices**, not byte addresses. Say “For each returned index, the CPU calculates a byte offset (`4 × index`) and its aligned 32-byte sector.” For shared memory: “Each returned integer is a shared-word index; its remainder modulo 32 gives the bank in this model.” Retain the aligned-base assumption and the non-timing caveat.

### F07 Preparation for attention and decoding

Location: lessons 13–14; [core lessons](../src/v2-core-lessons.mjs), [lesson context](../content/v2-lesson-context.mjs).

> Attention forms scores from a query and keys

> A decoding step reads old keys and values and appends a new token’s key and value.

Introduce the operation and sequence locally. For the scalar starter: “Multiply query `1.0` by each scalar key to form eight scores. Softmax gives one weight per score; multiply each weight by the corresponding value and add the products.” Define decoding as generating the next token using the earlier sequence, and a token as an indexed sequence item, such as a piece of text. Q/K/V projection details are unnecessary here.

### F08 Selection flags and predicates

Location: lessons 17–18; [parallel lessons](../src/v2-parallel-lessons.mjs).

> The eight input flags are 1, 0, 1, 0, 0, 1, 0, 1

> Keep tokens that match the predicate

State what is selected before counting it: “Here a flag is 1 for a category-0 token and 0 otherwise; a prefix sum counts selected tokens.” Replace “predicate” at its first use with “selection rule: keep tokens whose category equals `keepCategory`”. This supplies meaning without a new diagram.

### F09 The first matrix input tile

Location: lesson 10 application question; [core lessons](../src/v2-core-lessons.mjs).

> At width 2, which output positions in the first tile reuse b[1][0] during the first K tile?

`K tile` is not defined, and `width` can mean matrix width or tile width. Say “With **Output tile width 2**, consider the first output tile, rows 0–1 and columns 0–1. During the first input tile (`k0 = 0`), which outputs reuse shared `b[1][0]`, loaded from `B[1,0]`?” D05 can support this question.

### F10 Resource controls and the worked case

Location: lesson 25; [practical instructions](../src/v2-practical-instructions.mjs), [controls](../content/v2-practical-view.mjs).

> Choose Threads per block, Registers per thread and Shared memory per block

> Change one resource and check whether that minimum changes.

The nearby worked case uses 256 threads/32 registers/16 KiB, but fresh controls start at 512/96/16. The initial result is therefore one block/25%, not the worked four blocks/50%. Explicitly set the worked case, run it, then change only registers to 96 and predict two blocks/25%. Keep the default case as a separately labelled new problem if wanted.

### F11 How to calculate a resource limit

Location: lesson 15; [core lessons](../src/v2-core-lessons.mjs).

> Which resource gives the smaller limit?

Name how to derive the limit from the displayed capacities and uses: “For each resource, divide capacity per SM by use per block and round down. Take the smallest result and the eight-block limit.” Keep the deliberately imaginary budgets explicit. This short calculation rule resolves the gap without a new figure.

### F12 What to do when timing ranges overlap

Location: lesson 26; [practical lesson renderer](../content/v2-practical-view.mjs).

> Compare medians and ranges; overlapping ranges deserve more investigation.

Say what decision is affected: “If the sample ranges overlap, the median ratio alone is weak evidence for choosing the faster variant. Keep the first report, rerun `./benchmark-fusion > report-repeat.json` with the same GPU, input and benchmark settings, and compare **Median**, **Min** and **Max** across both reports.” Do not imply that non-overlapping sample ranges by themselves prove a universal or statistically established speedup.

### F13 An events question for kernel timing

Location: lesson 26 References; [practical references](../content/v2-practical-view.mjs).

> Which completion must protect a slot before it is reused: its input copy or its last consumer?

This events question belongs to the pipeline lesson. For kernel timing, ask “After recording start and end events around repeated launches in the same stream, which event must complete before elapsed time can be read, and why divide by the repetition count?” Answer: wait for the end event; divide to obtain time per complete variant. Reuse the same API link with a locally relevant question.

### F14 Different output contracts in a performance comparison

Location: lesson 21 application question; [parallel lessons](../src/v2-parallel-lessons.mjs).

> Design a real GPU comparison between counting and stable grouping.

These operations have different output contracts. Say “Design separate GPU measurements for a count-only pipeline and a stable-grouping pipeline on identical inputs. State which application requires only counts and which requires ordered token IDs. Describe how you would validate each contract and time every required stage.” Their time ratio is not a speedup for interchangeable implementations.

### F15 Independent model controls and editor source

Location: shared optional models; [page renderer](../content/v2-view.mjs), [practical renderer](../content/v2-practical-view.mjs).

> It uses this selector and the source excerpt here

> This practice tool uses its own inputs and compares its own result.

Name the relationship to the editor: “These controls change only this model and its displayed excerpt; they do not edit or rerun the CUDA program above.” Keep dataset differences visible where they affect a comparison, especially the attention and softmax activities. Remove the redundant generic sentence about calculating “the case selected here”.

### F16 Recovery after a run fails

Location: shared editor failure feedback; [workbench template](../content/v2-cuda-source-workbench.html).

> The run timed out.

> The browser worker stopped.

Explain the next possible action without discarding work. For example: “The run timed out after 90 seconds. Your source remains in the CUDA source editor. Click **Compile and run** to try again.” For worker failure, name that the browser execution process stopped and can be restarted by the same button. Retain actual diagnostics and existing export/recovery controls; do not suggest Restore starter as the automatic repair.

### F17 Skipping guarded accesses instead of stopping a thread

Location: lesson 3 goal and both indexes; [catalogue](../content/v2-course.mjs).

> see which threads stop at the bounds check

The displayed `if` skips array operations; it does not itself stop the thread. Use “see which threads skip the guarded array reads and writes”. Keep unlaunched warp positions distinct from launched threads that skip those operations.

### F18 Public prerequisites for Python examples

Location: public prerequisites; [index renderer](../content/v2-view.mjs), [course plan](plan.md).

> Before you start, be comfortable with basic programming and array indexing.

The practical lessons and profiling appendix use Python/PyTorch. State “basic programming, reading Python and array indexing” publicly if that is required, or provide the missing language preparation locally. Do not silently apply the broader internal prerequisite during learner review.

### F19 Partial warps and resident state

Location: hardware key; [hardware renderer](../content/v2-hardware.mjs).

> A group of 32 threads with resources allocated on an SM.

Keep the partial-warp explanation consistent with lesson 3: “A warp has 32 lane positions; a small block can leave some unused. A resident warp has its state and required resources allocated on an SM.” Allocation does not mean its next instruction is ready.

### F20 Conditions behind statements that something matters

Location: scheduling and histogram transcripts; [published captions](../content/v2-media.json).

> dependencies and resource limits still matter

> Extra local work and synchronisation still matter

Name the goal and condition. Scheduling: “Additional resident warps can fill otherwise idle issue slots only when they have ready instructions and fit the SM’s resource limits.” Histogram: “The shared-counter variant adds shared atomic operations and two block barriers per block. Measure the complete variants before deciding whether fewer global atomic additions reduce kernel time.” These are script/caption proposals; changing the transcript alone must not misrepresent existing audio.

## Concept diagram proposals

These proposals identify a question the learner currently has to reconstruct from
prose. Extend or reuse existing figures rather than adding a second decorative
flow beside the same explanation. Generate displayed values from the relevant
model or starter and label approximations.

### D01 Show why both attention totals must be rescaled

Passage, lesson 13 ([source](../src/v2-core-lessons.mjs)):

> When a tile raises the maximum, rescale the earlier contributions before adding new ones.

> Multiply both by exp(old maximum − new maximum). This puts the old terms on the same scale as the new terms.

**Question:** Why multiply both totals, and what changes when the next tile raises
the maximum?

**Visual:** Extend the current three-stage attention flow with a worked state
transition from the scalar CUDA starter. Query is `1.0`; the first two keys are
`[-2.0, -1.0]`, with values `[1.0, 2.0]`. Show old maximum `−1.0`, denominator
approximately `1.367879`, and weighted sum approximately `2.367879`. The next keys
`[0.0, 1.0]` raise the maximum to `1.0`. Draw the same `exp(−2) ≈ 0.135335` factor
feeding **both** old totals, then arrows adding the new tile's contributions.
Mark these as unnormalised running totals. A small ratio before/after rescaling
should show that rescaling alone preserves the previous weighted result; adding
new keys changes that partial result.

**Placement and replacement:** Put this beside the first recurrence explanation,
before the edit-and-run task. Replace the generic “Rescale old totals” detail and
the repeated explanation of putting terms “on the same scale” with the labelled
transition. Keep the final division and the caveat that this is one thread over
eight scalar keys, not parallel FlashAttention. Do not substitute the optional
eight-query vector model's values without labelling the different dataset.

### D02 Connect the last buffer consumer to the next overwrite

Passage, lesson 20 ([source](../content/v2-lesson-context.mjs)):

> Later, used[s] is recorded after the output copy; the next reuse waits for it.

> A reusable buffer must wait for its previous consumer, even when its next copy is ready.

**Question:** Which completion makes slot 0 safe for chunk 2 to overwrite?

**Visual:** Two stream rows, **copy** and **compute**, with slot 0 highlighted.
Show chunk 0 input copy → record `ready[0]`; a cross-stream wait → kernel → result
copy → record `used[0]`; another cross-stream wait → chunk 2 input copy. Put slot 1
on a secondary row to show independent eligible work without implying guaranteed
overlap. The arrows encode dependencies, not durations or dedicated engines.

**Placement and replacement:** Extend the visible three-stage starter diagram
immediately after the editor. Replace its vague “Record consumed” detail with the
explicit kernel/result-copy/`used` chain. Replace “previous consumer” in the
adjacent paragraph with “the kernel and result copy from the previous chunk”.
Keep pinned-memory and device-support conditions visible. The existing synthetic
timeline remains useful, with F05's explicit omission of result copies.

### D03 Carry block totals into individual global offsets

Passage, lesson 24 ([source](../content/v2-practical-view.mjs)):

> The first launch writes local exclusive offsets and one total per block. A second launch scans those totals. A third adds the corresponding block start to every valid local offset.

**Question:** How can a local offset of zero become global offset 22, and why is a
block barrier insufficient to supply that start?

**Visual:** Annotate the existing three-phase flow for the stated 70 flags, with
flag 1 at indices divisible by three. Show block valid lengths `[32, 32, 6]` and
totals `[11, 11, 2]`. Arrows feed an exclusive scan producing starts `[0, 11, 22]`.
Highlight global input index 64 in block 2, whose flag is `0`: local offset `0` + block start `22` →
global offset `22`. Keep valid-lane counts visually distinct from selected-flag
totals. Show the kernel boundaries and device-memory arrays between them.

**Placement and replacement:** Put the annotated flow in **Connect the local
scans**, before the three launch excerpts. It can replace the prose listing
lengths/totals/starts and the generic three-stage flow. Keep the same-stream
ordering explanation, collective tail participation and 1024-flag construction
limit beside it. The optional 97-flag activity remains a new application case.

### D04 Reuse the routing figure with a nonzero category start

Passage, lesson 21 ([source](../content/v2-lesson-context.mjs)):

> start sums earlier category counts; start plus rank gives a unique destination.

**Question:** How do category counts and a token's within-category rank combine
when its category does not start at output zero?

**Visual:** Reuse the existing
[routing figure](../src/parallel-figures.mjs), rather than building another model.
Use the mixed categories `[0,1,0,2,1,0,3,0]`, counts `[4,2,1,1]` and exclusive starts
`[0,4,6,7]`. Highlight token 4, category 1, rank 1: start `4` + rank `1` → slot `5`.
Show category 1's slots 4–5 and completed IDs `[0,2,5,7,1,4,3,6]`. Label categories,
token IDs and output slots separately. The current recording's category-0 examples
have start zero, so they do not make the addition of a nonzero start observable.

**Placement and replacement:** Promote one compact worked frame before the route
excerpt, replacing the generic **Find start and rank** flow detail. Retain the
interactive step-through in the model for new cases. Keep the same-stream
producer/consumer dependency and the distinction between stable offsets and
arrival order; the picture does not prescribe GPU scheduling.

### D05 Show the B reuse as well as the A reuse

Passage, lesson 10 ([source](../content/v2-lesson-context.mjs)):

> After the barrier, each output thread accumulates products using those tiles.

The application question asks which outputs reuse `b[1][0]`, but the visible
[reuse figure](../content/v2-diagrams.mjs) shows only an A value feeding two outputs.

**Question:** Which threads share an A word, which share a B word, and which state
remains private?

**Visual:** Extend that figure into two connected examples within one 2 × 2 output
tile. Show shared `A[0,0]` feeding products for `C[0,0]` and `C[0,1]`, and shared
`B[1,0]` feeding `A[0,1] × B[1,0]` for `C[0,0]` and `A[1,1] × B[1,0]` for `C[1,0]`.
Draw distinct private sum boxes for the output threads. Use matrix coordinates,
not invented physical execution-unit positions. A barrier boundary before reads
and another before replacing shared tiles should remain visible.

**Placement and replacement:** Extend **One loaded A value serves two outputs**
after the edit-and-run task. Replace its single-sided explanatory sentence with
the paired row/column relationships; use F09's concrete first-tile wording for the
application question. Keep row-major offsets and partial-tile handling in text.

## Where another diagram is unnecessary

- Lesson 1 already distinguishes CPU/GPU storage and shows the copy-back path.
  Its transcript explicitly pauses before the copy. Retain it.
- Lesson 3 already maps block/local indices to valid writes and skipped accesses.
  Correct “stop” wording instead of adding a second grouping picture.
- Lessons 5 and 9 have sector/bank views with units and concrete address patterns.
  Fix index-versus-address language; do not duplicate those mappings.
- Reduction already shows shared writes → barrier → partner reads, and the model
  tracks contributing indices. Scan distinguishes old/new snapshots; compaction
  shows flags, offsets and reverse inspected writes. These are useful relationships.
- Histogram already has a model showing separate block partials and global
  merges. Reuse it if that operation-count comparison becomes essential reading.
- The tolerance formula in lesson 22 needs a small worked number, not another
  process diagram: for reference `20.0`, the stated bound is `0.00201`; absolute
  error `0.001` passes and `0.003` fails. Preserve the separate non-finite and
  shape/order checks. This clarifies a threshold under the stated prerequisites.

## Lesson coverage record

The IDs below identify local findings; shared feedback and prerequisite findings
also apply where those components appear. “Retain” means no additional local
sentence or concept-diagram change is recommended by this pass.

| Lesson | Outcome |
| --- | --- |
| 1 · Write your first GPU value | Retain the assignment, copy/print explanation, 42.0 → 7.0 task and CPU/GPU distinction. |
| 2 · One thread, one element | Retain the multiplier/index task. The recording's four-thread index calculation matches the editable starter. |
| 3 · More threads than elements | F17; retain the existing index table and partial-warp distinction. |
| 4 · From CPU array to GPU result | Retain automatic element/byte counts and the exact nine-input edit. |
| 5 · Same load, different addresses | F06, F19; retain the sector diagram, alignment assumption and traffic caveat. |
| 6 · What runs while a warp waits? | F03, F20; use the existing scheduling trace in the main progression. |
| 7 · When lanes take different branches | Retain active masks and the source-versus-compiler distinction. |
| 8 · Add values across a block | Retain the barrier diagram and concrete partner-index application. |
| 9 · Shared-memory addresses | F06; retain distinct-word conflicts versus same-word broadcast. |
| 10 · Matrix tile reuse | F09, D05; retain CPU verification, zero-padded tails and two barrier roles. |
| 11 · Fewer input bits | Retain the explicit distinction between scalar conversion and array storage. |
| 12 · Warp matrix operation | Retain fragment/accumulator roles and the portable-layout caveat. |
| 13 · Attention | F07, D01; retain the scalar-starter/vector-model distinction. |
| 14 · Key-value cache | F07; retain requested payload versus measured traffic and fixed append size. |
| 15 · Matrix investigation | F11; retain imaginary budgets and the real-measurement requirement. |
| 16 · Histograms | F20; existing partial-count and merge visual is sufficient. |
| 17 · Scan | F08; retain the old-snapshot/private-partner explanation. |
| 18 · Compaction | F08; retain same-stream ordering and stable offsets versus write order. |
| 19 · Progress dependency | Retain the safe runnable kernel and separate invalid-participation diagnostic. |
| 20 · Pipelines | F05, D02; distinguish the model's final consumer from the program's. |
| 21 · Stable token routing | F14, D04; use a nonzero category start in visible worked reasoning. |
| 22 · Check every GPU result | Retain independent full-output checks; add the numerical tolerance example above. |
| 23 · Grid-stride loops | Retain coverage, tail/empty handling and the individual-visit model. |
| 24 · Multi-block scan | D03; retain the explicit three-kernel ordering and construction limit. |
| 25 · SM resources | F10; retain the separate local-memory/spill and occupancy explanations. |
| 26 · Measure a kernel | F12, F13; retain capture provenance, unknown fields and separate profiling/timing. |
| 27 · Stable softmax | F04; retain finite-input contract, independent checks and additional-row editor instructions. |

The desktop appendix gives an executable command, a literal edit and an observable
result. Keep it. The profiling appendix needs F02. Shared App status now separates
online freshness from offline readiness; this pass does not propose another status
section or another download action. Editor messages already distinguish program
exit checks from compiler/simulator errors, retain previous-output provenance and
offer draft recovery; F16 concerns missing recovery direction in terse failures.

## Verification and limits

- Built the current site and read its generated lesson text alongside the source.
- Reviewed dynamic model tables, labels, predictions, valid/invalid cases and the
  actual source edit targets. Existing figures were checked before proposing new
  ones; historical V1 screenshots are not evidence for current pages.
- The full `tests/browser.py` suite passed against the unchanged course. It
  checked all 25 editors and 48 starter excerpts, six viewport/theme
  combinations, keyboard paths, current references/navigation, video playback and
  captions, editor cues and saved-state/recovery checks.
- Checked the proposed numerical examples against the existing models: resource
  limits, 70-flag block totals/starts, token 4's destination, the tolerance bound
  and the attention ratio under common rescaling.
- Checked all 37 quoted passages against the current generated content, README
  or editor source, and verified that the relative documentation links resolve.
- Newly captured resource-activity views confirm the fresh 512-thread/96-register
  controls and the resulting one-block/25% case. Those are valid model results;
  F10 concerns the mismatch with the preceding worked case, not broken arithmetic.
- Read all published recording transcripts. Playback/caption checks and transcript
  review do not constitute listening approval of every audio segment or review of
  every encoded video frame. Script revisions require corresponding media review.
- Native GPU timing and learner comprehension were not measured. A passing browser
  check establishes interface behaviour, not that the reader understands it.

Applied [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
for action labels, visual hierarchy and avoiding redundant diagrams, and
[Instructional Design](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md)
for prerequisites, observable outcomes, cognitive load and task/feedback alignment.
The proposed diagrams name their learning question, data, connections, placement,
text they can replace and assumptions that must remain visible.
