// Copyright © 2026 Christopher Snow.
import {mountV2} from './v2.mjs';
import {mountRecordings} from './recording.mjs';
import {mountCompletion} from './lesson-completion.mjs';
import {saveReadingState,setReadingRoute,replaceReadingContext,restoreReadingState} from './experiment-state.mjs';
export function installCourseSession(runner) {
  const release=document.querySelector('meta[name="gpu-release"]')?.content;
  const base=new URL(document.querySelector('meta[name="gpu-base"]').content,location.href);
  let navigating=false,sequence=0,currentURL=location.href,index=0,suppressPop=false,navigationAbort,leaving=false,historyReady=false,pendingHash;
  setReadingRoute();
  let session=crypto.randomUUID();
  const position=new Map();
  const eligible=url=>url.origin===base.origin&&url.pathname.startsWith(base.pathname)&&
    (url.pathname===base.pathname||url.pathname===base.pathname+'index.html'||/^v2\/(?!cuda-source-workbench)[a-z0-9-]+\.html$/.test(url.pathname.slice(base.pathname.length)))&&
    !url.search;
  const frames=()=>[...document.querySelectorAll('[data-kernel-workbench]')];
  function save() {
    try {
      saveReadingState('navigation');
      for(const frame of frames()) frame.contentWindow.gpuLabRunnerClient?.save();
    } catch(error) { error.guard=true;throw error; }
  }
  function notice(message) {
    let p=document.getElementById('course-navigation-status');
    if(!p){p=document.createElement('p');p.id='course-navigation-status';p.setAttribute('role','status');document.querySelector('main').prepend(p);}
    p.textContent=message;p.scrollIntoView({block:'center'});
  }
  function cancelNavigation() { sequence++;navigationAbort?.abort();navigating=false; }
  async function navigate(url,{history=false,targetIndex=index}={}) {
    if(navigating)cancelNavigation();navigating=true;const serial=++sequence;
    if(!historyReady)currentURL=location.href;
    const controller=new AbortController();navigationAbort=controller;const deadline=setTimeout(()=>controller.abort(),12000);
    try {
      save();position.set(currentURL,[scrollX,scrollY]);
      // Fetch the normal URL so online reads still follow current published HTML
      // and the service worker can select verified HTML when offline.
      const requestURL=new URL(url);if(requestURL.pathname.endsWith('/'))requestURL.pathname+='index.html';
      const response=await fetch(requestURL.href,{cache:'no-store',headers:{'X-Lab-Navigation':'1'},signal:controller.signal});
      if(!response.ok)throw new Error('Use normal navigation for this response.');
      if(navigator.serviceWorker?.controller&&response.headers.get('X-Lab-Navigation')!=='1') {location[history?'replace':'assign'](url.href);return;}
      const html=await response.text();if(leaving||serial!==sequence)return;
      const doc=new DOMParser().parseFromString(html,'text/html');
      const main=doc.querySelector('main.v2-main');
      if(!main||doc.querySelector('meta[name="gpu-release"]')?.content!==release||!doc.documentElement.hasAttribute('data-course-session')) {
        location[history?'replace':'assign'](url.href);return;
      }
      // The learner may start a run while the destination is arriving. Recheck
      // before replacing any document state; storage/IME/restart guards still apply.
      save();if(serial!==sequence)return;
      for(const element of main.querySelectorAll('[src],[href],[poster]'))for(const name of ['src','href','poster']) {
        const value=element.getAttribute(name);if(value!=null)element.setAttribute(name,new URL(value,url.href).href);
      }
      // Keep shared chrome correct when moving between / and /v2/ routes.
      for(const el of document.querySelectorAll('head [href],head [src],.topbar [href],.topbar [src]'))for(const attr of ['href','src']) {
        const value=el.getAttribute(attr);if(value!=null)el.setAttribute(attr,new URL(value,location.href).href);
      }
      if(!historyReady){index=0;window.history.replaceState({...window.history.state,gpuLabSession:session,gpuLabIndex:index},'',currentURL);historyReady=true;}
      if(!history)window.history.pushState({gpuLabSession:session,gpuLabIndex:++index},'',url.href);
      else index=targetIndex;
      currentURL=url.href;
      for(const video of document.querySelectorAll('main video'))video.pause();
      replaceReadingContext();document.querySelector('main').replaceWith(document.adoptNode(main));document.title=doc.title;
      mountV2();mountRecordings();mountCompletion();
      // Lazy frames retain the standard load lifecycle, draft restoration and
      // release pin. The parent alone retains the expensive runtime worker.
      restoreReadingState({navigation:true});
      const heading=document.querySelector('main h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
      requestAnimationFrame(()=>{
        if(history&&position.has(url.href))scrollTo({left:position.get(url.href)[0],top:position.get(url.href)[1],behavior:'instant'});
        else if(url.hash){document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({behavior:'instant'});}
        else scrollTo({top:0,left:0,behavior:'instant'});
      });
      dispatchEvent(new CustomEvent('gpu-lab:lesson-changed'));
    } catch(error) {
      if(leaving||serial!==sequence)return;
      // Failed guards keep the current editor intact. Network/HTML failures use
      // the normal navigation path and the existing offline recovery mechanism.
      if(error.guard){
        if(history&&targetIndex!==index){suppressPop=true;window.history.go(index-targetIndex);}
        notice(error.message);
      }
      else location[history?'replace':'assign'](url.href);
    } finally {clearTimeout(deadline);if(serial===sequence)navigating=false;}
  }
  addEventListener('pagehide',()=>{leaving=true;cancelNavigation();});
  addEventListener('pageshow',()=>{leaving=false;});
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(!runner.worker&&!historyReady))return;
    const link=event.target.closest('a[href]');if(!link||link.target||link.hasAttribute('download'))return;
    const url=new URL(link.href);
    if(!eligible(url))return;
    if(url.pathname===location.pathname&&url.search===location.search){
      if(navigating)cancelNavigation();
      if(historyReady&&url.hash!==location.hash)pendingHash={href:url.href,index:index+1};
      return;
    }
    if(!runner.worker)return;
    event.preventDefault();navigate(url);
  });
  function hashHistory(state) {
    const url=new URL(location.href),previous=new URL(currentURL);
    if(url.pathname!==previous.pathname||url.search!==previous.search)return false;
    if(pendingHash?.href===url.href){
      index=pendingHash.index;pendingHash=null;window.history.replaceState({gpuLabSession:session,gpuLabIndex:index},'',url.href);
    } else if(state?.gpuLabSession===session)index=state.gpuLabIndex;
    else {historyReady=false;session=crypto.randomUUID();index=0;}
    currentURL=url.href;return true;
  }
  addEventListener('hashchange',()=>{if(historyReady&&pendingHash)hashHistory(window.history.state);});
  addEventListener('popstate',event=>{
    if(!historyReady)return;
    if(suppressPop){suppressPop=false;return;}
    if(hashHistory(event.state))return;
    if(event.state?.gpuLabSession!==session||!eligible(new URL(location.href))||navigating){location.reload();return;}
    // history already changed the address; save the outgoing lesson under its
    // own route before mounting the destination, not under the incoming URL.
    navigate(new URL(location.href),{history:true,targetIndex:event.state.gpuLabIndex});
  });
}
