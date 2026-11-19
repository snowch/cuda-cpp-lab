// Copyright © 2026 Christopher Snow.
// Source offsets are recomputed after edits; saved source is never rewritten.
import {sourceExcerptRanges} from './cuda-excerpts.mjs';
export const lessonSourceFocus = {
  hello: {targets:['output\\s*\\[\\s*0\\s*\\]\\s*=[^;]*;'], kernel:'hello', label:'value assigned to output[0]'},
  scale: {targets:['output\\s*\\[\\s*i\\s*\\]\\s*=[^;]*;'], kernel:'runKernel', label:'assignment that multiplies input[i]'},
  bounds: {names:['threadsPerBlock'], label:'threadsPerBlock setting'},
  copies: {names:['x'], label:'input array x'},
  coalescing: {names:['stride'], label:'stride setting'},
  scheduling: {names:['warpsPerBlock'], label:'warpsPerBlock setting'},
  divergence: {names:['alternateSigns'], label:'alternateSigns setting'},
  reduction: {names:['threads'], label:'threads setting'},
  'shared-memory-banks': {names:['stride'], label:'stride setting'},
  matmul: {names:['tile','width'], label:'tile and width settings'},
  'matmul-investigation': {names:['tile','width'], label:'tile and width settings'},
  precision: {names:['narrowInputs'], label:'narrowInputs setting'},
  'tensor-cores': {names:['startingValue'], label:'startingValue setting'},
  attention: {names:['keysPerTile'], label:'keysPerTile setting'},
  inference: {names:['cached'], label:'cached setting'},
  histograms: {names:['categories','blockCounts'], label:'categories and blockCounts settings'},
  scan: {names:['inclusive'], label:'inclusive setting'},
  compaction: {names:['keepCategory'], label:'keepCategory setting'},
  progress: {names:['readers'], label:'readers setting'},
  pipelines: {names:['overlap'], label:'overlap setting'},
  'token-routing': {names:['hot'], label:'hot setting'},
  'verify-every-output': {names:['correctIndex','count'], label:'correctIndex and count settings'},
  'grid-stride-loops': {names:['count','blocks'], label:'count and blocks settings'},
  'multi-block-scan': {names:['count'], label:'count setting'},
  'softmax-capstone': {body:'rowSoftmax', label:'body of rowSoftmax'},
};

export function sourceFocusRanges(source, mode, excerpts=[]) {
  const config=lessonSourceFocus[mode];
  if(!config)return null;
  const code=source.replace(/\/\/[^\n]*|\/\*[^]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,t=>t.replace(/[^\n]/g,' '));
  const kernels=[];
  for(const match of code.matchAll(/\b__global__\s+void\s+(\w+)\s*\([^)]*\)\s*\{/g)) {
    let depth=1;
    for(let end=match.index+match[0].length;end<code.length;end++) {
      if(code[end]==='{')depth++;
      if(code[end]==='}'&&--depth===0){kernels.push({index:match.index,end:end+1,body:match.index+match[0].length,name:match[1]});break;}
    }
  }
  const launches=[...code.matchAll(/\b\w+\s*<<<[^;]*?>>>\s*\([^;]*?\)\s*;/g)].map(m=>({index:m.index,end:m.index+m[0].length}));
  const owner=config.kernel&&kernels.find(k=>k.name===config.kernel);
  const start=owner?.body??0, text=config.kernel?(owner?code.slice(start,owner.end-1):''):code;
  const patterns=config.targets??(config.names??[]).map(name=>'^[\\t ]*[^\\n]*\\b'+name+'\\s*(?:\\[[^\\]]*\\])?\\s*=[^;]*;');
  const targets=patterns.map(pattern=>new RegExp(pattern,'m').exec(text)).filter(Boolean).map(m=>({index:start+m.index,end:start+m.index+m[0].length}));
  if(config.body){const kernel=kernels.find(k=>k.name===config.body);if(kernel){const line=code.indexOf('\n',kernel.body);targets.push({index:line>=0&&line<kernel.end-1?line+1:kernel.body,end:kernel.end-1});}}
  return {kernels,launches,targets,excerpts:sourceExcerptRanges(source,excerpts),label:config.label};
}

export function mountLessonFocus(editor, reset, mode) {
  if(!lessonSourceFocus[mode])return;
  const document=editor.ownerDocument,view=document.defaultView;
  const page=view.frameElement?.ownerDocument??document;
  const excerpts=[...page.querySelectorAll('[data-editor-excerpt] code')].map(code=>code.textContent);
  const guidance=document.createElement('div');guidance.className='source-focus';
  guidance.innerHTML='<p id="source-focus-help"></p><button type="button">Show target line</button> <button type="button" data-show-launch>Show launch</button><p id="source-focus-missing" hidden></p>';
  guidance.querySelector('p').textContent=mode==='hello'&&excerpts.length
    ? 'The lesson’s CUDA excerpts, including the copy and print calls, use blue text. Change the gold value assigned to output[0]. The remaining setup and error checks can stay unchanged for now.'
    : (excerpts.length?'The lesson’s CUDA excerpts, kernels and launches use blue text. ':'The kernels and their launches use blue text. ')+
      'Gold marks the '+lessonSourceFocus[mode].label+'. '+(excerpts.length?'Follow the experiment above; the remaining':'The remaining')+' setup can stay unchanged for now.';
  editor.before(guidance);
  const surface=document.createElement('div');surface.className='source-editor';editor.before(surface);
  const ink=document.createElement('pre');ink.className='source-ink';ink.setAttribute('aria-hidden','true');surface.append(ink,editor);
  editor.setAttribute('aria-describedby','source-focus-help source-focus-missing');
  const show=guidance.querySelector('button'),showLaunch=guidance.querySelector('[data-show-launch]'),missing=guidance.querySelector('#source-focus-missing');
  let ranges;
  function syncScroll(){ink.scrollTop=editor.scrollTop;ink.scrollLeft=editor.scrollLeft;}
  function update(){
    ranges=sourceFocusRanges(editor.value,mode,excerpts);
    const kernel=ranges.kernels[0],launch=ranges.launches[0],target=ranges.targets[0];
    editor.classList.toggle('has-source-focus',Boolean(kernel||launch||target));
    missing.hidden=Boolean(target&&kernel&&launch);
    const part=!kernel?'complete kernel':!target?lessonSourceFocus[mode].label:'kernel launch';
    missing.textContent=missing.hidden?'':'The highlight cannot find the '+part+' in this edit. You can still compile and run. To keep this edit, open Editor tools and use Export .cu before Restore starter.';
    show.disabled=!target;showLaunch.disabled=!launch;
    showLaunch.textContent=ranges.launches.length>1?'Show first launch':'Show launch';
    const style=view.getComputedStyle(editor),height=parseFloat(style.lineHeight),padding=parseFloat(style.paddingTop);
    for(const property of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft'])ink.style[property]=style[property];
    for(const [name,range] of [['kernel',kernel],['launch',launch],['source',target]]){
      editor.style.setProperty('--'+name+'-focus-top',(range?padding+(editor.value.slice(0,range.index).split('\n').length-1)*height:0)+'px');
      editor.style.setProperty('--'+name+'-focus-bottom',(range?padding+editor.value.slice(0,range.end).split('\n').length*height:0)+'px');
    }
    const fullLine=r=>{const end=editor.value.indexOf('\n',r.end-1);return {...r,index:editor.value.lastIndexOf('\n',r.index-1)+1,end:end<0?editor.value.length:end};};
    const bands=[...ranges.kernels,...ranges.launches,...ranges.excerpts].map(r=>({...fullLine(r),kind:'lesson'})).concat(ranges.targets.map(r=>({...fullLine(r),kind:'target'})));
    const boundaries=[...new Set([0,editor.value.length,...bands.flatMap(r=>[r.index,r.end])])].sort((a,b)=>a-b);
    const nodes=[];
    for(let i=0;i<boundaries.length-1;i++){
      const start=boundaries[i],end=boundaries[i+1],range=bands.findLast(r=>r.index<=start&&r.end>=end),text=editor.value.slice(start,end);
      if(range){const span=document.createElement('span');span.className='source-'+range.kind+'-ink';span.textContent=text;nodes.push(span);}
      else nodes.push(document.createTextNode(text));
    }
    // Keep the final empty line measurable without adding a character to source.
    nodes.push(document.createTextNode('\u200b'));ink.replaceChildren(...nodes);syncScroll();
    return {height};
  }
  function reveal(focus=false,section='source'){
    const position=update(),range=section==='launch'?ranges.launches[0]:ranges.targets[0]??ranges.kernels[0];
    if(!range)return;
    if(focus)editor.focus({preventScroll:true});
    editor.setSelectionRange(range.index,range.index);
    const top=parseFloat(editor.style.getPropertyValue('--'+section+'-focus-top'));
    editor.scrollTop=Math.max(0,top-position.height*2);editor.scrollLeft=0;syncScroll();
    if(focus)editor.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  }
  show.addEventListener('click',()=>reveal(true));showLaunch.addEventListener('click',()=>reveal(true,'launch'));
  editor.addEventListener('input',update);editor.addEventListener('scroll',syncScroll);
  editor.addEventListener('gpu-lab:source-restored',()=>reveal());reset.addEventListener('click',()=>reveal());
  new view.ResizeObserver(update).observe(editor);view.requestAnimationFrame(()=>reveal());
}

if(typeof document!=='undefined'&&document.documentElement.dataset.inline){
  mountLessonFocus(document.querySelector('#source'),document.querySelector('#reset'),document.documentElement.dataset.inline);
}
