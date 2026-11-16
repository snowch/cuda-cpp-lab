// Copyright © 2026 Christopher Snow.
// Native details remain usable without scripts. Enhancement adds bounded overlay
// positioning and dismissal; this is a navigation disclosure, not an ARIA menu.
const openSwitchers = () => document.querySelectorAll('[data-v2-course-switcher][open]');
function fit(switcher) {
  const panel = switcher.querySelector('.v2-course-panel');
  const anchor = switcher.closest('.v2-breadcrumb').getBoundingClientRect();
  const below = innerHeight - anchor.bottom - 24, above = anchor.top - Math.max(24, (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0) + 12);
  const upward = below < 180 && above > below;
  switcher.dataset.placement = upward ? 'above' : 'below';
  panel.style.setProperty('--v2-course-height', `${Math.max(0, upward ? above : below)}px`);
}
export function mountCourseNavigation(root = document) {
  for (const switcher of root.querySelectorAll('[data-v2-course-switcher]')) {
    if (switcher.dataset.enhanced) continue;
    switcher.dataset.enhanced = 'true';
    switcher.addEventListener('toggle', () => {
      if (!switcher.open) return;
      fit(switcher);
      requestAnimationFrame(() => {
        if (!switcher.open) return;
        const panel = switcher.querySelector('.v2-course-panel');
        const current = panel.querySelector('a[aria-current="page"]');
        if (!current?.getClientRects().length) return;
        const item = current.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
        if (item.bottom > bounds.bottom) panel.scrollTop += item.bottom - bounds.bottom + 12;
        else if (item.top < bounds.top) panel.scrollTop -= bounds.top - item.top + 12;
      });
    });
    switcher.addEventListener('focusout', event => {
      if (event.relatedTarget && !switcher.contains(event.relatedTarget)) switcher.open = false;
    });
    switcher.addEventListener('click', event => {
      if (event.target.closest('a')) switcher.open = false;
    });
  }
}
document.addEventListener('pointerdown', event => {
  for (const switcher of openSwitchers()) if (!switcher.contains(event.target)) switcher.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  for (const switcher of openSwitchers()) {
    switcher.open = false;
    switcher.querySelector(':scope > summary').focus({preventScroll:true});
    event.preventDefault();
  }
});
addEventListener('resize', () => { for (const switcher of openSwitchers()) fit(switcher); });
