import {materialSymbol} from '../src/material-symbols.mjs';
// Copyright © 2026 Christopher Snow.
import { sectionIcon } from '../src/section-cues.mjs';
import { escape } from '../src/continuation-ui.mjs';

// Native details provide the keyboard and no-script disclosure behaviour.
export function resourceSummary(kind, title, description, id = '') {
  return `<summary>${sectionIcon(kind)}<span class="v2-resource-copy">
    <strong${id ? ` id="${id}"` : ''}>${escape(title)}</strong>
    <span class="v2-resource-description">${escape(description)}</span>
    </span>${materialSymbol('chevron_right','v2-resource-chevron')}</summary>`;
}

export function durationLabel(value){const seconds=Math.round(value);return seconds<60?`${seconds} sec`:`${Math.floor(seconds/60)} min${seconds%60?' '+seconds%60+' sec':''}`;}

export function recordingTranscript(scenes) {
  const groups=[];
  for(const {title,captions} of scenes){
    if(groups.at(-1)?.title===title)groups.at(-1).captions.push(...captions);
    else groups.push({title,captions:[...captions]});
  }
  return groups.map(({title,captions})=>`<section><h3>${escape(title)}</h3><p>${escape(captions.join(' '))}</p></section>`).join('');
}
