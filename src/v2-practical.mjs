// Copyright © 2026 Christopher Snow.
import { verificationCase, gridStride, blockScan, residency, checkSoftmax, analyseBenchmark } from './v2-practical-model.mjs';
import { escape } from './continuation-ui.mjs';
import { registerExperiment } from './experiment-state.mjs';
const f=v=>Number.isFinite(v)?(Number.isInteger(v)?v.toFixed(1):Number(v.toPrecision(6)).toString()):String(v);
const row=(values)=>'<tr>'+values.map(v=>`<td>${escape(v)}</td>`).join('')+'</tr>';
const table=(caption,headers,rows)=>`<div class="v2-practical-table"><table class="v2-result-table"><caption>${caption}</caption><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row).join('')}</tbody></table></div>`;
function calculate(slug,values) {
 const n=Number(values.n),prediction=Number(values.prediction);
 if(slug==='verify-every-output') {
  const m=verificationCase(values.kind,values.candidate);
  return {message:m.ok?'All four values pass this case.':'Verification failed: '+m.failures.length+' mismatches; first index '+m.first+'.',html:table('Matrix result comparison · FP32 tolerance',['Index','Candidate','CPU reference','Check'],m.expected.map((v,i)=>[i,f(m.actual[i]),f(v),m.failures.some(x=>x.index===i)?'Mismatch':'Pass']))};
 }
 if(slug==='grid-stride-loops') {
  const m=gridStride(n,Number(values.blocks)),visits=m.visits[0].length;
  return {message:`${n===0?'No launch.':m.blocks+' blocks × 32 threads; stride '+m.stride+'.'} ${n} elements covered once. Your thread 0 prediction ${prediction===visits?'matches':'differs: actual '+visits}.`,html:table('Thread visits · first eight logical threads',['Thread','Visited input/output indices'],m.visits.slice(0,8).map((v,i)=>[i,v.length?v.join(', '):'No input']))+'<p>The model assigns every index one owner; it does not predict runtime.</p>'};
 }
 if(slug==='multi-block-scan') {
  const m=blockScan(n),start=m.blocks.at(-1)?.start??0;
  const indices=[...new Set([0,1,30,31,32,33,62,63,64,65,n-2,n-1])].filter(i=>i>=0&&i<n).sort((a,b)=>a-b);
  return {message:`${m.kernels} kernel phases; ${m.total} selected flags. ${m.blocks.length?'Last block start: '+start+'.':'Empty input: no launch.'} Your prediction ${prediction===start?'matches.':'differs.'}`,html:table('Cross-block prefix construction',['Block','Valid / padded lanes','Total','Start'],m.blocks.map(b=>[b.block,b.valid+' / '+b.padding,b.total,b.start]))+table('Global offsets · selected block boundaries and tail',['Index','Flag','Exclusive offset'],indices.map(i=>[i,m.input[i],m.output[i]]))+'<p>Showing '+indices.length+' selected offsets of '+n+'; every offset was calculated.</p>'};
 }
 if(slug==='resource-tradeoffs') {
  const m=residency(Number(values.threads),Number(values.registers),Number(values.shared));
  return {message:`${m.blocks} resident blocks, ${m.residentWarps} warps, ${m.occupancy*100}% model occupancy. Limiting: ${m.limiting.join(', ')}. Your prediction ${prediction===m.blocks?'matches.':'differs.'}`,html:table('Illustrative SM limits · no allocation granularity',['Resource','Maximum blocks from this resource'],Object.entries(m.limits))+'<p>This allocation bound supplies no execution time or spill prediction.</p>'};
 }
 if(slug==='softmax-capstone') {
  const m=checkSoftmax(values.kind,values.values);
  return {message:m.ok?'This row passes elementwise tolerance and row-sum checks. Continue with other shapes.':`Row failed: ${m.failures.length} element mismatches; sum = ${f(m.sum)}. Compare the first differing column.`,html:table('Softmax row · atol 1e-5, rtol 1e-4',['Column','Your value','Stable reference'],m.expected.map((v,i)=>[i,f(m.actual[i]),f(v)]))};
 }
 const m=analyseBenchmark(JSON.parse(values.report));
 return {message:`${m.gpu}: ${m.elements} checked elements. Separate/fused median ratio: ${m.ratio.toFixed(3)}. ${m.overlap?'Sample ranges overlap; investigate variability.':'Sample ranges do not overlap in this report.'}`,html:table('Imported kernel-only timings · milliseconds per variant',['Variant','Median (ms)','Min (ms)','Max (ms)'],m.rows.map(r=>[r.name,r.median.toPrecision(6),r.min.toPrecision(6),r.max.toPrecision(6)]))+'<p>Imported values are your report, not browser measurements. The schema checks report completeness; it cannot authenticate how the GPU run was performed.</p>'};
}
export function mountPractical(root=document) {
 for(const activity of root.querySelectorAll('[data-practical]')) {
  const slug=activity.dataset.practical,key='gpu-lab:practical:1:'+slug,form=activity.querySelector('form'),feedback=activity.querySelector('[data-practical-feedback]'),result=activity.querySelector('[data-practical-result]');
  const fields=[...form.querySelectorAll('[name]')],defaults=Object.fromEntries(fields.map(f=>[f.name,f.value]));
  let state={values:defaults,ran:false};
  const read=()=>Object.fromEntries(fields.map(f=>[f.name,f.value]));
  function render() {
   result.hidden=true;result.replaceChildren();
   feedback.textContent='Choose a case, then run or check it.';
   if(state.ran){try{const r=calculate(slug,state.values);feedback.textContent=r.message;result.innerHTML=r.html;result.hidden=false;}catch(error){feedback.textContent=error instanceof SyntaxError?'Invalid JSON. Paste a complete benchmark report.':error.message;}}
  }
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{/* Storage is optional. */}}
  function restore(saved){
   if(!saved||typeof saved.values!=='object'||saved.values===null)return;
   for(const field of fields){const value=saved.values[field.name];if(typeof value==='string'&&value.length<=200000&&(!(field instanceof HTMLSelectElement)||[...field.options].some(o=>o.value===value)))field.value=value;}
   state={values:read(),ran:saved.ran===true};render();
  }
  try{restore(JSON.parse(localStorage.getItem(key)));}catch{/* Ignore invalid optional storage. */}
  form.addEventListener('input',()=>{state={values:read(),ran:false};render();save();});
  form.addEventListener('change',()=>{state={values:read(),ran:false};render();save();});
  form.addEventListener('submit',event=>{event.preventDefault();state={values:read(),ran:true};render();save();});
  form.addEventListener('reset',()=>{for(const field of fields)field.value=defaults[field.name];state={values:{...defaults},ran:false};render();try{localStorage.removeItem(key);}catch{};});
  registerExperiment('practical:'+slug,()=>state,restore);
  for(const button of form.querySelectorAll('button'))button.disabled=false;
  render();
 }
}
