// Copyright © 2026 Christopher Snow.
import {CodeRunner} from './code-runner.mjs';
// Embedded editors attach to the reading window; they need no second owner/UI.
let embedded=false;try{embedded=Boolean(frameElement?.hasAttribute('data-kernel-workbench'));}catch{}
if(!embedded&&!window.gpuLabCodeRunner) {
  const runner=new CodeRunner();window.gpuLabCodeRunner=runner;dispatchEvent(new Event('gpu-lab:runner-ready'));
  const actions=document.querySelector('.top-actions')??document.querySelector('main>header');
  if(actions) {
    const button=document.createElement('button');button.type='button';button.id='code-runner-open';button.setAttribute('aria-haspopup','dialog');
    button.append('Code runner');const status=document.createElement('span');status.id='code-runner-summary';button.append(status);actions.prepend(button);
    const dialog=document.createElement('dialog');dialog.id='code-runner-dialog';dialog.setAttribute('aria-labelledby','code-runner-title');
    dialog.innerHTML='<div class="status-heading"><h2 id="code-runner-title">Code runner</h2><button type="button" data-runner-close autofocus>Close</button></div><p data-runner-status role="status"></p><p>The compiler and GPU simulator use this device’s CPU and memory. The runner stays ready between lessons and stops after five minutes without a run. Your code and results are kept.</p><div class="status-actions"><button type="button" data-runner-start>Start code runner</button><button type="button" data-runner-stop>Stop run</button><button type="button" data-runner-free>Free memory</button></div>';
    document.body.append(dialog);runner.openControls=()=>dialog.showModal();button.addEventListener('click',runner.openControls);
    dialog.querySelector('[data-runner-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>button.focus({preventScroll:true}));
    dialog.querySelector('[data-runner-start]').addEventListener('click',()=>runner.start());
    dialog.querySelector('[data-runner-stop]').addEventListener('click',()=>runner.release(runner.job?.preparing?'Startup stopped. Compile and run starts the code runner again.':'Run stopped. Your code and previous results are kept.'));
    dialog.querySelector('[data-runner-free]').addEventListener('click',()=>runner.release());
    const names={stopped:'Stopped',starting:'Starting',compiling:'Compiling',running:'Running',ready:'Ready'};
    const render=()=>{
      status.textContent=names[runner.state];button.dataset.state=runner.state;
      dialog.querySelector('[data-runner-status]').textContent=runner.reason||names[runner.state]+'…';
      dialog.querySelector('[data-runner-start]').hidden=runner.state!=='stopped';
      dialog.querySelector('[data-runner-start]').disabled=!runner.config;
      dialog.querySelector('[data-runner-stop]').hidden=!runner.busy;
      dialog.querySelector('[data-runner-stop]').textContent=runner.job?.preparing?'Stop startup':'Stop run';
      dialog.querySelector('[data-runner-free]').hidden=runner.state!=='ready';
    };
    runner.addEventListener('change',render);render();
  }
  addEventListener('focus',()=>runner.checkIdle());document.addEventListener('visibilitychange',()=>runner.checkIdle());
  addEventListener('pagehide',()=>runner.release());
  addEventListener('gpu-lab:before-restart',event=>{if(runner.busy)event.detail.reason='Wait for the code runner to finish, or use Stop run in Code runner, then try again.';});
  // The static pages remain the fallback. Only warm, same-release reading uses
  // the persistent document; no extra browser window or SharedWorker is needed.
  import('./course-session.mjs').then(({installCourseSession})=>installCourseSession(runner)).catch(()=>{});
}
