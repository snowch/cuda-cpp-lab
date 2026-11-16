// Copyright © 2026 Christopher Snow.
const fp = Math.fround;
export function compareOutputs(actual, expected, {atol=1e-5, rtol=1e-4}={}) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || !Number.isFinite(atol) || !Number.isFinite(rtol) || atol<0 || rtol<0) throw new Error('Supply arrays and finite non-negative tolerances.');
  const failures=[];let maxError=0;
  for(let i=0;i<Math.max(actual.length,expected.length);i++) {
    const a=actual[i],e=expected[i],finite=Number.isFinite(a)&&Number.isFinite(e),error=finite?Math.abs(a-e):null;
    if(error!==null)maxError=Math.max(maxError,error);
    if(!finite || error>atol+rtol*Math.abs(e))failures.push({index:i,actual:a,expected:e,error});
  }
  return {ok:failures.length===0,failures,first:failures[0]?.index??-1,maxError,checked:expected.length};
}
function matrix(a,b) {
  return [0,1,2,3].map(i=>fp(fp(a[Math.floor(i/2)*2]*b[i%2])+fp(a[Math.floor(i/2)*2+1]*b[2+i%2])));
}
export function verificationCase(kind='matrix', candidate='correct') {
  if(!['matrix','ones'].includes(kind)||!['correct','transpose','unwritten','roundoff','infinity'].includes(candidate))throw new Error('Choose a displayed verification case.');
  const a=kind==='ones'?[1,1,1,1]:[1,2,3,5],b=kind==='ones'?[1,1,1,1]:[2,0,1,4];
  const expected=matrix(a,b),actual=candidate==='transpose'?matrix(a,[b[0],b[2],b[1],b[3]]):[...expected];
  if(candidate==='unwritten')actual[3]=NaN;
  if(candidate==='roundoff')actual[2]+=1e-6;
  if(candidate==='infinity')actual[1]=Infinity;
  return {a,b,actual,expected,...compareOutputs(actual,expected)};
}
export function gridStride(n, blocks=2, threads=32) {
  if(!Number.isInteger(n)||n<0||n>4096||![1,2,4].includes(blocks)||threads!==32)throw new Error('Use 0–4096 inputs, 1/2/4 blocks and 32 threads per block.');
  const owners=Array(n).fill(-1),visits=Array.from({length:blocks*threads},()=>[]);
  for(let t=0;t<visits.length;t++)for(let i=t;i<n;i+=visits.length){visits[t].push(i);owners[i]=t;}
  return {n,blocks:n?blocks:0,threads,stride:blocks*threads,owners,visits,active:visits.filter(v=>v.length).length,
    inputs:Array.from({length:n},(_,i)=>fp(((i%13)-6)*0.25)),output:Array.from({length:n},(_,i)=>fp(fp(((i%13)-6)*0.25)*2.5))};
}
export function blockScan(n) {
  if(!Number.isInteger(n)||n<0||n>1024)throw new Error('This two-level scan supports 0–1024 flags.');
  const input=Array.from({length:n},(_,i)=>Number(i%3===0)),blocks=[];let start=0;
  for(let begin=0;begin<n;begin+=32){
    const flags=input.slice(begin,begin+32),local=[];let total=0;
    for(const flag of flags){local.push(total);total+=flag;}
    blocks.push({block:blocks.length,begin,valid:flags.length,padding:32-flags.length,total,start,local});start+=total;
  }
  return {n,input,blocks,output:blocks.flatMap(b=>b.local.map(value=>value+b.start)),total:start,kernels:n?3:0};
}
export const teachingSM=Object.freeze({registers:65536,sharedBytes:65536,warps:64,threads:2048,blocks:16,warpSize:32});
export function residency(threads=256,registers=32,sharedKiB=16) {
  if(![128,256,512].includes(threads)||![16,32,64,96].includes(registers)||![4,16,48].includes(sharedKiB))throw new Error('Choose one of the displayed resource cases.');
  const warps=Math.ceil(threads/32),limits={registers:Math.floor(teachingSM.registers/(threads*registers)),shared:Math.floor(teachingSM.sharedBytes/(sharedKiB*1024)),warps:Math.floor(teachingSM.warps/warps),threads:Math.floor(teachingSM.threads/threads),blocks:teachingSM.blocks};
  const blocks=Math.min(...Object.values(limits));
  return {limits,blocks,warpsPerBlock:warps,residentWarps:blocks*warps,occupancy:blocks*warps/teachingSM.warps,limiting:Object.keys(limits).filter(key=>limits[key]===blocks)};
}
export function softmax(values) {
  if(!Array.isArray(values)||!values.length||values.some(v=>!Number.isFinite(v)))throw new Error('Use a non-empty row of finite logits.');
  const maximum=Math.max(...values),weights=values.map(v=>Math.exp(v-maximum)),sum=weights.reduce((a,b)=>a+b,0);
  return {maximum,sum,weights,output:weights.map(v=>v/sum)};
}
export const softmaxCases=Object.freeze({ordinary:[-2,0,1],shifted:[1000,1002,1003],equal:[4,4,4],tail:[-1,2,0,3,1]});
export function checkSoftmax(kind,text) {
  const input=softmaxCases[kind];if(!input)throw new Error('Choose a displayed row.');
  if(typeof text!=='string'||!text.trim())throw new Error('Enter your output values before checking.');
  const actual=text.trim().split(/[\s,]+/).map(Number),reference=softmax(input),comparison=compareOutputs(actual,reference.output),sum=actual.reduce((a,b)=>a+b,0);
  return {...comparison,input,actual,expected:reference.output,sum,maximum:reference.maximum,denominator:reference.sum,ok:comparison.ok&&Math.abs(sum-1)<=1e-4};
}
const median=values=>{const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
export function analyseBenchmark(record) {
  if(record?.schema!==1||record.scope!=='kernel-only'||typeof record.gpu!=='string'||!record.gpu.trim()||!Number.isInteger(record.elements)||record.elements<1||record.checked_elements!==record.elements||!Number.isInteger(record.repetitions)||record.repetitions<1||!Number.isInteger(record.warmup)||record.warmup<1)throw new Error('Use a verified kernel-only report from benchmark-fusion.cu.');
  const rows=['separate','fused'].map(name=>{
    const samples=record.samples_ms?.[name];
    if(!Array.isArray(samples)||samples.length<3||samples.length>1000||samples.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Each variant needs at least three positive finite timings in milliseconds.');
    return {name,samples,median:median(samples),min:Math.min(...samples),max:Math.max(...samples)};
  });
  return {gpu:record.gpu,elements:record.elements,rows,ratio:rows[0].median/rows[1].median,overlap:rows[0].min<=rows[1].max&&rows[1].min<=rows[0].max};
}
