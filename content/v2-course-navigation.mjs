import {materialSymbol} from '../src/material-symbols.mjs';
// Copyright © 2026 Christopher Snow.
import { v2Course } from './v2-course.mjs';
import { escape } from '../src/continuation-ui.mjs';
export const v2Groups = [
  ['part-cuda-foundations', 'CUDA foundations', 0, 4],
  ['part-gpu-execution', 'GPU execution and AI workloads', 4, 15],
  ['part-parallel-patterns', 'Parallel patterns', 15, 21],
  ['part-practical-work', 'Practical GPU investigations', 21, 27],
];
export function courseBreadcrumb(lesson, href) {
  const number = v2Course.indexOf(lesson);
  const [partId, partTitle] = v2Groups.find(([, , start, end]) => start <= number && number < end);
  return `<nav class="v2-breadcrumb" aria-label="Breadcrumb" data-transient-navigation><ol>
    <li><details class="v2-course-switcher" data-v2-course-outline data-transient-navigation>
      <summary aria-controls="v2-course-panel">Course lessons ${materialSymbol('expand_more')}<span class="v2-course-progress" aria-live="polite"></span></summary>
      <nav class="v2-course-panel" id="v2-course-panel" aria-label="Course contents">
        <p class="v2-course-tools"><a class="v2-course-overview" href="${href('contents')}">Course overview</a></p>
        <div class="v2-course-grid">
        ${v2Groups.map(([id, title, start, end]) => `<section class="v2-course-part" data-course-part="${id}" aria-labelledby="course-${id}">
          <h2 id="course-${id}">${escape(title)}</h2>
          <ol class="v2-course-lessons" start="${start + 1}">${v2Course.slice(start, end).map((item, offset) => `<li><a data-v2-completion-link="${item.slug}" href="${href(item.slug)}"${item === lesson ? ' aria-current="page"' : ''}>
            <span class="v2-course-number" aria-hidden="true">${String(start + offset + 1).padStart(2, '0')}</span><span>${escape(item.title)}${item === lesson ? '<span class="v2-course-current">Current lesson</span>' : ''}</span>
          <span class="v2-done-tick" role="img" aria-label="Complete" hidden>${materialSymbol('check')}</span></a></li>`).join('')}</ol>
        </section>`).join('')}
        </div>
      </nav></details></li>
    <li><span aria-hidden="true">/</span><a href="${href('contents', partId)}">${escape(partTitle)}</a></li>
    <li><span aria-hidden="true">/</span><span aria-current="page">${escape(lesson.title)}</span></li>
  </ol></nav>`;
}
