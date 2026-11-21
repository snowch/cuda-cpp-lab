// Copyright © 2026 Christopher Snow.
import './code-runner-host.mjs';
import {CodeRunner} from './code-runner.mjs';
import {saveReadingState} from './experiment-state.mjs';
const release=document.querySelector('meta[name="gpu-release"]')?.content;
const ownerReady=(async()=>{
  try {
    if(frameElement?.hasAttribute('data-kernel-workbench')&&parent.document.querySelector('meta[name="gpu-release"]')?.content===release&&parent.document.documentElement.hasAttribute('data-course-session')) {
      if(parent.gpuLabCodeRunner)return parent.gpuLabCodeRunner;
      return await new Promise((resolve,reject)=>{
        const ready=()=>{clearTimeout(timer);parent.removeEventListener('gpu-lab:runner-ready',ready);resolve(parent.gpuLabCodeRunner);};
        const timer=setTimeout(()=>{parent.removeEventListener('gpu-lab:runner-ready',ready);reject(new Error('The code runner is still loading. Reload the lesson, then try Compile and run.'));},10000);
        parent.addEventListener('gpu-lab:runner-ready',ready,{once:true});
      });
    }
  } catch(error) { throw error; }
  return window.gpuLabCodeRunner??new CodeRunner();
})();
function introduce(owner) {
  if(owner.introduced)return;owner.introduced=true;
  let seen=false;try{seen=localStorage.getItem('gpu-lab:code-runner-intro')==='1';localStorage.setItem('gpu-lab:code-runner-intro','1');}catch{}
  if(seen||document.getElementById('code-runner-intro'))return;
  const note=document.createElement('p');note.id='code-runner-intro';note.className='note';
  note.append('The code runner uses your device’s CPU and memory. It stays ready between lessons and stops after five idle minutes. Use ');
  const button=document.createElement('button');button.type='button';button.textContent='Code runner';
  button.addEventListener('click',()=>ownerReady.then(owner=>owner.openControls?.()));note.append(button,' in the header to free memory sooner. Your code and results are kept.');
  document.getElementById('status').before(note);
}
window.gpuLabRunnerClient={
  configure(text,data) { ownerReady.then(owner=>owner.configure(text,data)).catch(()=>{}); },
  save() { saveReadingState('navigation'); },
  connect(text) {
    let assets,disposed=false;
    const client={onmessage:null,onerror:null,
      postMessage(data) {
        if(disposed)return;assets=data.assets??assets;
        ownerReady.then(owner=>{
          if(!disposed){introduce(owner);owner.execute(client,text,{...data,assets},reply=>{if(!disposed)client.onmessage?.({data:reply});});}
        }).catch(error=>{if(!disposed)client.onmessage?.({data:{error:error.message}});});
      },
      terminate() { ownerReady.then(owner=>owner.detach(client)).catch(()=>{});disposed=true;client.onmessage=null;client.onerror=null; },
    };
    return client;
  },
};
