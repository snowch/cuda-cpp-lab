// Copyright © 2026 Christopher Snow.
import { escape } from '../src/continuation-ui.mjs';

export function renderV2Brand(homeHref, iconHref) {
  return `<a class="brand v2-brand" href="${escape(homeHref)}" aria-label="CUDA C++ Lab home">
<img class="brand-icon" src="${escape(iconHref)}" alt="" width="40" height="40">
<span class="v2-brand-copy"><span>CUDA C++ Lab</span><span class="v2-brand-language">GPU architecture</span></span></a>`;
}
