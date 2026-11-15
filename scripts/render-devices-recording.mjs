// Copyright © 2026 Christopher Snow.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {deviceJourney} from '../src/foundations-model.mjs';
import {deviceArchitecture} from '../src/device-architecture.mjs';
import {label as t,valuesRow,recordingDeck,writeRecordingDeck} from './recording-deck.mjs';
import scenes from '../content/devices-scenes.json' with {type:'json'};
export const devicesRecordingData={steps:[0,1,2].map(stage=>deviceJourney({stage})),challenge:deviceJourney({stage:2,count:8,factor:3})};
function buffer(x,y,buffer,empty,highlight){
 return `<rect class="${buffer?(buffer.name===highlight?'active':'panel'):'empty'}" x="${x}" y="${y}" width="326" height="138" rx="10"/>`+t(x+163,y+29,buffer?.name||'No destination yet','heading')+(buffer?valuesRow(buffer.values,x+22,y+48):t(x+163,y+83,empty,'caption'));
}
function memory(frame,highlight){
 return t(177,79,'CPU-side memory','heading')+t(177,105,'System RAM','caption')+t(543,79,'GPU device memory','heading')+t(543,105,'Separate storage on this GPU','caption')+
 [0,1].map(i=>buffer(14,122+i*156,frame.cpu[i],i?'No CPU result requested':'Input not present',highlight)+buffer(380,122+i*156,frame.gpu[i],i?'No GPU result yet':'Input not copied yet',highlight)).join('');
}
function architecture(){
 const {host,gpu}=deviceArchitecture;
 return t(360,30,'COMPUTER / SYSTEM','caption')+[host,gpu].map((side,i)=>{
  const x=12+i*368,cx=x+164;
  return `<rect class="empty" x="${x}" y="52" width="328" height="342" rx="12"/>`+t(cx,84,side.title,'heading')+
   `<rect class="panel" x="${x+14}" y="103" width="300" height="99" rx="8"/>`+t(cx,136,side.processor,'heading')+
   t(cx,166,i?'Performs the multiplication':'Runs Python; requests','caption')+(i?'':t(cx,187,'GPU operations','caption'))+
   `<path class="arrow" d="M${cx-14} 210v36" marker-end="url(#arrow)"/><path class="arrow" d="M${cx+14} 249v-36" marker-end="url(#arrow)"/>`+t(cx+87,236,'Read / write','caption')+
   `<rect class="panel" x="${x+14}" y="263" width="300" height="107" rx="8"/>`+t(cx,300,side.memory,'heading')+t(cx,334,side.storage,'caption');
 }).join('')+
 t(360,425,'Copies connect the two memories','heading')+
 t(360,464,'System RAM → GPU memory: .to("cuda")','code')+
 t(360,501,'GPU memory → system RAM: .cpu()','code')+
 t(360,537,'Dedicated GPU memory is outside the compute chip.','caption');
}
export function devicesFigure(stage){
 const {steps,challenge}=devicesRecordingData;
 if(stage==='start')return architecture();
 if(stage==='summary')return t(360,55,'FIVE FP32 VALUES · FOUR BYTES EACH','caption')+
 ['Copy CPU → GPU','Multiply on the GPU','Copy GPU → CPU'].map((name,i)=>`<rect class="panel" x="28" y="${98+i*106}" width="664" height="84" rx="10"/>`+t(252,149+i*106,name,'heading')+t(576,149+i*106,`${steps[i].transferBytes} bytes`,'equation')).join('')+
 t(360,466,`${steps.reduce((sum,s)=>sum+s.transferBytes,0)} bytes copied between devices`,'equation')+t(360,514,'Payload only · no transfer-time prediction','caption');
 const question=stage==='question',answer=stage==='answer';
 const s=question||answer?challenge:steps[stage==='copy-in'?0:stage==='calculate'||stage==='keep'?1:2];
 const frame=question?challenge.before:stage==='keep'?steps[1].after:s.after;
 const code={'copy-in':'x_gpu = x_cpu.to("cuda")',calculate:'y_gpu = x_gpu * 2','copy-out':'y_cpu = y_gpu.cpu()',keep:'Next GPU calculation can read y_gpu',question:'What does y_gpu.cpu() copy?',answer:'y_cpu = y_gpu.cpu()'}[stage];
 const highlight=['copy-in','calculate','copy-out','answer'].includes(stage)?s.allocated:null;
 const arrow=stage==='copy-in'?'<path class="arrow" d="M344 191H374" marker-end="url(#arrow)"/>':['copy-out','answer'].includes(stage)?'<path class="arrow" d="M374 347H346" marker-end="url(#arrow)"/>':'';
 return t(360,30,code,'code')+memory(frame,highlight)+arrow+t(360,478,question?'CPU result location? Copy payload? Original input?':stage==='keep'?'Keep the result here until a CPU consumer needs it.':`${s.transferBytes} bytes copied between CPU and GPU`,stage==='keep'||question?'body':'equation')+
 t(360,526,stage==='calculate'?'GPU reads and writes still happen.':answer?'The original x_cpu values remain unchanged.':stage==='copy-in'?'New storage · same values':stage==='copy-out'?'GPU result retained · CPU result added':'Separate buffers keep their own values.','caption');
}
const notes={start:'Storage holds tensor values; it is separate from the processor.','copy-in':'PyTorch manages destination storage and the transfer.',calculate:'New GPU result; original input unchanged.','copy-out':'Copying preserves the source tensor.',summary:'Count CPU/GPU copies separately from GPU memory activity.',keep:'Copy the tensor needed by the CPU-side consumer.',question:'Pause before revealing the CPU result.',answer:'Return to Chapter 2 and vary the input count or multiplier.'};
export const devicesDeck=()=>recordingDeck({chapter:2,title:'Follow tensor values between CPU and GPU',scenes:scenes.map(s=>({...s,note:notes[s.stage]})),figure:devicesFigure,scope:'Chosen discrete-GPU example · no timing model'});
export const devicesSpeechText=text=>text.replace(/\bRAM\b/g,'[RAM](/ˌɑɹ ˌeɪ ˈɛm/)');
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await writeRecordingDeck(process.argv[2]||'test-results/devices-recording',devicesDeck(),scenes,devicesSpeechText);
