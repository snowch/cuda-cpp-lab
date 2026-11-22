// Durable progress is separate from per-tab experiment snapshots and editor drafts.
import {LessonCompletionStore} from './lesson-completion-store.mjs';
const prefix='gpu-lab:v2:manual-completion:';
let store;
const links=()=>[...document.querySelectorAll('[data-v2-completion-link]')];
function render(){
 if(!store)return;
 for(const link of links()){
  const done=store.isDone(link.dataset.v2CompletionLink);
  const tick=link.querySelector('.v2-done-tick');if(tick)tick.hidden=!done;
 }
 const count=[...store.ids].filter(id=>store.isDone(id)).length;
 for(const label of document.querySelectorAll('.v2-course-progress,.v2-overview-progress'))label.textContent=`${count} / ${store.ids.size} complete`;
 const input=document.querySelector('[data-v2-completion]');
 if(input){input.checked=store.isDone(input.dataset.v2Completion);document.getElementById('v2-completion-note').textContent=store.unsaved.has(input.dataset.v2Completion)?'This mark could not be saved. Allow browser storage or undo the mark before updating.':'Saved in this browser.';}
}
export function mountV2Progress(root=document){
 if(!store){let storage;try{storage=localStorage;}catch{}const ids=[...new Set(links().map(link=>link.dataset.v2CompletionLink))];if(ids.length)store=new LessonCompletionStore(storage,ids,prefix);}
 const input=root.querySelector('[data-v2-completion]');
 if(input&&!input.dataset.progressMounted){input.dataset.progressMounted='true';input.disabled=false;input.addEventListener('change',()=>{store.set(input.dataset.v2Completion,input.checked);render();});}
 for(const prediction of root.querySelectorAll('[data-code-prediction]')){
  if(prediction.dataset.mounted)continue;prediction.dataset.mounted='true';prediction.disabled=false;
  const key='gpu-lab:v2:code-prediction:'+prediction.dataset.codePrediction;
  try{prediction.value=localStorage.getItem(key)??'';}catch{}
  prediction.addEventListener('input',()=>{try{localStorage.setItem(key,prediction.value);}catch{/* Per-tab restart snapshots also preserve this field. */}});
 }
 render();
}
addEventListener('storage',event=>{if(store&&(event.key===null||event.key.startsWith(prefix))){store.refresh(event.key===null?null:event.key.slice(prefix.length),true);render();}});
addEventListener('pageshow',()=>{store?.refresh();render();});
addEventListener('gpu-lab:before-restart',event=>{if(store?.unsaved.size)event.detail.reason='This tab has an unsaved lesson mark. Allow browser storage or undo the mark before updating.';});
const header=document.querySelector('.topbar');
if(header)new ResizeObserver(()=>document.documentElement.style.setProperty('--course-header-height',header.getBoundingClientRect().height+'px')).observe(header);
