// Copyright © 2026 Christopher Snow.
import { v2Course } from './v2-course.mjs';
import { escape } from '../src/continuation-ui.mjs';
export const v2Groups = [
  ['part-cuda-foundations', 'CUDA foundations', 0, 4],
  ['part-gpu-execution', 'GPU execution and AI workloads', 4, 15],
  ['part-parallel-patterns', 'Parallel patterns', 15, 21],
];
export function courseBreadcrumb(lesson, href) {
  const number = v2Course.indexOf(lesson);
  const [partId, partTitle] = v2Groups.find(([, , start, end]) => start <= number && number < end);
  return `<nav class="v2-breadcrumb" aria-label="Breadcrumb"><ol>
    <li><details class="v2-course-switcher" data-v2-course-switcher data-transient-navigation>
      <summary aria-controls="v2-course-panel">Course <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg></summary>
      <nav class="v2-course-panel" id="v2-course-panel" aria-label="Course contents">
        <a class="v2-course-overview" href="${href('contents')}">Course overview</a>
        ${v2Groups.map(([id, title, start, end], index) => `<details class="v2-course-part" data-course-part="${id}"${id === partId ? ' open' : ''}>
          <summary>${index + 1} · ${escape(title)}</summary>
          <ol class="v2-course-lessons" start="${start + 1}">${v2Course.slice(start, end).map((item, offset) => `<li><a href="${href(item.slug)}"${item === lesson ? ' aria-current="page"' : ''}>
            <span class="v2-course-number" aria-hidden="true">${start + offset + 1}</span><span>${escape(item.title)}${item === lesson ? '<span class="v2-course-current">Current lesson</span>' : ''}</span>
          </a></li>`).join('')}</ol>
        </details>`).join('')}
      </nav></details></li>
    <li><span aria-hidden="true">/</span><a href="${href('contents', partId)}">${escape(partTitle)}</a></li>
    <li><span aria-hidden="true">/</span><span aria-current="page">${escape(lesson.title)}</span></li>
  </ol></nav>`;
}
