// Copyright © 2026 Christopher Snow.
// Review-only deck. Does not change the published recording or saved learner work.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const scenes=JSON.parse(fs.readFileSync(path.join(here,'scenes.json')));
const starter=fs.readFileSync(path.resolve(here,'../../examples/first-kernel.cu'),'utf8');
for(const fragment of ['__global__ void hello(float* output)', 'output[0] = 42.0f;',
 'hello<<<1, 1>>>(output);', 'float value = 0.0f;',
 'cudaMemcpy(&value, output, sizeof(value), cudaMemcpyDeviceToHost)',
 'std::printf("%.1f\\n", value);']) {
 if(!starter.includes(fragment))throw Error('Review recording against changed starter: '+fragment);
}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,cls='label')=>`<text x="${x}" y="${y}" class="${cls}">${esc(s)}</text>`;
const box=(x,y,w,h,cls='box')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/>`;
const arrow=(x,y,x2,y2)=>`<path d="M${x} ${y} L${x2} ${y2}" class="arrow" marker-end="url(#arrow)"/>`;
const defs='<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#146653"/></marker></defs>';
const code=(source,note='CUDA C++')=>`<div class="code"><span>${esc(note)}</span><pre>${esc(source)}</pre></div>`;
const wrap=body=>`<svg viewBox="0 0 1200 300" role="img">${defs}${body}</svg>`;
function architecture(stage){
 const cpuKnown=['initialise','before-copy'].includes(stage)?'0.0':['copied'].includes(stage)?'42.0':stage==='predict'?'Predict':'Not shown';
 const stored=['store','initialise','predict','before-copy','copy','copied'].includes(stage);
 const showSM=!['allocate','launch'].includes(stage);
 let s=box(4,4,416,278,'domain')+text(24,42,'CPU side')+box(24,62,376,99)+text(44,100,'CPU')+text(44,139,'main()','mono');
 if(['initialise','predict','before-copy','copy','copied'].includes(stage))s+=box(24,177,376,86)+text(44,211,'CPU memory')+text(44,252,`value: ${stage==='copy'?'0.0 → 42.0':cpuKnown}`,'mono');
 s+=box(562,4,634,278,'domain')+text(582,42,'GPU device');
 s+=box(582,62,274,201,'chip')+text(602,103,'Compute chip');
 if(showSM)s+=box(602,123,234,117,stage==='sm'?'active':'box')+text(622,170,'SM')+text(622,210,'Executes threads','small');
 s+=box(900,62,276,201,stage==='store'?'active':'box')+text(920,103,'GPU memory');
 s+=text(920,168,'output[0]','mono')+text(920,224,stored?'42.0':'Reserved','number');
 if(stage==='launch')s+=arrow(402,111,579,111)+text(440,92,'Launch','small');
 if(stage==='store')s+=arrow(838,202,897,202);
 if(stage==='copy')s+=`<path d="M1035 264 V293 H210 V264" class="arrow" marker-end="url(#arrow)"/>`;
 return wrap(s);
}
function visual(stage){
 if(stage==='question')return `<div class="question"><div><span>GPU writes</span><strong>42.0</strong></div><b>How?</b><div><span>CPU prints</span><strong>42.0</strong></div></div>`;
 if(stage==='kernel')return code('__global__ void hello(float* output) {\n    output[0] = 42.0f;\n}','CUDA C++ · complete hello kernel');
 if(stage==='print')return code('std::printf("%.1f\\n", value);','CUDA C++ · inside main()')+wrap(box(4,40,350,200)+text(26,85,'CPU memory')+text(26,157,'value: 42.0','mono')+arrow(356,144,447,144)+box(450,40,300,200,'chip')+text(480,85,'CPU')+text(480,157,'main()','mono')+arrow(752,144,843,144)+box(846,40,350,200)+text(872,85,'Console')+text(872,172,'42.0','number'));
 if(stage==='summary')return `<div class="summary"><p><b>Execute</b><span>SM runs the thread</span></p><p><b>Store</b><span>GPU memory holds 42.0</span></p><p><b>Copy</b><span>CPU variable receives 42.0</span></p></div>`;
 if(stage==='transfer')return `<div class="trace">${code('output[0] = 42.0f;','GPU thread · write')}${code('cudaMemcpy(&value, output, sizeof(value),\n           cudaMemcpyDeviceToHost);','CPU code · copy')}${code('std::printf("%.1f\\n", value);','CPU code · print')}</div>`;
 const snippets={launch:'hello<<<1, 1>>>(output);',store:'output[0] = 42.0f;',initialise:'float value = 0.0f;',copy:'cudaMemcpy(&value, output, sizeof(value),\n           cudaMemcpyDeviceToHost);',copied:'value = 42.0  // result after the copy'};
 if(stage==='copy')return code('cudaMemcpy(&value, output, sizeof(value),\n           cudaMemcpyDeviceToHost);','CUDA C++ · inside main()')+`<svg class="copy-detail" viewBox="0 0 1200 250">${defs}${box(4,25,460,200)+text(28,70,'GPU memory')+text(28,140,'output[0]: 42.0','mono')+arrow(468,130,729,130)+text(530,105,'Copy','label')+box(734,25,462,200)+text(758,70,'CPU memory')+text(758,140,'value: 0.0 → 42.0','mono')}</svg>`;
 const top=stage==='sm'?'<p class="definition">SM = streaming multiprocessor</p>':stage==='predict'?'<p class="definition">Before the copy: value = 0.0 or 42.0?</p>':stage==='copied'?'<p class="definition">The result is now in CPU memory.</p>':stage==='before-copy'?'<p class="definition">Different storage, separate values</p>':stage==='allocate'?'<p class="definition">GPU storage is already in the supplied program.</p>':code(snippets[stage],stage==='store'?'CUDA C++ · inside hello':stage==='copied'?'State after the copy':'CUDA C++ · inside main()');
 return top+architecture(stage);
}
const html=`<!doctype html><html lang="en-GB"><meta charset="utf-8"><title>GPU Lab · Lesson 1 recording review</title><style>
@font-face{font-family:Plex;src:url('../../assets/fonts/plex-sans.woff2')}@font-face{font-family:Mono;src:url('../../assets/fonts/plex-mono-400.woff2')}*{box-sizing:border-box}body{margin:0;background:#f7faf9;color:#193237;font-family:Plex,sans-serif}.slide{width:1280px;height:720px;position:relative;padding:24px 40px;overflow:hidden;break-after:page}.brand{font-size:22px;color:#146653;display:flex;justify-content:space-between}h1{font-size:43px;line-height:1.25;font-weight:600;margin:20px 0 22px;letter-spacing:-.6px}.visual{height:380px;display:flex;flex-direction:column;justify-content:center}.code{margin:0 0 20px}.code span{display:block;font-size:23px;color:#245b91;margin-bottom:8px}.code pre{font:32px/1.4 Mono,monospace;color:#245b91;white-space:pre-wrap;margin:0}.definition{font-size:34px;margin:0 0 22px;color:#245b91}.caption{position:absolute;left:40px;right:40px;bottom:64px;height:102px;border-top:2px solid #b8cec7;padding:14px 24px 0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:30px;line-height:1.25;color:#193237;background:#f7faf9}svg{width:100%;height:300px;flex-shrink:0}svg text{font-family:Plex,sans-serif;font-size:30px;fill:#193237}.copy-detail{height:250px}.small{font-size:24px}.mono{font-family:Mono,monospace;font-size:29px}.number{font-size:43px;font-weight:600;fill:#146653}.box{fill:#fff;stroke:#9db7b0;stroke-width:2}.domain{fill:#f7faf9;stroke:#9db7b0;stroke-width:2}.chip{fill:#e5f3ec;stroke:#146653;stroke-width:2}.active{fill:#eaf1f7;stroke:#245b91;stroke-width:3}.arrow{fill:none;stroke:#146653;stroke-width:4}.question{display:flex;align-items:center;justify-content:space-around}.question div{display:flex;flex-direction:column;gap:18px;font-size:38px}.question strong{font-size:105px;color:#146653;font-weight:600}.question b{font-size:45px;font-weight:400}.summary p{display:grid;grid-template-columns:240px 1fr;gap:45px;font-size:40px;line-height:1.5;margin:20px 50px}.summary b{color:#146653}.trace .code{margin:0 0 22px}.trace pre{font-size:33px} @page{size:1280px 720px;margin:0}
</style><body>${scenes.map(s=>`<section class="slide" id="${s.id}"><header class="brand"><strong>GPU Lab · CUDA C++</strong><span>Lesson 1 · Illustrated data flow</span></header><h1>${esc(s.step)}</h1><div class="visual">${visual(s.stage)}</div><div class="caption">${esc(s.text)}</div></section>`).join('')}</body></html>`;
fs.writeFileSync(path.join(here,'deck.html'),html);
console.log('Rendered review-only deck:',scenes.length,'shots');
