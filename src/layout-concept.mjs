// Copyright © 2026 Christopher Snow.
import {conceptFigure,conceptNode} from './concept-view.mjs';

export function renderLayoutConcept() {
  return conceptFigure({id:'layout-concept',title:'Shared storage and a packed copy',body:`
    <div class="layout-concept-map">
      <div class="layout-concept-refs">${conceptNode('Tensor x','')}${conceptNode('Column view','')}</div>
      <p class="concept-connector layout-concept-original-link">↓ Both use this storage ↓</p>
      <div class="layout-concept-original">${conceptNode('Original storage','<p>The values keep their existing positions.</p>')}</div>
      <div class="layout-concept-copy"><code>.contiguous()</code><span class="layout-concept-copy-arrow" aria-hidden="true"></span><p>Copy the selected column’s values</p></div>
      <div class="layout-concept-packed-name">${conceptNode('Packed column','')}</div>
      <p class="concept-connector layout-concept-packed-link">↓ Uses this separate storage</p>
      <div class="layout-concept-new">${conceptNode('New packed storage','<p>The same selected values are next to one another.</p>')}</div>
    </div>`,
    note:'The copy shown is for this strided column, before multiplication. The original tensor and its column view remain available, sharing the original storage.'});
}
