// Copyright © 2026 Christopher Snow.
// One relationship per shot; the lower third is reserved for native captions.
import {escape} from '../src/continuation-ui.mjs';
import {starterFor} from '../content/v2-lesson-context.mjs';
import {simulateIntro} from '../src/hello-model.mjs';
export const introExample=simulateIntro(4,2,true,4);
export const introPrediction=simulateIntro(4,4,true,4);
const selected=2, original=introExample.output[selected], changed=introPrediction.output[selected];
const thread=introExample.threads.find(t=>t.i===selected);
const fmt=n=>n.toFixed(1);
const vertical=n=>Math.round(n*.8*1000)/1000;
const label=(x,y,value,kind='label')=>`<text x="${x}" y="${vertical(y)}" class="${kind}">${escape(String(value))}</text>`;
const box=(x,y,w,h,kind='box')=>`<rect x="${x}" y="${vertical(y)}" width="${w}" height="${vertical(h)}" rx="7" class="${kind}"/>`;
const arrow=(x,y,x2,y2)=>`<path d="M${x} ${vertical(y)} L${x2} ${vertical(y2)}" class="arrow" marker-end="url(#arrow)"/>`;
const defs='<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#146653"/></marker></defs>';
const svg=(body,height=220)=>`<svg viewBox="0 0 1200 ${vertical(height)}" style="height:${vertical(height)}px" role="img" aria-label="Illustrated data and execution relationships">${defs}${body}</svg>`;
const code=(source,note='CUDA C++')=>`<div class="code"><p>${escape(note)}</p><pre>${escape(source)}</pre></div>`;
const note=text=>`<p class="definition">${escape(text)}</p>`;
function validate(){
 const a=starterFor('first-kernel'),b=starterFor('one-thread-one-element');
 for(const s of ['output[0] = 42.0f;','hello<<<1, 1>>>(output);','float value = 0.0f;', 'cudaMemcpy(&value, output, sizeof(value), cudaMemcpyDeviceToHost)'])if(!a.includes(s))throw Error('Review the changed L1 starter: '+s);
 for(const s of ['const int threadsPerBlock = 4;','1.0f, 2.0f, 3.0f, 4.0f, 5.0f','output[i] = input[i] * 2.0f;'])if(!b.includes(s))throw Error('Review the changed L2 starter: '+s);
}
function scalarDevice(stage){
 const showSM=['sm','store'].includes(stage);
 let s=box(4,20,324,180)+label(28,65,'CPU')+label(28,118,'main()','mono');
 s+=box(450,4,746,212,'domain')+label(472,39,'GPU device');
 s+=box(470,54,320,146,'chip')+label(486,86,'Compute chip','small');
 if(showSM)s+=box(486,100,288,86,stage==='sm'?'active':'box')+label(502,137,'SM')+label(502,174,'Executes threads','small');
 s+=box(880,54,296,146,stage==='store'?'active':'box')+label(898,89,'GPU memory')+label(898,129,'output[0]','mono')+label(898,180,stage==='store'?'42.0':'Reserved','number');
 if(stage==='launch')s+=arrow(330,111,467,111)+label(346,94,'Launch','small');
 if(stage==='store')s+=arrow(792,151,877,151);
 return svg(s);
}
function scalarMemory(stage){
 const cpu=stage==='predict'?'0.0 or 42.0?':stage==='copied'?'42.0':stage==='copy'?'0.0 → 42.0':'0.0';
 let s=box(4,8,460,180)+label(28,51,'GPU memory')+label(28,109,'output[0]','mono')+label(28,161,'42.0','number');
 s+=box(736,8,460,180,stage==='copied'?'active':'box')+label(760,51,'CPU memory')+label(760,109,'value','mono')+label(760,161,cpu,stage==='predict'?'mono':'number');
 if(stage==='copy')s+=arrow(468,105,733,105)+label(555,85,'Copy');
 return svg(s,200);
}
function scalarVisual(stage){
 if(stage==='question')return `<div class="question"><div><span>GPU writes</span><strong>42.0</strong></div><b>How?</b><div><span>CPU prints</span><strong>42.0</strong></div></div>`;
 if(stage==='kernel')return code(starterFor('first-kernel').match(/^__global__[^]*?^}/m)[0],'CUDA C++ · hello kernel');
 if(stage==='allocate')return note('The supplied program reserves GPU storage.')+scalarDevice(stage);
 if(stage==='launch')return code('hello<<<1, 1>>>(output);','CUDA C++ · launch inside main()')+scalarDevice(stage);
 if(stage==='sm')return note('SM = streaming multiprocessor')+scalarDevice(stage);
 if(stage==='store')return code('output[0] = 42.0f;','CUDA C++ · inside hello')+scalarDevice(stage);
 if(stage==='initialise')return code('float value = 0.0f;','CUDA C++ · CPU variable inside main()')+scalarMemory(stage);
 if(stage==='predict')return note('Before the copy: what does value hold?')+scalarMemory(stage);
 if(stage==='before-copy')return note('Two locations hold separate values.')+scalarMemory(stage);
 if(stage==='copy')return code('cudaMemcpy(&value, output, sizeof(value),\n           cudaMemcpyDeviceToHost);','CUDA C++ · result copy inside main()')+scalarMemory(stage);
 if(stage==='copied')return note('The result is now in CPU memory.')+scalarMemory(stage);
 if(stage==='print')return code('std::printf("%.1f\\n", value);','CUDA C++ · print inside main()')+svg(box(4,25,350,170)+label(28,70,'CPU memory')+label(28,132,'value: 42.0','mono')+arrow(358,112,447,112)+box(450,25,300,170,'chip')+label(478,70,'CPU')+label(478,132,'main()','mono')+arrow(754,112,843,112)+box(846,25,350,170)+label(870,70,'Console')+label(870,139,'42.0','number'));
 if(stage==='summary')return summary([['Execute','SM runs the thread'],['Store','GPU memory holds 42.0'],['Copy','CPU variable receives 42.0']]);
 if(stage==='transfer')return `<div class="summary"><p><b>GPU thread</b><code>output[0] = 42.0f;</code></p><p><b>CPU copy</b><code>cudaMemcpy</code></p><p><b>CPU print</b><code>std::printf</code></p></div>`;
 throw Error('Unknown L1 shot '+stage);
}
function summary(rows){return `<div class="summary">${rows.map(([a,b])=>`<p><b>${escape(a)}</b><span>${escape(b)}</span></p>`).join('')}</div>`;}
function arrayRow(){return svg(label(16,40,'GPU memory · input array')+introExample.input.map((v,i)=>{const x=88+i*220;return box(x,74,190,128,i===selected?'active':'box')+label(x+18,110,'index '+i,'small')+label(x+18,171,fmt(v),'number');}).join(''));}
function arrayDevice(){return svg(box(4,4,1192,212,'domain')+label(26,40,'GPU device')+box(26,58,540,142,'chip')+label(48,94,'Compute chip')+box(48,111,496,72,'active')+label(72,158,'SM · executes thread instructions')+box(750,58,424,142)+label(774,102,'GPU memory')+label(774,161,'Input and output arrays','small'));}
function arrayStep(stage){
 const calculated=['multiply','store','answer'].includes(stage),out=['store','answer'].includes(stage),result=stage==='answer'?changed:original;
 let s=box(4,4,1192,220,'domain')+label(26,40,'GPU device');
 s+=box(24,58,360,150,stage==='load'?'active':'box')+label(44,97,'GPU memory · input')+label(44,139,'input[2]','mono')+label(225,194,'3.0','number');
 s+=box(490,58,360,150,stage==='multiply'||stage==='answer'?'active':'chip')+label(510,96,'Compute chip · SM')+label(510,135,'Thread working value','small')+label(510,194,calculated?`3.0 → ${fmt(result)}`:'3.0','number');
 s+=box(910,58,266,150,out?'active':'box')+label(930,97,'GPU memory')+label(930,139,'output[2]','mono')+label(930,194,out?fmt(result):'To write','number');
 if(stage==='load')s+=arrow(388,151,487,151)+label(398,128,'Read','small');
 if(out)s+=arrow(854,151,907,151)+label(855,128,'Write','small');
 return svg(s,230);
}
function arrayVisual(stage){
 if(stage==='question')return `<div class="question"><div><span>Read input[2]</span><strong>3.0</strong></div><b>Which thread?</b><div><span>Write output[2]</span><strong>?</strong></div></div>`;
 if(stage==='prepared')return arrayRow();
 if(stage==='index')return code('i = blockIdx.x * blockDim.x + threadIdx.x;','CUDA C++ · index inside runKernel')+`<p class="equation">${thread.block} × ${introExample.size} + ${thread.local} = ${thread.i}</p><p class="definition">Block ${thread.block} · local thread ${thread.local} · array index ${thread.i}</p>`;
 if(stage==='positions')return code('output[i] = input[i] * 2.0f;','CUDA C++ · same index for input and output')+svg(box(4,40,460,150)+label(30,90,'Read input[2]')+label(30,155,'3.0','number')+arrow(468,115,733,115)+box(736,40,460,150)+label(762,90,'Write output[2]')+label(762,155,'Same index','mono'));
 if(stage==='sm')return note('SM = streaming multiprocessor')+arrayDevice();
 if(['load','multiply','store','answer'].includes(stage))return code(stage==='answer'?'output[i] = input[i] * 4.0f;':'output[i] = input[i] * 2.0f;','CUDA C++ · selected thread has i = 2')+arrayStep(stage);
 if(stage==='print')return `<div class="console"><p>Console · supplied starter result</p><pre>Output: [${introExample.output.join(', ')}]</pre></div>`;
 if(stage==='predict')return code('output[i] = input[i] * 4.0f;','CUDA C++ · change the multiplier inside runKernel')+`<div class="prediction"><p>input[2] = 3.0</p><p>Third Output value?</p><p>Which hardware does the multiply?</p></div>`;
 if(stage==='summary')return summary([['Index','Chooses input and output positions'],['SM','Performs the arithmetic'],['GPU memory','Holds the arrays']]);
 throw Error('Unknown L2 shot '+stage);
}
export function renderArchitectureFrame(slug,stage){return slug==='first-kernel'?scalarVisual(stage):arrayVisual(stage);}
export function renderIntroDeck(slug,scenes,scale=1){
 validate();const lesson=slug==='first-kernel'?1:2;
 return `<!doctype html><html lang="en-GB"><meta charset="utf-8"><link rel="icon" href="data:,"><title>GPU Lab · Lesson ${lesson} hardware walkthrough</title><style>
 @font-face{font-family:Plex;src:url('/assets/fonts/plex-sans.woff2')}@font-face{font-family:Mono;src:url('/assets/fonts/plex-mono-400.woff2')}*{box-sizing:border-box}body{margin:0;background:#f7faf9;color:#193237;font-family:Plex,sans-serif}.slide{width:${1280*scale}px;height:${720*scale}px;position:relative;break-after:page;overflow:hidden}.board{width:1280px;height:720px;padding:24px 40px;position:relative;transform:scale(${scale});transform-origin:top left}.brand{font-size:20px;color:#146653;display:flex;justify-content:space-between}h1{font-size:40px;line-height:1.25;font-weight:600;letter-spacing:-.6px;margin:12px 0 8px}.visual{position:absolute;top:114px;left:40px;right:40px;height:auto;display:block}.code{margin:0 0 8px}.code p,.console p{font-size:23px;color:#245b91;margin:0 0 5px;line-height:1.1}.code pre,.console pre{font:32px/1.25 Mono,monospace;color:#245b91;white-space:pre-wrap;margin:0}.definition{font-size:32px;margin:0 0 16px;color:#245b91}.caption-safe{position:absolute;top:390px;left:40px;right:40px;bottom:20px;border-top:0}.scope{position:absolute;top:440px;left:40px;margin:0;font-size:15px;color:#536e71}svg{width:100%;flex-shrink:0}svg text{font-family:Plex,sans-serif;font-size:30px;fill:#193237}.small{font-size:24px}.mono{font-family:Mono,monospace;font-size:29px}.number{font-size:41px;font-weight:600;fill:#146653}.box{fill:#fff;stroke:#9db7b0;stroke-width:2}.domain{fill:#f7faf9;stroke:#9db7b0;stroke-width:2}.chip{fill:#e5f3ec;stroke:#146653;stroke-width:2}.active{fill:#eaf1f7;stroke:#245b91;stroke-width:3}.arrow{fill:none;stroke:#146653;stroke-width:4}.question{display:flex;align-items:center;justify-content:space-around}.question div{display:flex;flex-direction:column;gap:18px;font-size:33px}.question strong{font-size:90px;color:#146653;font-weight:600}.question b{font-size:36px;font-weight:400}.summary p{display:grid;grid-template-columns:240px 1fr;gap:30px;font-size:32px;line-height:1.2;margin:12px 0}.summary b{color:#146653}.summary code{font-family:Mono,monospace;font-size:inherit}.equation{font-size:56px;font-weight:600;margin:12px 0;color:#146653}.prediction p{font-size:32px;line-height:1.2;margin:8px 0}.trace .code{margin-bottom:12px}.trace pre{font-size:30px}.console{border-left:4px solid #146653;padding:24px}.console pre{font-size:38px;color:#193237}@page{size:1280px 720px;margin:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.slide:last-child{break-after:auto}}
 </style><body>${scenes.map(s=>`<section class="slide" id="${s.id}"><div class="board"><header class="brand"><strong>GPU Lab · CUDA C++</strong><span>Lesson ${lesson} · Discrete GPU model · no timing claim</span></header><h1>${escape(s.title)}</h1><main class="visual">${renderArchitectureFrame(slug,s.stage)}</main><div class="caption-safe" aria-hidden="true"></div></div></section>`).join('')}</body></html>`;
}
