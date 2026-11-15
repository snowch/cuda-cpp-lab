// Copyright © 2026 Christopher Snow.
import { codePanel, definitions, readerTask } from '../src/chapter-view.mjs';
import { fp32, v2Experiments, v2Run } from '../src/v2-model.mjs';
import { guidedLessons } from '../src/v2-guided.mjs';
import { escape } from '../src/continuation-ui.mjs';
import { v2Course } from './v2-course.mjs';
import { programNotes, programTasks } from './v2-programs.mjs';
import { v2Diagram } from './v2-diagrams.mjs';

const teaching = {
  scale: {
    before: 'Now give the kernel five input values. Each thread reads one input and writes the result to the same index in the output array.',
    terms: [['FP32', 'A floating-point value stored in four bytes.']],
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
  ['CUDA foundations', 0, 4],
  ['GPU execution and AI workloads', 4, 15],
  ['Parallel patterns', 15, 21],
];

export function renderV2Contents(href) {
  return `<header class="intro">
    <h1>Learn the GPU through CUDA</h1>
    <p class="lead">Start with one small CUDA program. Edit code, predict the result and run an experiment. Later lessons trace memory, synchronisation and the parallel patterns behind AI workloads.</p>
    <p><a class="v2-start" href="${href(v2Course[0].slug)}">Start with your first kernel →</a></p>
  </header>
  ${groups.map(([title, start, end]) => `<section class="v2-list">
    <h2>${title}</h2>
    <ol start="${start + 1}">${v2Course.slice(start, end).map(lesson => `<li>
      <a href="${href(lesson.slug)}">${lesson.title}</a>
      <p>${lesson.goal}</p>
    </li>`).join('')}</ol>
  </section>`).join('')}`;
}

function workbenchEditor(mode, href, title) {
  const source = href === 'bundled' ? '' : ` src="${href}?embed=${mode}"`;
  return `<iframe class="v2-inline-workbench" data-kernel-workbench="${mode}"${source} title="${title}"></iframe>`;
}

function renderFirstKernel(workbenchHref, program) {
  const kernel = program.slice(program.indexOf('__global__'), program.indexOf('\n\nvoid check'));
  return `<section class="book-section" aria-labelledby="v2-first-kernel">
    <h2 id="v2-first-kernel">Launch one CUDA thread</h2>
    <p>A CUDA kernel is a function that runs on the GPU. Each GPU thread runs the function once. This example launches just one thread to write a single value.</p>
    <p>The CPU allocates a GPU buffer for one <code>float</code>. The launch <code>hello&lt;&lt;&lt;1, 1&gt;&gt;&gt;(output)</code> asks for one block with one thread. After the kernel writes <code>output[0]</code>, the CPU copies that value back for the console.</p>
    ${workbenchHref ? readerTask('Run the kernel. Change 42.0f to 7.0f and run again. Which value does the console show?', 'Try it') : ''}
    ${workbenchHref ? workbenchEditor('hello', workbenchHref, 'Editable one-thread CUDA kernel and output') :
      codePanel({id: 'v2-first-source', label: 'CUDA C++ · first kernel', source: kernel, explainedLocally: true})}
    ${workbenchHref ? `<noscript>${codePanel({id: 'v2-first-source', label: 'CUDA C++ · first kernel', source: kernel, explainedLocally: true})}</noscript>` : ''}
    ${!workbenchHref ? `<details class="more-settings">
      <summary>Show host code</summary>
      <p>This complete CUDA program shows the allocation, launch and copy back. Its <code>printf</code> runs on the CPU.</p>
      ${codePanel({id: 'v2-first-program', label: 'CUDA C++ · complete program', source: program, explainedLocally: true})}
    </details>` : ''}
    <p>With five threads running the same function, how does each thread know which element to write?</p>
  </section>`;
}

function renderWorkbench(mode, href) {
  const tasks = {
    scale: 'Change 2.0f to 3.0f. Predict the output at index 2, then compile and run.',
    bounds: 'In main(), change threadsPerBlock from 4 to 3. Predict how many threads launch. Run, then open Trace CUDA calls to check.',
    copies: 'Add 6.0f, 7.0f, 8.0f and 9.0f to x in main(). Run and open Trace CUDA calls. Compare the copy sizes and launch with the five-input run.',
  };
  return `<h3>Run the CUDA program</h3>
    <p>Edit the kernel or main(). Clang compiles the program. The browser runs main() and launches the kernel in GPGPU-Sim.</p>
    ${readerTask(tasks[mode], 'Try it')}
    ${workbenchEditor(mode, href, 'Editable CUDA program and output')}`;
}

function renderActivity({mode, slug}, legacy, workbenchHref) {
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
    ${v2Diagram(slug)}
  </section>
  <section class="book-section v2-experiment" data-v2-mode="${mode}" aria-labelledby="v2-activity">
    <h2 id="v2-activity">${workbenchHref ? 'Edit and run CUDA' : 'Change hello.cu'}</h2>
    ${workbenchHref ? renderWorkbench(mode, workbenchHref) + '<details class="more-settings v2-starter-model"><summary>Explore a model of the starter program</summary>' : ''}
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
    ${workbenchHref ? '</details>' : ''}
  </section>
  <section class="book-section" aria-labelledby="v2-apply">
    <h2 id="v2-apply">Apply what you saw</h2>
    <p>${lesson.transfer}</p>
    <details class="more-settings"><summary>Compare your explanation</summary><p>${lesson.answer}</p></details>
  </section>`;
}

function renderGuided(slug, workbenchHref) {
  const lesson = guidedLessons[slug];
  const codeLabel = slug === 'attention' ? 'CUDA algorithm outline' : 'CUDA C++ excerpt';
  return `<section aria-labelledby="v2-setup">
    <h2 id="v2-setup">Before you run</h2>
    <p>${lesson.before}</p>
    ${definitions(lesson.terms)}
    ${v2Diagram(slug)}
  </section>
  ${workbenchHref ? `<section class="book-section" aria-labelledby="v2-cuda-editor">
    <h2 id="v2-cuda-editor">Edit and run CUDA</h2>
    ${programNotes[slug] ? `<p>${programNotes[slug]}</p>` : ''}
    ${readerTask(programTasks[slug], 'Try it')}
    ${workbenchEditor(slug, workbenchHref, 'Editable CUDA program and output')}
  </section>
  <details class="more-settings v2-starter-model"><summary>Explore the architecture model</summary>` : ''}
  <section class="book-section v2-experiment" data-v2-guided="${slug}" aria-labelledby="v2-activity">
    <h2 id="v2-activity">Predict and run</h2>
    ${readerTask(lesson.task, 'Try it')}
    <p class="chapter-browser-note">No installation or GPU is required. The controls change the source shown below. Run model traces the selected case using the assumptions above.</p>
    <noscript><p class="notice">Enable JavaScript to change settings and run the model. You can still read the starter and compare the final explanation below.</p></noscript>
    <div class="v2-workbench">
      <div>
        ${codePanel({ id: 'v2-source', label: codeLabel, source: lesson.code(lesson.cases[0][0]), explainedLocally: true })}
        <p class="v2-note">${lesson.inspect}</p>
      </div>
      <form class="v2-controls">
        <label for="v2-choice">${lesson.label}</label>
        <select id="v2-choice" disabled>${lesson.cases.map(([, label], index) =>
          `<option value="${index}">${escape(label)}</option>`).join('')}</select>
        <label for="v2-prediction">${lesson.question}</label>
        <input id="v2-prediction" type="number" step="any" placeholder="Optional" disabled>
        <button class="primary" id="v2-run" disabled>Run model</button>
        <p id="v2-feedback" role="status">Predict the result, then run the model.</p>
      </form>
    </div>
    <div id="v2-result" hidden>
      <div data-summary></div>
      <div class="v2-step-actions" data-steps hidden>
        <button type="button" data-prev>Previous step</button>
        <output data-position aria-live="polite"></output>
        <button type="button" data-next>Next step</button>
      </div>
      <div data-trace></div>
    </div>
  </section>
  ${workbenchHref ? '</details>' : ''}
  <section class="book-section" aria-labelledby="v2-apply">
    <h2 id="v2-apply">Apply what you saw</h2>
    <p>${lesson.transfer}</p>
    <details class="more-settings"><summary>Compare your explanation</summary><p>${lesson.answer}</p></details>
  </section>`;
}

export function renderV2Lesson(lesson, href, legacy, workbenchHref, firstProgram = '') {
  const number = v2Course.indexOf(lesson) + 1;
  const previous = v2Course[number - 2];
  const next = v2Course[number];
  return `<header class="intro">
    <p class="eyebrow">Lesson ${number}</p>
    <h1>${lesson.title}</h1><p class="lead">${lesson.goal}</p>
  </header>
  ${lesson.mode === 'hello' ? renderFirstKernel(workbenchHref, firstProgram) :
    lesson.mode ? renderActivity(lesson, legacy, workbenchHref) : renderGuided(lesson.slug, workbenchHref)}
  <p><a href="${legacy(lesson.current)}">Explore this topic in GPU Lab V1 →</a></p>
  <nav class="v2-pager" aria-label="Lesson sequence">
    <a href="${href(previous?.slug ?? 'contents')}">← ${previous?.title ?? 'Contents'}</a>
    <a href="${href(next?.slug ?? 'contents')}">${next?.title ?? 'Contents'} →</a>
  </nav>`;
}

export const v2Styles = ['style.css', 'lessons.css', 'chapter.css', 'continuation.css', 'parallel.css', 'v2.css'];
export function renderV2Page(lesson, versionMarkup = '', { home = false, firstProgram = '' } = {}) {
  const base = home ? './' : '../';
  const href = slug => slug === 'contents' ? base : `${home ? './v2/' : './'}${slug}.html`;
  const legacy = slug => `${base}lessons/${slug}.html`;
  const title = lesson ? lesson.title + ' · GPU Lab V2' : 'GPU Lab V2';
  const styles = v2Styles.map(name => `<link rel="stylesheet" href="${base}src/${name}">`).join('');
  return `<!doctype html>
<!-- Copyright © 2026 Christopher Snow. -->
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${title}</title>${styles}
<script type="module" src="${base}src/theme.mjs"></script>
${lesson ? `<script type="module" src="${base}src/v2.mjs"></script>` : ''}
${home ? '<script type="module" src="./src/v2-legacy-links.mjs"></script>' : ''}</head>
<body class="book-chapter v2-book">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar v2-topbar"><a class="brand" href="${base}">GPU Lab V2</a>
<div class="top-actions"><a href="${base}">Contents</a><a href="${base}v1.html">GPU Lab V1</a>
<button id="theme" type="button" aria-label="Switch colour theme">Theme</button></div></header>
<main id="main" class="v2-main">${lesson ? renderV2Lesson(lesson, href, legacy, './cuda-source-workbench.html', firstProgram) : renderV2Contents(href)}<footer><span>Copyright © 2026 Christopher Snow.</span>${lesson ? '<a href="./cuda-source-workbench.html#software-licences">Software licences</a>' : ''}${versionMarkup}</footer></main>
</body></html>`;
}
