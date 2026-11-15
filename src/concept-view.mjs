// Copyright © 2026 Christopher Snow.
import {escape} from './continuation-ui.mjs';

// Bodies are trusted, authored HTML; labels remain plain text.
export function conceptNode(title,body) {
  return `<div class="concept-node"><strong class="concept-node-title">${escape(title)}</strong>${body}</div>`;
}
export function conceptFlow(steps) {
  return `<ol class="concept-flow" role="list">${steps.map(([title,body])=>`<li>${conceptNode(title,body)}</li>`).join('')}</ol>`;
}
export function conceptFigure({id,title,body,note}) {
  return `<figure class="concept-figure" id="${id}" aria-labelledby="${id}-caption"><figcaption id="${id}-caption">${escape(title)}</figcaption>${body}<p class="concept-scope">${escape(note)}</p></figure>`;
}
