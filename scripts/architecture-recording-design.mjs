// Copyright © 2026 Christopher Snow.
// Course-specific visual language: ownership, participation and data movement.
import {escape} from '../src/continuation-ui.mjs';
import {fp} from './architecture-recording-models.mjs';
export const text=(x,y,value,kind='label',anchor='start')=>`<text x="${x}" y="${y}" class="${kind}" text-anchor="${anchor}">${escape(String(value))}</text>`;
export const rect=(x,y,w,h,kind='box')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${kind}"/>`;
export const arrow=(x,y,x2,y2,kind='arrow')=>`<path d="M${x} ${y} L${x2} ${y2}" class="${kind}" marker-end="url(#arrow)"/>`;
export const svg=body=>`<svg viewBox="0 0 1200 300" role="img"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#146653"/></marker></defs>${body}</svg>`;
export function values(label,items,{y=55,highlight=[],integer=false,kind='active'}={}){
 const width=1120/items.length;
 return text(40,y-18,label,'small')+items.map((v,i)=>{
  const x=40+i*width;
  return rect(x,y,width-10,92,highlight.includes(i)?kind:'box')+text(x+(width-10)/2,y+62,v===null?'?':typeof v==='number'&&!integer?fp(v):v,'value','middle');
 }).join('');
}
export const array=(label,items,options={})=>svg(values(label,items,options));
export function compare(left,right,{question=false}={}){
 return svg([left,right].map((card,i)=>{const x=24+i*610;return rect(x,30,560,230,i?'active':'box')+text(x+30,78,card[0],'label')+text(x+280,166,card[1],'big','middle')+text(x+30,224,card[2]||'','small');}).join('')+(question?text(600,295,'Pause before continuing','small','middle'):''));
}
export function flow(nodes,{active=-1,notes=[],directions=[]}={}){
 const width=1140/nodes.length;
 return svg(nodes.map((node,i)=>{
  const x=25+i*width;
  return rect(x,45,width-42,175,i===active?'active':node.kind||'box')+
   (node.title instanceof Array?node.title:[node.title]).map((v,j)=>text(x+20,93+j*42,v,'label')).join('')+
   (String(node.value||'').length<=10?text(x+20,190,node.value||'','value'):
    text(x+20,190,node.value||'','node-detail'))+(i<nodes.length-1&&directions[i]!==false?(directions[i]==='left'?arrow(x+width-7,135,x+width-40,135):arrow(x+width-40,135,x+width-7,135)):'');
 }).join('')+notes.map((v,i)=>text(35,263+i*32,v,'small')).join(''));
}
export function captionCode(code,note='CUDA C++'){
 return `<div class="code"><p>${escape(note)}</p><pre>${escape(code)}</pre></div>`;
}
export function matrixGrid(data,x,y,{size=76,kind='box',label=''}={}){
 return (label?text(x,y-18,label,'small'):'')+data.map((row,r)=>row.map((v,c)=>rect(x+c*size,y+r*size,size-6,size-6,kind)+text(x+c*size+(size-6)/2,y+r*size+size*.69,typeof v==='number'?fp(v):v,'matrix-value','middle')).join('')).join('');
}
export function blockWarps(model,{guard=true}={}){
 const blocks=model.blocks,size=model.threads.length/blocks,w=blocks===1?100:154;
 let body=rect(12,2,1176,290,'chip')+text(30,40,'SM · illustrative placement','small');
 for(let b=0;b<blocks;b++){
  const y=60+b*112;
  body+=text(32,y+25,`Block ${b}`,'label')+text(32,y+62,'its own warp','small');
  for(let t=0;t<size;t++){
   const i=b*size+t,x=245+t*w;
   body+=rect(x,y,w-10,75,guard&&model.threads[i].output===null?'guard':'active')+text(x+(w-10)/2,y+51,i,'value','middle');
  }
  body+=text(blocks===1?245:925,y+102,`${32-size} not launched`,'small');
 }
 return svg(body);
}
export function smState(frame){
 const a=frame.warps[0],b=frame.warps[1],operation=frame.arithmetic;
 return svg(rect(8,5,1184,287,'chip')+text(30,47,'One SM · shared execution hardware','label')+
  rect(30,70,355,185,'box')+text(50,109,'Warp A values','label')+text(50,170,a.result?fp(a.result[0]):a.loaded?fp(a.loaded[0]):'Pending','value')+text(50,228,a.status,'small')+
  rect(430,87,340,148,operation?'active':'box')+text(450,132,'Arithmetic units','label')+text(450,190,operation?`${fp(operation.input[0])} → ${fp(operation.result[0])}`:'Shared by warps','small')+
  rect(815,70,355,185,'box')+text(835,109,'Warp B values','label')+text(835,170,b.result?fp(b.result[0]):b.loaded?fp(b.loaded[0]):'Pending','value')+text(835,228,b.status,'small')+
  (operation?arrow(operation.warp==='A'?385:810,158,operation.warp==='A'?426:775,158):''));
}
export function sectors(model){
 const n=model.sectors.length;
 return svg(text(30,40,'32 lane addresses from one load instruction','label')+
  [0,1,2].map((i)=>{const l=model.lanes[i],x=30+i*255;return rect(x,76,235,145,'box')+text(x+18,116,`Lane ${i}`,'label')+text(x+18,170,`byte ${l.address}`,'value')+text(x+18,207,`sector ${l.sector}`,'small');}).join('')+
  rect(845,58,320,180,'active')+text(1005,132,n,'big','middle')+text(1005,189,'addressed sectors','small','middle')+
  text(30,280,`${model.usefulBytes} useful bytes · ${model.coveredBytes} bytes covered by aligned sectors`,'small'));
}
export function masks(model,path='all'){
 const shown=model.lanes.slice(0,8);
 return svg(text(30,40,'One 32-thread warp · first eight lanes shown','label')+shown.map((l,i)=>{
  const x=30+i*144,on=path==='all'||l.path===path;
  return rect(x,72,130,145,on?'active':'quiet')+text(x+65,112,`Lane ${i}`,'small','middle')+text(x+65,176,fp(path==='all'?l.output:l.input),'value','middle');
 }).join('')+text(30,274,path==='all'?'The same threads continue with their own results.':`${model.lanes.filter(l=>l.path===path).length} lanes participate in the ${path} path.`,'label'));
}
export function bankView(model){
 return svg(text(30,40,'SM shared memory · bank = word index modulo 32','label')+
  model.lanes.slice(0,3).map((l,i)=>{const x=30+i*255;return rect(x,80,230,145,'box')+text(x+18,121,`Lane ${i}`,'label')+text(x+18,171,`word ${l.word}`,'value')+text(x+18,211,`bank ${l.bank}`,'small');}).join('')+
  rect(845,75,325,155,'active')+text(1005,145,model.rounds,'big','middle')+text(1005,201,`model service round${model.rounds===1?'':'s'}`,'small','middle')+
  text(30,278,`${model.distinctWords} distinct word${model.distinctWords===1?'':'s'} · ${model.banksUsed} bank${model.banksUsed===1?'':'s'} used`,'small'));
}
export function gate({arrivals=8,readers=4,phase='ready'}={}){
 return svg(rect(12,6,1176,287,'chip')+text(32,46,'One block on an SM','label')+
  rect(40,80,330,155,'box')+text(60,122,'Shared values','label')+text(205,191,phase==='bad'?'Unordered':'Published','value','middle')+
  rect(462,65,280,185,phase==='bad'?'guard':'active')+text(602,130,arrivals,'big','middle')+text(602,190,'barrier arrivals','small','middle')+
  rect(835,80,320,155,'box')+text(855,122,'Next operation','label')+text(995,191,phase==='bad'?'Not valid':`${readers} reader${readers===1?'':'s'}`,'value','middle')+
  arrow(374,160,457,160)+(phase==='bad'?'':arrow(747,160,830,160))+text(40,277,phase==='bad'?'Invalid participation: no valid result is defined.':'Shared-memory ownership and barrier participation belong to the block.','small'));
}
export function tileView(example,phase=0,{before=false}={}){
 const p=example.phases[phase];
 return svg(rect(12,4,1176,290,'chip')+text(32,40,'SM · one block’s tile and private working sums','label')+
  matrixGrid(p.left,35,96,{size:96,kind:'active',label:'Shared A tile'})+matrixGrid(p.right,285,96,{size:96,kind:'active',label:'Shared B tile'})+
  arrow(510,175,650,175)+matrixGrid(p.sums.map((row,r)=>row.map((_,c)=>`C${r}${c}`)),680,92,{size:86,label:'Private sums'})+
  text(900,112,`K ${p.begin}–${p.begin+example.tile-1}`,'label')+text(900,164,'C00 so far','small')+text(900,220,fp(before?0:p.sums[0][0]),'value')+text(35,280,'All block threads arrive before reading and before reusing the tiles.','small'));
}
export function cacheView(example,{append=false}={}){
 return svg(text(28,40,'GPU memory · key and value arrays','label')+
  rect(30,72,600,170,'box')+text(55,118,`${example.cached} old token slots`,'label')+text(55,185,`${example.readBytes} bytes to inspect`,'value')+
  rect(715,72,455,170,append?'active':'quiet')+text(740,118,`Append at slot ${example.cached}`,'label')+text(740,185,`${example.appendBytes} bytes`,'value')+
  text(30,282,`${example.capacity} reserved slots · ${example.width} FP32 values per key and per value`,'small'));
}
export function routingView(model,{focus=5,show=true}={}){
 const bin=model.input[focus],rank=model.ranks[focus],dest=model.destinations[focus];
 return svg(text(28,42,`Token ${focus} · category ${bin}`,'label')+
  rect(28,75,340,155,'box')+text(48,118,'Category start','label')+text(198,192,model.offsets[bin],'big','middle')+
  text(405,172,'+','big')+rect(490,75,290,155,'box')+text(510,118,'Earlier matches','label')+text(635,192,rank,'big','middle')+
  arrow(790,155,867,155)+rect(875,75,295,155,'active')+text(895,118,'Destination','label')+text(1020,192,show?dest:'?','big','middle')+
  text(30,280,'Completed counts and prefix ranks choose the address before the write.','small'));
}
export function renderArchitectureDeck(plan,scenes=plan.scenes,scale=1){
 return `<!doctype html><html lang="en-GB"><meta charset="utf-8"><link rel="icon" href="data:,"><title>${escape(plan.title)}</title><style>
 @font-face{font-family:Plex;src:url('/assets/fonts/plex-sans.woff2')}@font-face{font-family:Mono;src:url('/assets/fonts/plex-mono-400.woff2')}*{box-sizing:border-box}body{margin:0;background:#f7faf9;color:#193237;font-family:Plex,sans-serif}.slide{width:${1280*scale}px;height:${720*scale}px;position:relative;overflow:hidden;break-after:page}.board{width:1280px;height:720px;position:relative;transform:scale(${scale});transform-origin:top left;padding:24px 40px}.brand{display:flex;justify-content:space-between;font-size:20px;color:#146653}h1{font-size:44px;line-height:1.16;letter-spacing:-.6px;font-weight:600;margin:18px 0 0}.visual{position:absolute;left:40px;right:40px;top:124px;height:306px;display:flex;flex-direction:column;justify-content:center}.visual svg{width:100%;height:300px;flex-shrink:0;overflow:visible}.scope{position:absolute;top:440px;left:40px;right:40px;font-size:18px;color:#536e71;margin:0}.caption-safe{position:absolute;left:40px;right:40px;top:472px;bottom:20px;border-top:1px solid #b8cec7}.box{fill:white;stroke:#9db7b0;stroke-width:2}.chip{fill:#e5f3ec;stroke:#146653;stroke-width:2}.active{fill:#eaf1f7;stroke:#245b91;stroke-width:3}.guard{fill:#fbf0db;stroke:#a46a16;stroke-width:3}.quiet{fill:#edf2ef;stroke:#b8cec7;stroke-width:2}.arrow{fill:none;stroke:#146653;stroke-width:4}svg text{fill:#193237;font-family:Plex,sans-serif}.label{font-size:34px;font-weight:600}.small{font-size:26px}.node-detail{font-size:32px;font-weight:600}.value{font-size:48px;font-weight:600;fill:#146653}.big{font-size:76px;font-weight:600;fill:#146653}.matrix-value{font-size:32px;font-weight:600}.code p{font-size:26px;color:#245b91;margin:0 0 18px}.code pre{font:42px/1.4 Mono,monospace;color:#245b91;white-space:pre-wrap;margin:0}.statement{font-size:50px;line-height:1.35;color:#146653;font-weight:600;max-width:1100px;margin:0}.statement small{display:block;font-size:34px;color:#193237;margin-top:28px;font-weight:400}@media print{@page{size:1280px 720px;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.slide:last-child{break-after:auto}}
 </style><body>${scenes.map(s=>`<section class="slide" id="${s.id}"><div class="board"><header class="brand"><strong>GPU Lab · CUDA C++</strong><span>Lesson ${plan.lesson}</span></header><h1>${escape(s.title)}</h1><main class="visual">${s.visual()}</main><p class="scope">${escape(s.scope||plan.scope)}</p><div class="caption-safe" aria-hidden="true"></div></div></section>`).join('')}</body></html>`;
}
export const statement=(main,detail='')=>`<p class="statement">${escape(main)}${detail?`<small>${escape(detail)}</small>`:''}</p>`;
