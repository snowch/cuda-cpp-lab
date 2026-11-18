// Copyright © 2026 Christopher Snow.
// Original progressive architecture map, linked to the actual editable starters.
import { escape } from '../src/continuation-ui.mjs';
import { simulateIntro } from '../src/hello-model.mjs';
import { starterFor } from '../content/v2-lesson-context.mjs';
import first from '../content/first-kernel-scenes.json' with {type:'json'};
import second from '../content/one-thread-one-element-scenes.json' with {type:'json'};
export const introScenes = {'first-kernel':first,'one-thread-one-element':second};
export const introExample = simulateIntro(4,2,true,4);
export const introPrediction = simulateIntro(4,4,true,4);
const program=starterFor('one-thread-one-element');
if(!program.includes('const int threadsPerBlock = 4;') || !program.includes('1.0f, 2.0f, 3.0f, 4.0f, 5.0f') || !program.includes('output[i] = input[i] * 2.0f;')) throw Error('Review recording against changed starter');
const text=(x,y,v,c='body')=>`<text x="${x}" y="${y}" class="${c}">${escape(String(v))}</text>`;
const rect=(x,y,w,h,c='panel')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${c}"/>`;
const arrow=(path,label,x,y)=>`<path d="${path}" class="arrow" marker-end="url(#arrow)"/>${text(x,y,label,'arrow-label')}`;
const fmt=n=>n.toFixed(1);

export function architectureFrame(slug,stage){
 const two=slug==='one-thread-one-element',selected=['index','load','multiply','store','answer'].includes(stage);
 if(!starterFor('first-kernel').includes('output[0] = 42.0f;'))throw Error('Review changed starter');
 const value=['copy','print'].includes(stage)?'42.0':stage==='answer'?'13.0':'?';
 let s=`<svg viewBox="0 0 724 476" role="img" aria-label="CPU and system RAM beside GPU device; compute chip contains the SM, separate from device memory." xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#146653"/></marker></defs>`;
 s+=rect(2,2,720,470,'system')+text(17,25,'Computer / system','small');
 s+=rect(14,38,181,420,'domain')+text(29,65,'Host · CPU side','heading');
 s+=rect(27,84,155,89)+text(41,111,'CPU','heading')+text(41,142,'main()','mono');
 s+=rect(27,194,155,70)+text(41,220,'Console','heading')+text(41,247,two?'Output: […]':stage==='print'?'42.0':stage==='answer'?'13.0':'?','mono');
 s+=rect(27,292,155,112)+text(41,319,'System RAM','heading')+text(41,355,two?'CPU arrays':`value: ${value}`,'mono')+text(41,385,two?'x and y':'CPU variable','small');
 s+=rect(208,38,500,420,'domain')+text(224,64,'GPU device','heading');
 s+=rect(222,78,472,253,'chip')+text(236,103,'GPU compute chip','heading');
 s+=rect(238,115,440,200,'sm')+text(252,141,'SM · streaming multiprocessor','heading');
 if(two){
  s+=text(252,157,'Block 0 · indices 0–3','small')+text(464,157,'Block 1 · indices 4–7','small');
  for(const t of introExample.threads){const x=252+t.block*212+t.local*45;
   s+=rect(x,170,39,35,t.i===2&&selected?'selected':t.skipped&&stage==='guard'?'skipped':'logical')+text(x+19.5,194,t.i,'center');}
  if(['warps','guard'].includes(stage)){
   for(let b=0;b<2;b++){const x=252+b*212;
    for(let lane=0;lane<32;lane++)s+=rect(x+lane*5.8,218,4.3,15,lane<4?'occupied':'unoccupied');
    s+=text(x,260,'4 threads in a warp','small')+text(x,285,'28 positions unoccupied','small');}
  }else{
   s+=rect(252,230,188,65,stage==='load'?'selected':'panel')+text(264,254,'Registers','heading')+text(264,282,stage==='answer'?`3.0 → ${fmt(introPrediction.output[2])}`:stage==='load'?'thread 2: 3.0':stage==='multiply'?'3.0 → 6.0':stage==='store'?'thread 2: 6.0':'Thread working values','small');
   s+=rect(468,230,194,65,['multiply','answer'].includes(stage)?'selected':'panel')+text(480,254,'Execution units','heading')+text(480,282,stage==='answer'?`3.0 × ${fmt(introPrediction.factor)} = ${fmt(introPrediction.output[2])}`:stage==='multiply'?'3.0 × 2.0 = 6.0':'Shared hardware','small');
   if(['multiply','answer'].includes(stage))s+=arrow('M440 246 H466','',0,0)+arrow('M468 279 H442','',0,0);
  }
 }else{
  s+=rect(252,154,410,55,'logical')+text(269,179,['question','allocate'].includes(stage)?'No launch submitted yet':'Logical block · one thread','heading')+text(269,201,'Instructions from hello','small');
  s+=rect(252,230,410,65,stage==='execute'?'selected':'panel')+text(269,257,'Execution hardware','heading')+text(269,284,'Shared by many logical threads','small');
 }
 s+=rect(222,348,472,109,stage==='allocate'?'selected':'panel');
 if(!two)s+=text(240,378,'Device memory','heading')+text(240,413,`output[0]   ${['store','copy','print'].includes(stage)?'42.0':stage==='answer'?'13.0':'?'}`,'mono');
 else{
  s+=text(240,375,'Device memory','heading');
  for(const [row,label] of ['input','output'].entries()){
   s+=text(240,404+row*37,label,'mono');
   for(const [i,v] of introExample.input.entries()){
    const shown=row===0?fmt(v):stage==='answer'?fmt(introPrediction.output[i]):stage==='store'&&i===2?fmt(introExample.output[i]):stage==='guard'?fmt(introExample.output[i]):'?';
    const x=335+i*66;s+=rect(x,384+row*37,60,32,selected&&i===2?'selected':'panel')+text(x+30,407+row*37,shown,'center');
   }
  }
 }
 if(stage==='launch'||two&&stage==='placement')s+=arrow('M182 125 H235','Launch',190,89);
 if(!two&&stage==='store')s+=arrow('M662 297 V346','Store',607,340);
 if(!two&&stage==='copy')s+=arrow('M222 420 H105 V407','Copy result',52,445);
 if(!two&&stage==='print')s+=arrow('M105 290 V268','Print',112,283);
 if(two&&stage==='load')s+=arrow('M497 384 V340 H244 V265 H250','Read input[2]',510,328);
 if(two&&stage==='store')s+=arrow('M346 295 V334 H676 V418 H497 V420','Write output[2]',475,343);
 return s+'</svg>';
}

function source(slug,stage){
 if(slug==='first-kernel'){
  const p=starterFor(slug),kernel=p.match(/^__global__[^]*?^}/m)[0];
  const lines={allocate:'check(cudaMalloc(\n  &output, sizeof(float)));',launch:p.match(/hello<<<[^\n]+/)[0],copy:'cudaMemcpy(&value, output,\n  sizeof(value),\n  cudaMemcpyDeviceToHost);',print:'std::printf("%.1f\\n", value);'};
  const extra=lines[stage],changed=['predict','answer'].includes(stage);
  return `<p class="code-label">CUDA C++ · ${extra?'inside main()':'kernel on the GPU'}</p><pre>${escape(extra||kernel.replace('42.0f',changed?'13.0f':'42.0f'))}</pre><p class="code-note">${extra&&['copy','print'].includes(stage)?'Selected call; the complete program keeps its error checks.':stage==='predict'?'Predict before continuing. Pause playback for more time.':'The complete program stays in the lesson editor.'}</p>`;
 }
 if(['groups','placement','warps'].includes(stage))return `<p class="code-label">CUDA C++ · launch in main()</p><pre>const int threadsPerBlock = 4;\nconst int blocks =\n  (n + threadsPerBlock - 1)\n  / threadsPerBlock;\n\nrunKernel&lt;&lt;&lt;blocks,\n  threadsPerBlock&gt;&gt;&gt;(\n  d_x, d_y, n);</pre><p class="code-note">n = ${introExample.input.length} elements; ${introExample.blocks} blocks of ${introExample.size} threads. The two arrays already exist in device memory.</p>`;
 const highlights={index:'int i',load:'output[i]',multiply:'output[i]',store:'output[i]',guard:'if (i < n)',predict:'output[i]',answer:'output[i]'};
 let code=program.match(/^__global__[^]*?^}/m)[0].replace('    const float* input, float* output, int n','  const float* input,\n  float* output, int n').replace('    int i = blockIdx.x * blockDim.x + threadIdx.x;','  int i = blockIdx.x * blockDim.x\n        + threadIdx.x;').replace('        output','    output');
 if(['predict','answer'].includes(stage))code=code.replace('2.0f','4.0f');
 return `<p class="code-label">CUDA C++ · runKernel</p><pre>${code.split('\n').map(l=>`<span class="${highlights[stage]&&l.includes(highlights[stage])?'code-focus':''}">${escape(l)}</span>`).join('\n')}</pre><p class="code-note">${stage==='predict'?'Predict before continuing. Pause playback for more time.':stage==='guard'?'The three skipped threads still exist. They perform no guarded array access.':stage==='warps'?'Warp positions are logical grouping, not physical cores.':'Selected element: input[2] → output[2].'}</p>`;
}

export function introDeck(slug,scenes=introScenes[slug],scale=1){
 const lesson=slug==='first-kernel'?1:2;
 const css=`@font-face{font-family:Plex;src:url('/assets/fonts/plex-sans.woff2')}@font-face{font-family:Mono;src:url('/assets/fonts/plex-mono-400.woff2')}*{box-sizing:border-box}body{margin:0;background:#f7faf9;color:#193237;font-family:Plex,Arial,sans-serif}.slide{width:${1280*scale}px;height:${720*scale}px;position:relative;break-after:page}.board{width:1280px;height:720px;padding:20px 30px;transform:scale(${scale});transform-origin:top left}.mast,footer{display:flex;justify-content:space-between;font-size:16px;color:#536e71}.mast{padding-bottom:12px;border-bottom:1px solid #b8cec7}.mast strong{color:#146653}h1{font-size:33px;font-weight:600;line-height:1.15;margin:17px 0 7px;letter-spacing:-.5px}.lead{font-size:23px;margin:0 0 13px;line-height:1.3}.main{display:grid;grid-template-columns:420px 1fr;gap:22px;align-items:center;height:476px}.code-label{font-size:20px;color:#245b91;font-weight:600;margin:0 0 12px}pre{font:18px/1.6 Mono,monospace;white-space:pre-wrap;margin:0;padding:19px 16px;background:#eaf1f7;border-left:4px solid #245b91;border-radius:0 7px 7px 0}.code-focus{color:#175b8d;font-weight:700}.code-note{font-size:21px;line-height:1.4;max-width:35ch;margin:18px 0 0;color:#536e71}svg{width:100%;height:100%}svg text{font-family:Plex,Arial,sans-serif;fill:#193237;font-size:20px}.heading{font-size:20px;font-weight:600}.small{font-size:17px}.mono{font-family:Mono,monospace;font-size:19px}.center{text-anchor:middle;font-size:18px}.panel{fill:#fff;stroke:#9db7b0}.system{fill:none;stroke:#9db7b0}.domain{fill:#f3f1dc;stroke:#a9a67a}.chip{fill:#e5f3ec;stroke:#146653}.sm{fill:#f7faf9;stroke:#146653;stroke-width:2}.logical{fill:#edf2f6;stroke:#567c99;stroke-dasharray:5 3}.selected{fill:#d9ebf6;stroke:#245b91;stroke-width:2}.skipped{fill:#e6eae8;stroke:#71817b;stroke-dasharray:3 2}.occupied{fill:#245b91}.unoccupied{fill:none;stroke:#97a8a5}.arrow{fill:none;stroke:#146653;stroke-width:3}.arrow-label{font-size:17px;fill:#146653}footer{position:absolute;bottom:18px;left:30px;right:30px;font-size:15px}@page{size:1280px 720px;margin:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.slide:last-child{break-after:auto}}`;
 return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>GPU Lab · Lesson ${lesson} hardware walkthrough</title><style>${css}</style></head><body>${scenes.map((s,i)=>`<section class="slide" id="${s.id}"><div class="board"><header class="mast"><strong>GPU Lab · CUDA C++</strong><span>Lesson ${lesson} · ${introScenes[slug].findIndex(item=>item.id===s.id)+1} / ${introScenes[slug].length}</span></header><h1>${escape(s.title)}</h1><p class="lead">${escape(s.lead)}</p><main class="main"><div>${source(slug,s.stage)}</div>${architectureFrame(slug,s.stage)}</main><footer><span>${lesson===2?'Example placement · caches omitted · no instruction timing':'Simplified discrete NVIDIA GPU · caches omitted · no timing trace'}</span><span>© 2026 Christopher Snow</span></footer></div></section>`).join('')}</body></html>`;
}
