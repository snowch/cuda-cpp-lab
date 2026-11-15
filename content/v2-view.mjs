// Copyright © 2026 Christopher Snow.
import { codePanel, definitions, readerTask } from '../src/chapter-view.mjs';
import { fp32, v2Experiments, v2Run } from '../src/v2-model.mjs';
import { v2Course } from './v2-course.mjs';

const teaching = {
  scale: {
    before: 'Start with five input values. Each thread reads one input and writes the result to the same index in the output array.',
    terms: [['CUDA kernel', 'A function launched from the CPU that runs on the GPU.'],
      ['Thread', 'One execution of the kernel.'], ['FP32', 'A floating-point value stored in four bytes.']],
    inspect: 'In runKernel, the index i selects both the input and the output. The f on 2.0f makes the multiplier an FP32 value.',
    task: 'Run with a multiplier of 2.0. Change it to 3.0 and predict what thread 2 will write. Run again and follow that row.',
    transfer: 'If you change the multiplier to 0.5, do the threads pick different inputs?',
    answer: 'No. The thread indices stay the same. The result at index 2 changes to 1.5 because its input is still 3.0.',
  },
  bounds: {
    before: 'Keep the five input values and the same kernel. Now choose how many threads go in each block.',
    terms: [['Block', 'A group of threads launched together.'],
      ['Bounds check', 'A condition that prevents a thread from accessing an array beyond its valid indices.']],
    inspect: 'blockIdx.x is the block number. blockDim.x is its size. threadIdx.x is the thread’s index within that block. Multiplying the block number by the block size and adding the local index gives i.',
    task: 'Run two blocks of four threads. Then choose three threads per block and predict which thread indices will stop before reading or writing.',
    transfer: 'The input still has five values. Why does one block of eight threads skip the same indices as two blocks of four?',
    answer: 'Both launches produce indices 0 through 7. The grouping changes, and the condition i < n still allows indices 0 through 4.',
  },
  copies: {
    before: 'The input array x starts in CPU memory. The kernel reads from a GPU input array and writes to a separate GPU output array. Follow how the CPU sets up that work and gets the result back.',
    terms: [['Host', 'The CPU side of a CUDA program.'], ['Device', 'The GPU side of a CUDA program.'],
      ['Allocation', 'A request for enough storage to hold the data.']],
    inspect: 'n is the number of elements in x. sizeof(x) gives its size in bytes. cudaMalloc reserves storage, and cudaMemcpy moves the values between the host and device.',
    task: 'Run with five inputs and step through the four operations. Change to nine inputs and predict the size of each GPU allocation and the number of blocks.',
    transfer: 'With nine inputs, when can the CPU first read the results from y?',
    answer: 'After the device-to-host copy. The kernel has written nine results to the GPU output array before that copy fills the CPU array y.',
  },
};

const groups = [
  ['CUDA foundations', 0, 3],
  ['GPU execution and AI workloads', 3, 14],
  ['Parallel patterns', 14, 20],
];

export function renderV2Contents(href) {
  return `<header class="intro">
    <h1>Learn the GPU through CUDA</h1>
    <p class="lead">Start with one small program. Change its source, run a model, and inspect what each thread does.</p>
    <p><a class="v2-start" href="${href(v2Course[0].slug)}">Start with one thread, one element →</a></p>
  </header>
  ${groups.map(([title, start, end]) => `<section class="v2-list">
    <h2>${title}</h2>
    <ol start="${start + 1}">${v2Course.slice(start, end).map(lesson => `<li>
      <a href="${href(lesson.slug)}">${lesson.title}</a>
      ${lesson.mode ? '' : '<span class="v2-status">Planned</span>'}
      <p>${lesson.goal}</p>
    </li>`).join('')}</ol>
  </section>`).join('')}`;
}

function renderActivity(mode, legacy, workbenchHref) {
  const lesson = teaching[mode];
  const experiment = v2Experiments[mode];
  const initial = v2Run(mode, experiment.initial);
  const format = mode === 'scale' ? fp32 : String;
  const codeLabel = mode === 'scale' ? 'CUDA C++ · runKernel' :
    mode === 'bounds' ? 'CUDA C++ · kernel and launch' : 'CUDA C++ · input and allocation';
  return `<section aria-labelledby="v2-setup">
    <h2 id="v2-setup">Before you run</h2>
    <p>${lesson.before}</p>
    ${definitions(lesson.terms)}
  </section>
  <section class="book-section v2-experiment" data-v2-mode="${mode}" aria-labelledby="v2-activity">
    <h2 id="v2-activity">Change hello.cu</h2>
    ${mode === 'scale' && workbenchHref ? `<p><a class="v2-start" href="${workbenchHref}">Edit, compile and run the CUDA kernel →</a></p>` : ''}
    ${readerTask(lesson.task, 'Try it')}
    <p class="chapter-browser-note">No installation or GPU is required. Run model applies the shown CUDA operation in the browser. To compile the complete program, use the downloaded file with the <a href="${legacy('desktop')}#first-cuda">desktop CUDA setup</a>.</p>
    <noscript><p class="notice">Enable JavaScript to change and run the model. The starter source and explanation are readable below.</p></noscript>
    <div class="v2-workbench">
      <div>
        ${codePanel({ id: 'v2-source', label: codeLabel, source: initial.excerpt, explainedLocally: true })}
        <p class="v2-note">${lesson.inspect}</p>
      </div>
      <div class="v2-controls">
        <label for="v2-choice">${experiment.label}</label>
        <select id="v2-choice" disabled>${experiment.choices.map(value =>
          `<option value="${value}"${value === experiment.initial ? ' selected' : ''}>${format(value)}</option>`).join('')}</select>
        <p class="v2-input"><strong>Input</strong> <code data-v2-input>[${initial.input.map(fp32).join(', ')}]</code></p>
        <button class="primary" id="v2-run" type="button" disabled>Run model</button>
        <p id="v2-feedback" role="status">Run to see the result.</p>
      </div>
    </div>
    <div id="v2-result" hidden></div>
    <details class="more-settings">
      <summary>Complete hello.cu</summary>
      ${codePanel({ id: 'v2-full', label: 'CUDA C++ · complete program', source: initial.source, explainedLocally: true })}
      <button id="v2-download" type="button" disabled>Download hello.cu</button>
    </details>
  </section>
  <section class="book-section" aria-labelledby="v2-apply">
    <h2 id="v2-apply">Apply what you saw</h2>
    <p>${lesson.transfer}</p>
    <details class="more-settings"><summary>Compare your explanation</summary><p>${lesson.answer}</p></details>
  </section>`;
}

export function renderV2Lesson(lesson, href, legacy, workbenchHref) {
  const number = v2Course.indexOf(lesson) + 1;
  const previous = v2Course[number - 2];
  const next = v2Course[number];
  return `<header class="intro">
    <p class="eyebrow">Lesson ${number}${lesson.mode ? '' : ' · Planned'}</p>
    <h1>${lesson.title}</h1><p class="lead">${lesson.goal}</p>
  </header>
  ${lesson.mode ? renderActivity(lesson.mode, legacy, workbenchHref) : `<section class="v2-stub">
    <h2>Planned lesson</h2>
    <p>For now, see the <a href="${legacy(lesson.current)}">related lesson in the current course</a>.</p>
  </section>`}
  <nav class="v2-pager" aria-label="Lesson sequence">
    <a href="${href(previous?.slug ?? 'contents')}">← ${previous?.title ?? 'Contents'}</a>
    <a href="${href(next?.slug ?? 'contents')}">${next?.title ?? 'Contents'} →</a>
  </nav>`;
}

export const v2Styles = ['style.css', 'lessons.css', 'chapter.css', 'v2.css'];
export function renderV2Page(lesson, versionMarkup = '') {
  const href = slug => slug === 'contents' ? './' : `./${slug}.html`;
  const legacy = slug => `../lessons/${slug}.html`;
  const title = lesson ? lesson.title + ' · GPU Lab V2' : 'GPU Lab V2';
  const styles = v2Styles.map(name => `<link rel="stylesheet" href="../src/${name}">`).join('');
  return `<!doctype html>
<!-- Copyright © 2026 Christopher Snow. -->
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${title}</title>${styles}
<script type="module" src="../src/theme.mjs"></script>
${lesson?.mode ? '<script type="module" src="../src/v2.mjs"></script>' : ''}</head>
<body class="book-chapter v2-book">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar v2-topbar"><a class="brand" href="./">GPU Lab V2</a>
<div class="top-actions"><a href="./">Contents</a><a href="../index.html">Current course</a>
<button id="theme" type="button" aria-label="Switch colour theme">Theme</button></div></header>
<main id="main" class="v2-main">${lesson ? renderV2Lesson(lesson, href, legacy, './cuda-source-workbench.html') : renderV2Contents(href)}<footer><span>Copyright © 2026 Christopher Snow.</span>${versionMarkup}</footer></main>
</body></html>`;
}
