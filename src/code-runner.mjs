// Copyright © 2026 Christopher Snow.
// One cancellable toolchain per reading window. Program state belongs to each run.
export class CodeRunner extends EventTarget {
  constructor({makeWorker = text => {
    const url = URL.createObjectURL(new Blob([text], {type:'text/javascript'}));
    try { return new Worker(url); } finally { URL.revokeObjectURL(url); }
  }, idleMs = 300_000, timeoutMs = 90_000, now = Date.now, later = (fn,ms) => setTimeout(fn,ms), cancel = timer => clearTimeout(timer)} = {}) {
    super(); Object.assign(this,{makeWorker,idleMs,timeoutMs,now,later,cancel});
    this.state='stopped'; this.reason='Click Compile and run in a lesson to start the code runner automatically.'; this.boots=0;
  }
  get busy() { return ['starting','compiling','running'].includes(this.state); }
  configure(text,data) { this.config={text,data}; this.notify(); }
  notify() { this.dispatchEvent(new Event('change')); }
  set(state,reason='') { this.state=state; this.reason=reason; this.notify(); }
  touch() {
    this.cancel(this.idleTimer); this.deadline=this.now()+this.idleMs;
    this.idleTimer=this.later(()=>this.checkIdle(),this.idleMs);
  }
  checkIdle() {
    if(this.worker&&!this.busy&&this.deadline&&this.now()>=this.deadline)
      this.release('Stopped after five minutes without a run. Your code and results are kept.');
  }
  release(reason='Memory released. Compile and run starts the code runner again.') {
    this.cancel(this.runTimer); this.cancel(this.idleTimer);
    const job=this.job,pending=this.pending; this.job=null;this.pending=null; this.worker?.terminate(); this.worker=null; this.deadline=0;
    this.set('stopped',reason);
    job?.emit({cancelled:true,stage:reason});pending?.emit({cancelled:true,stage:reason});
  }
  detach(client) { if(this.job?.client===client||this.pending?.client===client) this.release('Run stopped. Your code and previous results are kept.'); }
  start() { if(this.config&&!this.busy) this.execute(null,this.config.text,{...this.config.data,type:'prepare'},reply=>{if(reply.error){this.reason='The code runner could not start. '+String(reply.error).slice(0,400)+' Try Compile and run in the editor.';this.notify();}}); }
  execute(client,text,data,emit) {
    if(this.job?.preparing&&!this.pending&&data.type!=='prepare') {
      this.pending={client,text,data,emit};emit({stage:'Waiting for the code runner to start…',phase:'starting'});this.notify();return;
    }
    if(this.busy) { emit({error:'Another compile or run is in progress. Wait for it to finish, then try again.'}); return; }
    this.configure(text,data); this.cancel(this.idleTimer); this.deadline=0;
    this.job={client,emit,preparing:data.type==='prepare'};
    try {
      if(!this.worker) {
        const worker=this.makeWorker(text);this.worker=worker;this.boots++;
        worker.onmessage=({data:reply})=>{
          if(this.worker!==worker||!this.job)return;
          if(reply.stage) {
            this.set(reply.phase??(reply.stage.startsWith('Loading')?'starting':reply.stage.startsWith('Running')?'running':'compiling'));
            this.job.emit(reply);this.pending?.emit(reply);return;
          }
          const job=this.job,pending=this.pending;this.job=null;this.pending=null;this.cancel(this.runTimer);
          if(reply.error) {
            this.release('The code runner stopped. Compile and run starts it again.');
            job.emit(reply);pending?.emit(reply);return;
          }
          this.set('ready','Ready for another run.');this.touch();job.emit(reply);
          if(pending)this.execute(pending.client,pending.text,pending.data,pending.emit);
        };
        worker.onerror=event=>{
          if(this.worker!==worker)return;
          const job=this.job,pending=this.pending;this.job=null;this.pending=null;this.release('The code runner stopped unexpectedly. Compile and run starts it again.');
          job?.emit({error:event.message||'The code runner stopped unexpectedly.'});pending?.emit({error:event.message||'The code runner stopped unexpectedly.'});
        };
      }
      this.set(this.state==='stopped'?'starting':'compiling');
      this.runTimer=this.later(()=>{
        const job=this.job,pending=this.pending;this.job=null;this.pending=null;this.release('The code runner stopped after the time limit.');
        job?.emit({error:'The run timed out after 90 seconds. Your code and previous results are kept.'});pending?.emit({error:'The code runner could not finish starting within 90 seconds. Your code and previous results are kept.'});
      },this.timeoutMs);
      this.worker.postMessage(data);
    } catch(error) {
      const job=this.job;this.job=null;this.release('The code runner could not start. Compile and run tries again.');
      job?.emit({error:String(error.message??error)});
    }
  }
}
