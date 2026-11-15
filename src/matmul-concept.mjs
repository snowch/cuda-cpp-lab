// Copyright © 2026 Christopher Snow.
import {conceptFigure} from './concept-view.mjs';

export function renderMatmulConcept(tile) {
  const positions=Array.from({length:tile},(_,i)=>i);
  const columns=positions.map(c=>`<th scope="col"><span>Shared B</span><code>B[k,${c}]</code><span class="matmul-concept-direction" aria-hidden="true">↓</span></th>`).join('');
  const rows=positions.map(r=>`<tr><th scope="row"><span>Shared A</span><code>A[${r},k]</code><span class="matmul-concept-direction" aria-hidden="true">→</span></th>${positions.map(c=>`<td><code>C[${r},${c}]</code><span>Private sum</span></td>`).join('')}</tr>`).join('');
  return conceptFigure({id:'matmul-concept',title:`One ${tile} × ${tile} output tile: sharing at one K index`,
    body:`<p>Each output thread multiplies the A value on its row by the B value above its column, then adds the product to its private C sum.</p><table class="matmul-concept-grid" aria-label="Shared input values feeding private output sums"><thead><tr><td class="matmul-concept-corner" aria-hidden="true">×</td>${columns}</tr></thead><tbody>${rows}</tbody></table>`,
    note:`Fixed tile width ${tile} in the first output tile. Repeat the sharing for every K index in a phase. Each C cell holds its thread’s private sum; arrows show data dependencies.`});
}
