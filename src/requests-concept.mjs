// Copyright © 2026 Christopher Snow.
import {WORD_BYTES,SECTOR_BYTES} from './model.mjs';
import {conceptFigure,conceptFlow} from './concept-view.mjs';

export function renderRequestsConcept() {
  return conceptFigure({id:'requests-concept',title:'From lane reads to sector groups',body:conceptFlow([
    ['Locate each read',`<p>For each participating lane, multiply its selected value’s element offset by ${WORD_BYTES} to get the byte offset.</p>`],
    ['Find its sector',`<p>Divide each byte offset by ${SECTOR_BYTES} and round down. This gives that read’s sector number.</p>`],
    ['Group matching reads','<p>Reads with the same sector number share one region. Count each distinct region once.</p>'],
  ]),note:'For the experiment’s aligned allocations and single input read. Sector counts describe addressed regions; they do not measure DRAM reads or elapsed time.'});
}
