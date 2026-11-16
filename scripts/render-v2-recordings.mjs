// Copyright © 2026 Christopher Snow.
// Prepare lesson-specific recording frames from the visible starter bridges.
import { mkdir, writeFile } from 'node:fs/promises';
import { v2CoreCourse as v2Course } from '../content/v2-course.mjs';
import { lessonContexts } from '../content/v2-lesson-context.mjs';
import { escape } from '../src/continuation-ui.mjs';
const inputs = [];
const css = `@font-face{font-family:Plex;src:url('/assets/fonts/plex-sans.woff2')}@font-face{font-family:Mono;src:url('/assets/fonts/plex-mono-400.woff2')}*{box-sizing:border-box}body{margin:0;background:#f7faf9;color:#193237;font:26px/1.45 Plex,sans-serif}.slide{width:1600px;height:900px;padding:44px 56px;display:grid;grid-template-rows:auto 1fr auto;gap:28px}header,footer{display:flex;justify-content:space-between;color:#536e71;font-size:21px}main{display:grid;grid-template-columns:1fr 1.2fr;gap:42px;align-items:center;min-height:0}h1{font-size:42px;line-height:1.12;margin:0 0 24px}p{margin:14px 0}pre{padding:20px;border:1px solid #75918b;border-radius:8px;background:#eaf1f7;font:22px/1.4 Mono,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.stage,.node{border:1px solid #75918b;padding:16px 20px;margin:10px 0;border-radius:6px;background:#e5f3ec}.stage strong,.stage span{display:block}.arrow{text-align:center;color:#146653}.chip{border:2px solid #146653;padding:16px;border-radius:8px}.chip h2{font-size:28px;margin:0 0 12px}.node{background:white;font-size:24px}.focus{border:3px solid #146653;background:#e5f3ec}small{font-size:21px} .scope{font-size:23px;color:#536e71}`;
for (const [index, lesson] of v2Course.entries()) {
  if (!lessonContexts[lesson.slug]) continue;
  const c = lessonContexts[lesson.slug];
  const hardware = `<div><h2>GPU device</h2><div class="chip"><h2>GPU compute chip</h2><div class="node${['sm','scheduler','execution','registers','shared','banks','tensor','global'].includes(c.focus)?' focus':''}"><strong>SM</strong><br>${({sm:'Assigned blocks and their threads',global:'Load/store units → L1 cache',scheduler:'Resident warps → scheduler → execution units',execution:'Warp instructions and participating lanes',registers:'Registers ↔ execution units',shared:'Registers and per-block shared memory',banks:'Shared-memory banks',tensor:'Register fragments ↔ tensor cores'})[c.focus] ?? 'Registers, execution units and local storage'}</div><div class="arrow">↕ Memory requests / returned data</div><div class="node">On-chip interconnect and shared L2 cache</div>${c.focus==='copy'?'<div class="node focus">Copy engines ↔ host memory</div>':''}</div><div class="arrow">↕ Data transfers</div><div class="node${c.focus==='memory'?' focus':''}">Device memory · GPU arrays</div><p class="scope">Logical groups use shared physical resources.</p></div>`;
  const scenes = [
    {title:'Read the CUDA example', text:c.explanation, visual:`<pre>${escape(c.code)}</pre>`},
    {title:'Follow execution', text:c.stages.map(([a,b])=>a+'. '+b).join(' '), visual:c.stages.map(([a,b],i)=>`${i?'<div class="arrow">↓</div>':''}<div class="stage"><strong>${escape(a)}</strong><span>${escape(b)}</span></div>`).join('')},
    {title:'Locate the hardware', text:c.hardware, visual:hardware},
  ].map((scene,i)=>({...scene,html:`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><article class="slide"><header><strong>GPU Lab V2 · Lesson ${index+1}</strong><span>${i+1} / 3</span></header><main><div><h1>${escape(scene.title)}</h1><p>${escape(scene.text)}</p></div><div>${scene.visual}</div></main><footer><span>Conceptual example · no hardware timing trace</span><span>© 2026 Christopher Snow</span></footer></article></body></html>`}));
  inputs.push({slug:lesson.slug, title:lesson.title, scenes});
}
await mkdir('test-results/v2-recordings', {recursive:true});
await writeFile('test-results/v2-recordings/inputs.json', JSON.stringify(inputs));
