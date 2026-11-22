// Copyright © 2026 Christopher Snow.
// Native details supplies the fallback. Enhancement puts its outline after the
// complete breadcrumb row, so it spans the page and expands in normal flow.
const openSwitchers = () => document.querySelectorAll('[data-v2-course-outline][open]');
export function mountCourseNavigation(root = document) {
  for (const switcher of root.querySelectorAll('[data-v2-course-outline]')) {
    if (switcher.dataset.enhanced) continue;
    const breadcrumb=switcher.closest('.v2-breadcrumb');
    const panel=switcher.querySelector('.v2-course-panel');
    switcher.dataset.enhanced='true';
    breadcrumb.append(panel);
    const sync=()=>{panel.hidden=!switcher.open;};
    sync();switcher.addEventListener('toggle',sync);
    panel.addEventListener('click',event=>{
      if(event.target.closest('a')){switcher.open=false;sync();}
    });
  }
}
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  for(const switcher of openSwitchers()){
    const breadcrumb=switcher.closest('.v2-breadcrumb');
    if(!breadcrumb.contains(event.target))continue;
    switcher.open=false;breadcrumb.querySelector('.v2-course-panel').hidden=true;
    const trigger=switcher.querySelector(':scope > summary');trigger.focus({preventScroll:true});
    const rect=trigger.getBoundingClientRect(),header=document.querySelector('.topbar')?.getBoundingClientRect().bottom??0;
    if(rect.top<header||rect.bottom>innerHeight)scrollTo({top:scrollY+rect.top-header-12,behavior:'instant'});
    event.preventDefault();
  }
});
