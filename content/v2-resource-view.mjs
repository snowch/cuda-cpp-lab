// Copyright © 2026 Christopher Snow.
import { sectionIcon } from '../src/section-cues.mjs';
import { escape } from '../src/continuation-ui.mjs';

// Native details provide the keyboard and no-script disclosure behaviour.
export function resourceSummary(kind, title, description, id = '') {
  return `<summary>${sectionIcon(kind)}<span class="v2-resource-copy">
    <strong${id ? ` id="${id}"` : ''}>${escape(title)}</strong>
    <span class="v2-resource-description">${escape(description)}</span>
    </span><svg class="v2-resource-chevron" aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg></summary>`;
}
