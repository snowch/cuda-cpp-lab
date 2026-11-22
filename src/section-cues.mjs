// Copyright © 2026 Christopher Snow.
// Decorative SVGs supplement the headings; their text remains the accessible name.
import {materialSymbol} from './material-symbols.mjs';
const names={recap:'smart_display',desktop:'terminal',references:'menu_book',documentation:'explore',investigation:'science'};
export function sectionIcon(kind){
 if(!names[kind])throw new Error('Unknown section role: '+kind);
 return `<span class="section-cue-icon" aria-hidden="true">${materialSymbol(names[kind])}</span>`;
}
export const sectionHeading=(kind,title,id='')=>`<h2 class="section-cue-heading"${id?` id="${id}"`:''}>${sectionIcon(kind)}<span>${title}</span></h2>`;
