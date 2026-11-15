// Copyright © 2026 Christopher Snow.
import {conceptFigure,conceptFlow} from './concept-view.mjs';

export function renderReductionConcept() {
  return conceptFigure({id:'reduction-concept',title:'Order shared writes before partner reads',body:conceptFlow([
    ['Write inputs','<p>Each thread stores its input in its own shared word.</p>'],
    ['All block threads reach the barrier','<p>Threads without an addition take part too. Earlier shared writes become visible.</p>'],
    ['Read partners and combine','<p>Selected threads read partner words, add and store partial sums.</p>'],
  ])+'<p class="concept-connector"><span aria-hidden="true">↶</span> Before the next partner reads, every block thread reaches the barrier again.</p>',
  note:'Ordering in the synchronised model with one block. Arithmetic reads a snapshot of the previous stage. After Run, the shared word cards show the selected event’s values.'});
}
