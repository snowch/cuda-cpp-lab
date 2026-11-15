// Copyright © 2026 Christopher Snow.
import {launchPlan,simulateIntro} from './hello-model.mjs';
import {conceptFigure,conceptNode,conceptFlow} from './concept-view.mjs';

export function renderLaunchConcept() {
  const plan=launchPlan(simulateIntro(0,2).input.length,4),bytes=plan.count*Float32Array.BYTES_PER_ELEMENT;
  return conceptFigure({id:'launch-from-input-concept',title:'Worked program · one input count connects storage and launch',
    body:`${conceptNode('Existing CPU input',`<p><code>input.size()</code> → <strong>n = ${plan.count}</strong></p>`)}
    <div class="concept-pair">
      <div><p class="concept-connector">From n ↓ matching storage</p>${conceptNode('One output per input',`<p>CPU output: ${plan.count} elements<br>GPU input: ${bytes} bytes<br>GPU output: ${bytes} bytes</p>`)}</div>
      <div><p class="concept-connector">From n ↓ add a block-size choice</p>${conceptNode('Cover the input indices',`<p>${plan.size} threads/block → ${plan.blocks} blocks<br>${plan.threads} threads launched<br>Kernel argument: <strong>n = ${plan.count}</strong></p>`)}</div>
    </div>
    <p class="concept-flow-label">After allocation, follow the CPU calls in program order</p>
    ${conceptFlow([
      ['Copy inputs','<p>CPU input → GPU input</p>'],
      ['Launch kernel','<p>Queue the doubling. The launch does not wait for GPU completion.</p>'],
      ['Copy results back','<p>The blocking copy waits for the preceding kernel and returns with the CPU output available.</p>'],
      ['Use the CPU result','<p>Print and check the output, then release both GPU allocations.</p>'],
    ])}`,
    note:'Fixed five-input program. Arrows show count dependencies and CPU call order, without a time scale. Extra launched threads do not change n.'});
}
