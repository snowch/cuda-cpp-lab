# Sentence clarity followup

Reviewed the current 27-lesson course again on 20 November 2026, starting from
`2921964c91e076e4cb7054d093518fe09b1e3016`. This pass applies written changes after
the [earlier review](course-clarity-and-diagram-review.md) and the learner's
specific observation about lesson 1's opening.

The public prerequisites are basic programming, reading Python and array indexing.
CUDA and GPU architecture are taught locally. The review covers both index routes,
all lessons, the shared editor and model feedback, current appendices and published
recording transcripts. Third-party compiler diagnostics are not authored course
sentences. Recording transcripts continue to represent their published audio.

## Start with the operation before naming hardware concepts

The first pass incorrectly retained this opening:

> A GPU thread is one execution of its instructions.

> Each thread launched for hello runs its body once.

The first sentence assumes the learner already knows what instructions are and
which function owns them. The second repeats execution vocabulary without naming
the assignment. The revised paragraph connects the GPU write to the CPU print:

> The program writes a value in GPU memory, copies the result to CPU memory and
> prints it. The function below, `hello`, performs the GPU write. In CUDA C++,
> `__global__` marks `hello` as a kernel—a GPU function the CPU can launch. The CPU
> launches one GPU thread to run `hello`. That thread writes `42.0f` to `output[0]`.

The pointer explanation now identifies `output[0]` as the float at the supplied
address. The following SM explanation and path diagram name running `hello` and
performing its assignment. The first hardware map no longer requires the reader
to understand instruction issue widths to interpret its scope note. Instructions
are defined later beside the detailed SM key, where loads and arithmetic supply
concrete examples.

## Additional changes from the second pass

Ordinary pronouns with an immediate referent remain. The changes below name a
missing action, condition or quantity, rather than replacing every short reference.

| Location | Previous wording or gap | Applied correction |
| --- | --- | --- |
| Lesson 2 | “Now give the kernel five input values.” | State that the starter supplies the inputs automatically, then explain which input/output indices the thread uses. |
| Lesson 4 | “sets up that work”; “until you reach those steps” | Name GPU allocation, input copy, kernel launch and result copy, and use the actual phase headings in the step-through instructions. |
| All core CUDA edit tasks | Settings “above” a named function without always naming the editable location | Identify the CUDA source editor before the function/setting. Keep exact literal changes, Console fields and the question each comparison answers. |
| Reduction | “The distance d identifies the word paired with the current thread.” | Name `scratch[t + d]`, `scratch[t]` and which threads add. Label the result column **Shared index**. State explicitly that non-adding threads still reach the barriers. |
| Matrix reuse | “The second barrier protects tile reuse”; “Tail loads contribute zero” | State when a tile crosses a matrix edge, which shared positions receive 0.0 and why all threads must finish reading before the next iteration overwrites the tile. |
| Attention | Scalar scores, vector scores and “scaled dot product” left partly implicit | State the starter's query and score/weight/value operations. In the vector model, identify all eight Q/K/V vectors, their four components and division by `sqrt(4) = 2`. |
| Inference | Requested “payload” and “1,024 value values” | Name requested key/value bytes and vector components. Define decoding and token before the cache calculation. Keep logical byte counts distinct from measured traffic. |
| Grid-stride practice | Ownership expressed only through distinct remainders | Follow the actual 70-input case: thread 0 visits 0 and 64; thread 6 stops before 70. Name initial control values before asking for a changed launch. |
| Multi-block practice | Unspecified initial Flag count | Set the optional model to its prepared 97-flag case before asking for the last block's start. Keep the main 70-flag worked example separate. |
| Resource practice | Internal resource keys in feedback and controls differing from the worked case | Display resource names matching the controls. Fresh controls start at 256 threads, 32 registers and 16 KiB; change only registers to 96 for the next prediction. The preceding paragraph explains register pressure without giving away that prediction’s answer. Saved choices still restore by their unchanged values. |
| Timing practice | Unclear “more investigation”; report names with inconsistent case | Name the decision affected by overlapping ranges and give a second-report command. Display **Separate** and **Fused** consistently, and identify shared bytes as per-block storage. |
| Softmax | “very negative starting maximum”; general request to verify against different datasets | Give the actual finite FP32 initial maximum. Name checked-value/row-sum counts and Row 0. Explain how to change `test[]` and columns for another checker row; use the same logits for independent comparisons. |
| Shared failure feedback | “The run timed out”; “The browser worker stopped” | State the timeout or execution-process failure, where the source remains and the actual Compile and run action. Compiler-start failure also points to the visible diagnostic section. |

## Resolution of the earlier written findings

Findings F01–F19 in the earlier review are addressed in this change. In addition to
the second-pass changes above:

- The README directs installation through App status and the browser, rather than
  a removed header control. Installation and a complete offline save remain distinct.
- The profiling illustration identifies lesson 3's two-block/four-thread launch.
- The ready/waiting-warp experiment is open in the scheduling lesson's main flow,
  with its own named comparison. Synthetic issue-slot and load-delay assumptions
  remain inside that model, separate from the CUDA output.
- The pipeline model explicitly omits result copies; the runnable program releases
  a slot only after its result copy. The text identifies the differing last consumer.
- The softmax sequence is starter run → interpret printed mismatches → implement →
  verify → test additional shapes. The shape checklist follows the editor activity.
- Word indices, byte offsets, sectors, flags, prefixes, matrix coordinates and
  category ranks are named for the quantity they represent.
- Counting and stable grouping are described as different output contracts. The
  proposed hardware investigation remains a design question, not a required GPU run.
- The timing reference question concerns event completion and repetition counts;
  the buffer-reuse question remains with the pipeline lesson.
- Optional model controls explicitly change that model, not the source editor.
  Partial warps and resident state are distinguished from ready instructions.

Executable starters, model arithmetic and learner storage keys are
preserved. Reordering the resource selector options preserves every saved option
value. The scheduling disclosure keeps its existing position and identity; only
its initial open state and label change. No additional disclosure or control is
introduced.

## Editor readiness and preservation of early edits

The background-download check exposed an editor-startup timing problem. A
deterministic slow-response probe reproduced it: the textarea was editable while
the document was still loading; releasing the starter initialisation replaced an
edit made during that interval. This was a functional issue, not a reason to relax
the requirement to retain drafts.

The textarea is now read-only and source actions are disabled while the editor
says **Preparing the CUDA source editor…**. Editing is enabled after load, when
the starter, draft handlers and restoration hooks have loaded. Saved drafts and
their recovery policy remain unchanged. A delayed-response browser check verifies
the initial guard, the complete starter, and preservation of the first subsequent
edit across closing and reopening.

Navigation and offline checks now open the scheduling comparison only when it is
closed. Their previous unconditional click closed the newly visible comparison
before attempting to use its controls. Draft checks wait for an editable complete
starter before reading/changing it, and assert restored values with browser-aware
waiting rather than sampling an unfinished document.

## Remaining diagram and recording work

The five earlier concept-diagram specifications remain separate work: numerical
attention rescaling, buffer-reuse dependencies, cross-block starts, a nonzero
routing start, and both A/B reuse paths. This pass clarifies their surrounding
sentences and assumptions; it does not substitute more prose for those visual
proposals or claim that new diagrams have been drawn.

F20 concerns two published recording phrases about dependencies/resources or local
work/synchronisation “still mattering”. Keep the proposed goal/condition wording
with the next media revision and regenerate the corresponding audio/captions
together. Do not silently replace the visible transcript of existing audio.

## Design and learning review

Applied [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
to preserve the existing Plex typography, shared code panels, labels and action
hierarchy. Reuse the scheduling experiment rather than add a second control or
diagram. Keep essential instructions visible and optional inspection collapsed.

Applied [Instructional Design](https://github.com/joelrkohlman/instructional-design/blob/main/SKILL.md)
to introduce terms through the known input, operation and result; distinguish
prepared state from learner actions; align comparisons with an observable question;
and avoid using simulated counts to rank real GPU speed. The reference to Python
is now public rather than only an internal audience assumption.

Verification results and the actual reading-order/screensize checks are recorded
on the implementation PR. Functional checks establish interface behaviour and
numerical examples, not learning effectiveness or physical Android/GPU behaviour.
