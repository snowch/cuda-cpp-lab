// Copyright © 2026 Christopher Snow.
import {conceptFigure,conceptNode} from './concept-view.mjs';

export function renderDivergenceConcept() {
  const arrow='<p class="concept-connector" aria-hidden="true">↓</p>';
  const output='<p>Each lane keeps its own output.</p>';
  return conceptFigure({id:'divergence-concept',title:'Lane masks select a calculation',body:
    conceptNode('Test each participating input','<p>For this experiment’s non-zero inputs, each lane tests <code>x &gt; 0</code>.</p>')+
    `<div class="concept-pair concept-alternatives"><div>${arrow}${conceptNode('True · positive','<p>Double each included lane’s input.</p>'+output)}</div><div>${arrow}${conceptNode('False · negative','<p>Negate each included lane’s input.</p>'+output)}</div></div>`,
    note:'Possible paths in the first experiment. Only a non-empty mask runs its arithmetic. These groups do not show simultaneous execution or separate hardware units.'});
}
