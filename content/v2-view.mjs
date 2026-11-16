// Copyright © 2026 Christopher Snow.
import { renderPractical, practicalReferences } from './v2-practical-view.mjs';
import { codePanel, definitions, readerTask } from '../src/chapter-view.mjs';
import { fp32, v2Experiments, v2Run } from '../src/v2-model.mjs';
import { guidedLessons } from '../src/v2-guided.mjs';
import { escape } from '../src/continuation-ui.mjs';
import { courseBreadcrumb, v2Groups as groups } from './v2-course-navigation.mjs';
import { v2Course } from './v2-course.mjs';
import { programNotes, programTasks } from './v2-programs.mjs';
import { v2Diagram } from './v2-diagrams.mjs';
import { lessonContexts, starterFor } from './v2-lesson-context.mjs';
import { renderV2Hardware } from './v2-hardware.mjs';
import { renderV2References } from './v2-references.mjs';
import { renderV2Video } from './v2-lesson-video.mjs';
import { renderFirstKernelVideo } from './v2-first-kernel-video.mjs';

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

export function renderV2Contents(href) {
  return `<header class="intro">
    <h1>Learn the GPU through CUDA</h1>
    <p class="lead">Start with one small CUDA program. Edit code, predict the result and run an experiment. Later lessons trace memory, synchronisation and the parallel patterns behind AI workloads.</p>
    <p><a class="v2-start" href="${href(v2Course[0].slug)}">Start with your first kernel →</a></p>
  </header>
  ${groups.map(([id, title, start, end]) => `<section class="v2-list" aria-labelledby="${id}">
    <h2 id="${id}" tabindex="-1">${title}</h2>
    <ol start="${start + 1}">${v2Course.slice(start, end).map(lesson => `<li data-course-kind="${lesson.practical ? 'practical' : 'core'}">
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
  const kernel = program.match(/^__global__[^]*?^}/m)?.[0];
  const launch = program.match(/^\s*(hello<<<[^\n]+;)$/m)?.[1];
  if (!kernel || !launch) throw new Error('Lesson 1 needs a kernel and launch in the starter.');

  return `<section class="book-section" aria-labelledby="v2-first-kernel">
    <h2 id="v2-first-kernel">What is a CUDA kernel?</h2>
    <p>A kernel is a function that GPU threads execute. In CUDA C++, <code>__global__</code> declares a kernel. Each thread launched for <code>hello</code> runs its body once. The body stores a value at <code>output[0]</code> in GPU memory.</p>
    ${codePanel({id: 'v2-first-source', label: 'CUDA C++ · Kernel definition', source: kernel, explainedLocally: true})}
    <h3>Launch the kernel from main()</h3>
    <p>The CPU code in <code>main()</code> reserves space for one <code>float</code> in GPU memory. It launches <code>hello</code> and passes the address of that space as <code>output</code>.</p>
    ${codePanel({id: 'v2-first-launch', label: 'CUDA C++ · Launch inside main()', source: launch, explainedLocally: true})}
    <p>The first <code>1</code> asks for one block, a group of GPU threads. The second <code>1</code> asks for one thread in that block. After the thread writes the value, <code>main()</code> copies it back and prints it.</p>
    ${workbenchHref ? readerTask('In hello.cu, compile and run the starter. Change 42.0f to 7.0f in hello and predict the Console output. Compile and run again to check.', 'Try it') : ''}
    ${workbenchHref ? workbenchEditor('hello', workbenchHref, 'Editable CUDA program with one kernel and its launch') : `<details class="more-settings">
      <summary>Show complete program</summary>
      ${codePanel({id: 'v2-first-program', label: 'CUDA C++ · complete program', source: program, explainedLocally: true})}
    </details>`}
  </section>
  <section class="book-section" aria-labelledby="v2-first-path">
    <h2 id="v2-first-path">Where does the kernel run?</h2>
    <p>A <strong>streaming multiprocessor (SM)</strong> is a part of the GPU that executes thread instructions.</p>
    ${v2Diagram('first-kernel')}
  </section>
  ${renderV2Hardware('first-kernel')}
  <p>In the next lesson, threads run one kernel to process five values. How will each thread choose its own array element?</p>`;
}

function renderStarter(slug, workbenchHref) {
  const context = lessonContexts[slug];
  return `<h3>Read the starter</h3>
    ${codePanel({id: 'v2-starter-source', label: context.label, source: context.code, explainedLocally: true})}
    <p>${escape(context.explanation)}</p>
    ${codePanel({id: 'v2-starter-launch', label: 'CUDA C++ · launch inside main()', source: context.launches, explainedLocally: true})}
    <p>The dimensions inside <code>&lt;&lt;&lt; &gt;&gt;&gt;</code> choose the grid and block size; the parentheses pass kernel arguments. See <code>main()</code> in the ${workbenchHref ? 'editor' : 'complete program'} for the storage and dimension definitions. These excerpts describe the fixed starter.</p>
    ${!workbenchHref ? `<details class="more-settings"><summary>Read the complete CUDA starter</summary>${codePanel({id:'v2-fixed-program',label:'CUDA C++ · complete starter program',source:starterFor(slug),explainedLocally:true})}</details>` : '<p>Editing the program does not change these fixed excerpts.</p>'}`;
}

function renderContext(slug) {
  return `<section class="book-section" aria-labelledby="v2-execution-title">
    <h2 id="v2-execution-title">Execution trace</h2>
    ${v2Diagram(slug)}
  </section>
  ${renderV2Hardware(slug)}`;
}

function renderWorkbench(mode, href) {
  const tasks = {
    scale: 'Change 2.0f to 3.0f. Predict the output at index 2, then compile and run.',
    bounds: 'In main(), change threadsPerBlock from 4 to 3. Predict how many threads launch. Run, then open Trace CUDA calls to check.',
    copies: 'Add 6.0f, 7.0f, 8.0f and 9.0f to x in main(). Run and open Trace CUDA calls. Compare the copy sizes and launch with the five-input run.',
  };
  return `<h3>Run the CUDA program</h3>
    <p>No installation or GPU is required. Edit and run the complete CUDA program in this browser. The run checks the program in simulation; it does not measure a physical GPU.</p>
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
    ${renderStarter(slug, workbenchHref)}
  </section>
  <section class="book-section v2-experiment" data-v2-mode="${mode}" aria-labelledby="v2-activity">
    <h2 id="v2-activity">${workbenchHref ? 'Edit and run CUDA' : 'Change hello.cu'}</h2>
    ${workbenchHref ? renderWorkbench(mode, workbenchHref) + renderContext(slug) + '<details class="more-settings v2-starter-model"><summary>Explore a model of the starter program</summary>' : ''}
    ${!workbenchHref ? renderContext(slug) : ''}
    ${readerTask(lesson.task, 'Try it')}
    <p class="chapter-browser-note">No installation or GPU is required. Run model applies the shown CUDA operation in the browser. ${workbenchHref ? 'Compile and run the complete program in the editor above.' : 'This preview runs the teaching model.'} For optional local execution, use the <a href="${legacy('desktop')}#first-cuda">desktop CUDA setup</a>.</p>
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
    <p>${escape(lessonContexts[slug].introduction ?? lesson.before)}</p>
    ${definitions(lesson.terms)}
    ${renderStarter(slug, workbenchHref)}
  </section>
  ${workbenchHref ? `<section class="book-section" aria-labelledby="v2-cuda-editor">
    <h2 id="v2-cuda-editor">Edit and run CUDA</h2>
    <p>No installation or GPU is required. Edit and run the complete CUDA program in this browser. The run checks the program in simulation; it does not measure a physical GPU.</p>
    ${programNotes[slug] ? `<p>${programNotes[slug]}</p>` : ''}
    ${readerTask(programTasks[slug], 'Try it')}
    ${workbenchEditor(slug, workbenchHref, 'Editable CUDA program and output')}
  </section>
  ${renderContext(slug)}
  <details class="more-settings v2-starter-model"><summary>Explore the execution model</summary>` : renderContext(slug)}
  <section class="book-section v2-experiment" data-v2-guided="${slug}" aria-labelledby="v2-activity">
    <h2 id="v2-activity">Predict and run</h2>
    ${lessonContexts[slug].introduction ? `<p>${escape(lesson.before)}</p>` : ''}
    ${readerTask(lesson.task, 'Try it')}
    <p class="chapter-browser-note">No installation or GPU is required. The controls change the source shown below. Run model traces the selected starter case using the assumptions above. These controls do not execute changes from the CUDA editor.</p>
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

const practicalConnections = {
  'from-cpu-array-to-gpu-result': ['verify-every-output', 'Learn to check every GPU result'],
  scan: ['multi-block-scan', 'Extend a prefix across blocks'],
  'matmul-investigation': ['resource-tradeoffs', 'Investigate SM resource limits'],
};
export function renderV2Lesson(lesson, href, legacy, workbenchHref, firstProgram = '') {
  const number = v2Course.indexOf(lesson) + 1;
  const connection = practicalConnections[lesson.slug];
  const previous = v2Course[number - 2];
  const next = v2Course[number];
  return `<header class="intro">
    ${courseBreadcrumb(lesson, href)}
    <p class="eyebrow">Lesson ${number}</p>
    <h1>${lesson.title}</h1><p class="lead">${lesson.goal}</p>
  </header>
  ${lesson.practical ? renderPractical(lesson, workbenchHref, legacy) : lesson.mode === 'hello' ? renderFirstKernel(workbenchHref, firstProgram) :
    lesson.mode ? renderActivity(lesson, legacy, workbenchHref) : renderGuided(lesson.slug, workbenchHref)}
  ${connection ? `<p>Further practice: <a href="${href(connection[0])}">${connection[1]}</a>.</p>` : ''}
  <section class="v2-resources" aria-label="Optional lesson resources">
    ${lesson.practical ? '' : lesson.mode === 'hello' ? renderFirstKernelVideo(workbenchHref && workbenchHref !== 'bundled') : renderV2Video(lesson.slug, workbenchHref && workbenchHref !== 'bundled')}
    ${lesson.practical ? practicalReferences(lesson.slug) : lesson.mode === 'hello' ? renderV2References(lesson.slug).replaceAll('v2-references', 'v2-first-references') : renderV2References(lesson.slug)}
  </section>
  <nav class="v2-pager" aria-label="Lesson sequence">
    <a class="v2-page-card" href="${href(previous?.slug ?? 'contents')}">
      <span class="v2-page-direction">${previous ? '← Previous lesson' : 'Course overview'}</span>
      <strong>${escape(previous?.title ?? 'Choose a lesson')}</strong>
    </a>
    <a class="v2-page-card v2-page-next" href="${href(next?.slug ?? 'contents')}">
      <span class="v2-page-direction">${next ? 'Next lesson →' : 'Course overview'}</span>
      <strong>${escape(next?.title ?? 'Choose a lesson')}</strong>
    </a>
  </nav>`;
}

export const v2Styles = ['style.css', 'lessons.css', 'chapter.css', 'continuation.css', 'parallel.css', 'sm-video.css', 'v2.css'];
export function renderV2Page(lesson, versionMarkup = '', { home = false, firstProgram = '' } = {}) {
  const base = home ? './' : '../';
  const href = (slug, part) => slug === 'contents' ? base + (part ? '#' + part : '') : `${home ? './v2/' : './'}${slug}.html`;
  const legacy = slug => `${base}lessons/${slug}.html`;
  const title = lesson ? lesson.title + ' · GPU Lab V2' : 'GPU Lab V2';
  const styles = v2Styles.map(name => `<link rel="stylesheet" href="${base}src/${name}">`).join('');
  return `<!doctype html>
<!-- Copyright © 2026 Christopher Snow. -->
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${title}</title>${styles}
<script type="module" src="${base}src/theme.mjs"></script>
${lesson ? `<script type="module" src="${base}src/v2.mjs"></script><script type="module" src="${base}src/recording.mjs"></script>` : ''}
${home ? '<script type="module" src="./src/v2-legacy-links.mjs"></script>' : ''}</head>
<body class="book-chapter v2-book">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar v2-topbar"><a class="brand" href="${base}">GPU Lab V2</a>
<div class="top-actions"><a href="${base}v1.html">GPU Lab V1</a>
<button id="theme" type="button" aria-label="Switch colour theme">Theme</button></div></header>
<main id="main" class="v2-main">${lesson ? renderV2Lesson(lesson, href, legacy, './cuda-source-workbench.html', firstProgram) : renderV2Contents(href)}<footer><span>Copyright © 2026 Christopher Snow.</span>${lesson ? '<a href="./cuda-source-workbench.html#software-licences">Software licences</a>' : ''}${versionMarkup}</footer></main>
</body></html>`;
}
