// Copyright © 2026 Christopher Snow.
import {CodeRunner} from './code-runner.mjs';
import {idleChoices,idleMinutes,idlePreference,toastPreference,wasmSize,elapsedTime} from './code-runner-settings.mjs';
let embedded=false;try{embedded=Boolean(frameElement?.hasAttribute('data-kernel-workbench'));}catch{}
if(!embedded&&!window.gpuLabCodeRunner) {
  let minutes=idleMinutes(null);try{minutes=idleMinutes(localStorage.getItem(idlePreference));}catch{}
  const runner=new CodeRunner({idleMs:minutes*60_000});window.gpuLabCodeRunner=runner;dispatchEvent(new Event('gpu-lab:runner-ready'));
  const actions=document.querySelector('.top-actions')??document.querySelector('main>header');
  if(actions) {
    const button=document.createElement('button');button.type='button';button.id='code-runner-open';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','code-runner-dialog');button.setAttribute('aria-expanded','false');
    button.append('Code runner');const status=document.createElement('span');status.id='code-runner-summary';button.append(status);actions.prepend(button);
    const panel=document.createElement('section');panel.id='code-runner-dialog';panel.className='code-runner-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','code-runner-title');panel.setAttribute('popover','auto');
    const native='showPopover' in panel;if(!native)panel.hidden=true;
    panel.innerHTML=`<div class="runner-heading"><h2 id="code-runner-title">Code runner</h2><button type="button" data-runner-close>Close</button></div>
<p data-runner-status role="status"></p>
<dl class="runner-measures"><div><dt><abbr title="WebAssembly">WASM</abbr> memory allocated</dt><dd data-runner-memory>0.0 MiB</dd></div><div><dt>Last compile and run</dt><dd data-runner-time>No completed run</dd></div></dl>
<p class="runner-measure-note">Memory is the last reported allocation, excluding other browser memory. Time includes startup, compilation and simulation.</p>
<label class="runner-timeout" for="code-runner-timeout">Keep ready between runs <select id="code-runner-timeout" aria-describedby="runner-timeout-help">${idleChoices.map(value=>`<option value="${value}">${value} minutes</option>`).join('')}</select></label>
<p class="runner-setting-note" id="runner-timeout-help">Frees memory after this time without a run. Saved in this browser.</p>
<div class="runner-actions"><button type="button" data-runner-start>Start code runner</button><button type="button" data-runner-stop>Stop run</button><button type="button" data-runner-free>Free memory</button></div>
<p class="runner-setting-note">Stopping keeps your code and results.</p>`;
    document.body.append(panel);const timeout=panel.querySelector('select');let returnFocus=button,settingSaved=true;
    const opened=()=>native?panel.matches(':popover-open'):!panel.hidden;
    const fit=()=>{
      if(!opened())return;
      const anchor=button.getBoundingClientRect(),height=window.visualViewport?.height??innerHeight;
      panel.style.top=Math.min(anchor.bottom+8,Math.max(8,height-panel.offsetHeight-8))+'px';
      panel.style.left=Math.max(8,Math.min(anchor.right-panel.offsetWidth,innerWidth-panel.offsetWidth-8))+'px';
    };
    const close=(restore=false)=>{
      if(opened()){if(native)panel.hidePopover();else panel.hidden=true;}
      button.setAttribute('aria-expanded','false');
      if(restore)(returnFocus?.isConnected&&!returnFocus.closest('[hidden]')?returnFocus:button).focus({preventScroll:true});
    };
    runner.openControls=()=>{
      if(opened())return;
      returnFocus=document.activeElement;
      if(returnFocus?.tagName==='IFRAME')try{returnFocus=returnFocus.contentDocument.activeElement;}catch{}
      if(native)panel.showPopover();else panel.hidden=false;
      button.setAttribute('aria-expanded','true');fit();panel.querySelector('[data-runner-close]').focus({preventScroll:true});
    };
    button.addEventListener('click',()=>opened()?close(true):runner.openControls());
    panel.querySelector('[data-runner-close]').addEventListener('click',()=>close(true));
    panel.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(opened())));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened()){event.preventDefault();close(panel.contains(document.activeElement));}});
    document.addEventListener('pointerdown',event=>{if(!native&&opened()&&!panel.contains(event.target)&&!button.contains(event.target))close();});
    addEventListener('resize',fit);addEventListener('scroll',fit,{passive:true});
    addEventListener('gpu-lab:lesson-changed',()=>close());
    panel.querySelector('[data-runner-start]').addEventListener('click',()=>runner.start());
    panel.querySelector('[data-runner-stop]').addEventListener('click',()=>runner.release(runner.job?.preparing&&!runner.pending?'Startup stopped.':'Run stopped. Your code and previous results are kept.'));
    panel.querySelector('[data-runner-free]').addEventListener('click',()=>runner.release());
    timeout.addEventListener('change',()=>{
      const value=Number(timeout.value);if(!idleChoices.includes(value))return;
      settingSaved=true;try{localStorage.setItem(idlePreference,String(value));}catch{settingSaved=false;}
      runner.setIdleMinutes(value);
    });
    addEventListener('storage',event=>{if(event.key===idlePreference||event.key===null){settingSaved=true;runner.setIdleMinutes(idleMinutes(event.newValue));}});
    const toast=document.createElement('aside');toast.id='code-runner-toast';toast.hidden=true;toast.setAttribute('aria-label','Code runner notice');
    toast.innerHTML='<p role="status" aria-live="polite"></p><div class="runner-actions"><button type="button" data-runner-manage>Manage runner</button><button type="button" data-runner-dismiss>Dismiss</button></div>';
    document.body.append(toast);let toastSeen=false;try{toastSeen=localStorage.getItem(toastPreference)==='1';}catch{}
    toast.querySelector('[data-runner-manage]').addEventListener('click',()=>{toast.hidden=true;runner.openControls();});
    toast.querySelector('[data-runner-dismiss]').addEventListener('click',()=>{toast.hidden=true;button.focus({preventScroll:true});});
    const names={stopped:'Stopped',starting:'Starting',compiling:'Compiling',running:'Running',ready:'Ready'};
    const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
    const render=()=>{
      text(status,names[runner.state]);button.dataset.state=runner.state;
      text(panel.querySelector('[data-runner-status]'),runner.reason||names[runner.state]+'…');
      text(panel.querySelector('[data-runner-memory]'),wasmSize(runner.wasmBytes));
      text(panel.querySelector('[data-runner-time]'),elapsedTime(runner.lastRunMs));
      timeout.value=String(runner.idleMs/60_000);
      text(panel.querySelector('#runner-timeout-help'),settingSaved?'Frees memory after this time without a run. Saved in this browser.':'Applies to this tab. The browser could not save this setting.');
      panel.querySelector('[data-runner-start]').hidden=runner.state!=='stopped';
      panel.querySelector('[data-runner-start]').disabled=!runner.config;
      panel.querySelector('[data-runner-stop]').hidden=!runner.busy;
      panel.querySelector('[data-runner-stop]').textContent=runner.job?.preparing&&!runner.pending?'Stop startup':'Stop run';
      panel.querySelector('[data-runner-free]').hidden=runner.state!=='ready';
      if(runner.completedRuns&&!toastSeen){
        toastSeen=true;toast.hidden=false;try{localStorage.setItem(toastPreference,'1');}catch{}
      }
      if(!toast.hidden)text(toast.querySelector('p'),`Keeping the code runner in memory makes later runs faster. It stops after ${runner.idleMs/60_000} minutes without a run.`);
      fit();
    };
    runner.addEventListener('change',render);render();
  }
  addEventListener('focus',()=>runner.checkIdle());document.addEventListener('visibilitychange',()=>runner.checkIdle());
  addEventListener('pagehide',()=>runner.release());
  addEventListener('gpu-lab:before-restart',event=>{if(runner.busy)event.detail.reason='Wait for the code runner to finish, or use Stop run in Code runner, then try again.';});
  import('./course-session.mjs').then(({installCourseSession})=>installCourseSession(runner)).catch(()=>{});
}
