// Copyright © 2026 Christopher Snow.
import { renderPractical, practicalReferences } from './v2-practical-view.mjs';
import { codePanel, definitions, readerTask } from '../src/chapter-view.mjs';
import { fp32, v2Experiments, v2Run } from '../src/v2-model.mjs';
import { guidedLessons } from '../src/v2-guided.mjs';
import { escape } from '../src/continuation-ui.mjs';
import { courseBreadcrumb, v2Groups as groups } from './v2-course-navigation.mjs';
import { v2Course } from './v2-course.mjs';
import { programEvidence, programNotes, programTasks } from './v2-programs.mjs';
import { v2Diagram } from './v2-diagrams.mjs';
import { lessonContexts, starterFor } from './v2-lesson-context.mjs';
import { renderV2Hardware } from './v2-hardware.mjs';
import { renderV2References } from './v2-references.mjs';
import { renderV2Video } from './v2-lesson-video.mjs';
import { renderFirstKernelVideo } from './v2-first-kernel-video.mjs';
import { renderV2Brand } from './v2-brand.mjs';

const modelTopics = {
  scale: 'thread outputs', bounds: 'thread indices and bounds', copies: 'allocation and copies',
  coalescing: 'lane addresses and sectors', scheduling: 'ready and waiting warps',
  divergence: 'active lanes and branch paths', reduction: 'shared reduction stages',
  'shared-memory-banks': 'shared-bank requests', matmul: 'input-tile reuse',
  precision: 'input rounding', 'tensor-cores': 'warp-wide matrix calls',
  attention: 'online softmax steps', inference: 'cache-data accounting',
  'matmul-investigation': 'SM resource limits', histograms: 'atomic counter updates',
  scan: 'prefix stages', compaction: 'stable write offsets', progress: 'barrier participation',
  pipelines: 'buffer dependencies and overlap', 'token-routing': 'stable destination ranks',
};

const teaching = {
  scale: {
    before: 'The starter supplies five input values. Each thread reads one input and writes the multiplied value to the same index in the output array.',
    terms: [['FP32', 'A floating-point value stored in four bytes.']],
    inspect: 'In runKernel, the index i selects both the input and the output. The f on 2.0f makes the multiplier an FP32 value.',
    task: 'The model starts with Multiplier 2.0. Click Run model and find Thread index 2 in Modelled values. Set Multiplier to 3.0, predict the Output at that index and click Run model again. Which inputs or indices change?',
    transfer: 'If you change the multiplier to 0.5, do the threads pick different inputs?',
    answer: 'No. The thread indices stay the same. The result at index 2 changes to 1.5 because its input is still 3.0.',
  },
  bounds: {
    before: 'The starter uses the same five input values and runKernel as lesson 2. Change the number of threads per block while keeping the input array unchanged.',
    terms: [['Block', 'A group of threads launched together.'],
      ['Bounds check', 'A condition that prevents a thread from accessing an array beyond its valid indices.']],
    inspect: 'blockIdx.x is the block number. blockDim.x is its size. threadIdx.x is the thread’s index within that block. Multiplying the block number by the block size and adding the local index gives i.',
    task: 'The model starts with five inputs and Threads per block set to 4. It calculates the block count. Click Run model, then change Threads per block to 3. Predict which Index i rows will show Skipped under Array access and click Run model again.',
    transfer: 'The input still has five values. Why does one block of eight threads skip the same indices as two blocks of four?',
    answer: 'Both launches produce indices 0 through 7. The grouping changes, and the condition i < n still allows indices 0 through 4.',
  },
  copies: {
    before: 'The input array x starts in CPU memory. The CPU reserves separate GPU input and output arrays, copies x to the GPU input and launches runKernel. After the kernel writes the GPU output, the CPU copies those results into array y.',
    terms: [['Host', 'The CPU side of a CUDA program.'], ['Device', 'The GPU side of a CUDA program.'],
      ['Allocation', 'A request for enough storage to hold the data.']],
    inspect: 'n is the number of elements in x. sizeof(x) gives its size in bytes. cudaMalloc reserves storage, and cudaMemcpy moves the values between the host and device.',
    task: 'With Number of inputs set to 5, click Run model. Use Next step to inspect Allocate GPU arrays, Copy input to the GPU, Run the kernel and Copy results to the CPU. Set Number of inputs to 9 and predict bytes per GPU array and the block count. Click Run model again and step through the same phases. How do the allocation sizes, copy sizes and block count change?',
    transfer: 'With nine inputs, when can the CPU first read the results from y?',
    answer: 'After the device-to-host copy. The kernel has written nine results to the GPU output array before that copy fills the CPU array y.',
  },
};

export function renderV2Contents(href) {
  return `<header class="intro">
    <h1>Learn the GPU through CUDA C++</h1>
    <p class="lead">Run a small CUDA C++ program, predict what one edit will change and compare the results. Later lessons trace memory, synchronisation and the parallel patterns behind AI workloads.</p>
    <p>Before you start, be comfortable with basic programming, reading Python and array indexing. The course introduces CUDA and GPU architecture.</p>
    <p>No installation or GPU required. The browser compiles CUDA C++ and runs the examples in a functional GPU simulator. The teaching models calculate specific details such as memory addresses and possible instruction schedules.</p>
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

function cudaStarter(evidence) {
  return `<p>The CUDA source editor opens with the complete starter or your saved draft. To run the starter again, use <strong>Editor tools</strong> → <strong>Restore starter</strong>. Choose <strong>Undo restore</strong> there to recover the previous draft.</p>
    <p>Click <strong>Compile and run</strong> with the starter. ${escape(evidence)}</p>`;
}

function renderFirstKernel(workbenchHref, program, href) {
  const kernel = program.match(/^__global__[^]*?^}/m)?.[0];
  const launch = program.match(/^\s*(hello<<<[^\n]+;)$/m)?.[1];
  const initial = program.match(/float value =[^;]+;/)?.[0];
  const copy = program.match(/cudaMemcpy\(&value, output, sizeof\(value\), cudaMemcpyDeviceToHost\)/)?.[0];
  const print = program.match(/std::printf\([^\n]+;/)?.[0];
  const readback = initial && copy && print && `${initial}\n${copy.replace(', sizeof(value), ', ', sizeof(value),\n           ')};\n${print}`;
  if (!kernel || !launch || !readback) throw new Error('Lesson 1 needs its kernel, launch and result copy in the starter.');

  return `<section class="book-section" aria-labelledby="v2-first-kernel">
    <h2 id="v2-first-kernel">Which value does the CPU print?</h2>
    <p>The program writes a value in GPU memory, copies the result to CPU memory and prints it. The function below, <code>hello</code>, performs the GPU write. In CUDA C++, <code>__global__</code> marks <code>hello</code> as a kernel—a GPU function the CPU can launch. The CPU launches one GPU thread to run <code>hello</code>. That thread writes <code>42.0f</code> to <code>output[0]</code>.</p>
    ${codePanel({id: 'v2-first-source', editorExcerpt: true, label: 'Read-only CUDA C++ · Kernel definition', source: kernel, explainedLocally: true})}
    <p>In <code>float* output</code>, <code>output</code> holds the address of the reserved GPU storage. <code>output[0]</code> is the <code>float</code> at that address. The <code>f</code> in <code>42.0f</code> marks a <code>float</code> constant.</p>
    <h3>Launch the kernel from main()</h3>
    <p>The CPU code in <code>main()</code> reserves space for one <code>float</code> in GPU memory. It launches <code>hello</code> and passes the address of that space as <code>output</code>.</p>
    ${codePanel({id: 'v2-first-launch', editorExcerpt: true, label: 'Read-only CUDA C++ · Launch inside main()', source: launch, explainedLocally: true})}
    <p>The first <code>1</code> asks for one block, a group of GPU threads. The second <code>1</code> asks for one thread in that block.</p>
    <h3>Copy the result back before printing</h3>
    <p>The kernel writes <code>output[0]</code> in GPU memory. The CPU has a separate variable, <code>value</code>, initially set to <code>0.0f</code>. Writing the GPU result does not change that CPU variable. The supplied <code>cudaMemcpy</code> call copies the result into <code>value</code>.</p>
    ${codePanel({id: 'v2-first-readback', editorExcerpt: true, label: 'Read-only CUDA C++ · Copy and print inside main() (error checks omitted)', source: readback, explainedLocally: true})}
    <div class="code-explanations"><ul>
      <li><code>&amp;value</code> supplies the address of the CPU destination. <code>output</code> supplies the address of the GPU source.</li>
      <li><code>sizeof(value)</code> gives the number of bytes for this one <code>float</code>. <code>cudaMemcpyDeviceToHost</code> selects a copy from GPU memory to CPU memory.</li>
    </ul></div>
    <p>For this copy, <code>main()</code> waits until the result is available in <code>value</code>, then <code>std::printf</code> prints it in Console. The complete program tests the status returned by allocation, launch and copy calls and reports any CUDA error. Leave those checks unchanged for this experiment. <a href="${href('from-cpu-array-to-gpu-result')}">Lesson 4: From CPU array to GPU result</a> explains allocation and copies for arrays.</p>
    ${workbenchHref ? cudaStarter('Find 42.0 in Console.') + readerTask('In hello in the CUDA source editor, change output[0] = 42.0f to output[0] = 7.0f. Predict the value in Console and click Compile and run again. Can the launch still use one thread?', 'Change the value') : ''}
    ${workbenchHref ? workbenchEditor('hello', workbenchHref, 'Editable CUDA program with one kernel and its launch') : `<details class="more-settings">
      <summary>Show complete program</summary>
      ${codePanel({id: 'v2-first-program', label: 'CUDA C++ · complete program', source: program, explainedLocally: true})}
    </details>`}
  </section>
  <section class="book-section" aria-labelledby="v2-first-path">
    <h2 id="v2-first-path">Where does the kernel run?</h2>
    <p>A <strong>streaming multiprocessor (SM)</strong> is a part of the GPU chip that runs GPU threads. Here, the SM runs the thread that writes <code>42.0f</code> in <code>hello</code>.</p>
    ${v2Diagram('first-kernel')}
  </section>
  ${renderV2Hardware('first-kernel')}
  <p>In the next lesson, threads run one kernel to process five values. How will each thread choose its own array element?</p>`;
}

function renderStarter(slug, workbenchHref) {
  const context = lessonContexts[slug];
  return `<h3>Read the starter excerpts</h3>
    ${codePanel({id: 'v2-starter-source', editorExcerpt: true, label: context.label, source: context.code, explainedLocally: true})}
    <p>${escape(context.readingExplanation ?? context.explanation)}</p>
    ${(context.preparation ?? []).map(text => `<p>${escape(text)}</p>`).join('')}
    ${codePanel({id: 'v2-starter-launch', editorExcerpt: true, label: 'CUDA C++ · launch inside main()', source: context.launches, explainedLocally: true})}
    <p>The settings inside <code>&lt;&lt;&lt; &gt;&gt;&gt;</code> give the block count and threads per block. Parentheses pass the arguments to the kernel. These read-only excerpts show the starter. The ${workbenchHref ? 'CUDA source editor' : 'complete program'} contains the storage and launch settings.</p>
    ${!workbenchHref ? `<details class="more-settings"><summary>Read the complete CUDA starter</summary>${codePanel({id:'v2-fixed-program',label:'CUDA C++ · complete starter program',source:starterFor(slug),explainedLocally:true})}</details>` : ''}`;
}

function renderContext(slug) {
  return `<section class="book-section" aria-labelledby="v2-execution-title">
    <h2 id="v2-execution-title">Read the starter’s execution diagram</h2>
    ${v2Diagram(slug)}
  </section>
  ${renderV2Hardware(slug)}`;
}

function renderWorkbench(mode, href) {
  const tasks = {
    scale: 'In runKernel in the CUDA source editor, change input[i] * 2.0f to input[i] * 3.0f. Predict the third value (index 2) in Console’s Output array and click Compile and run again. Which output values change? Do they keep their positions?',
    bounds: 'In main() in the CUDA source editor, change threadsPerBlock from 4 to 3. Predict the total launched threads and click Compile and run again. Open Trace CUDA calls and compare the blocks × threads line with the starter. Does Console’s Output array change?',
    copies: 'In main() in the CUDA source editor, append 6.0f, 7.0f, 8.0f and 9.0f to array x. Predict the bytes per copy and the block count and click Compile and run again. In Trace CUDA calls, compare the cudaMemcpy byte counts and blocks × threads line with the starter. How many values does Console’s Output contain?',
  };
  const evidence = {
    scale: 'Find Output: [2, 4, 6, 8, 10] in Console. These are the five input values multiplied by two.',
    bounds: 'In Console, find the five values in Output. Open Trace CUDA calls and find 2 blocks × 4 threads. The launch requests eight threads for five inputs.',
    copies: 'In Console, find the five values in Output. Open Trace CUDA calls and find the two cudaMemcpy lines, each with 20 bytes, and the line for 2 blocks × 4 threads.',
  };
  return `${cudaStarter(evidence[mode])}
    ${readerTask(tasks[mode], 'Change the source')}
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
    <h2 id="v2-activity">${workbenchHref ? 'Edit and run CUDA' : 'Run the model'}</h2>
    ${workbenchHref ? renderWorkbench(mode, workbenchHref) + renderContext(slug) + `<details class="more-settings v2-starter-model"><summary>Explore the model: ${modelTopics[mode]}</summary>` : ''}
    ${!workbenchHref ? renderContext(slug) : ''}
    ${workbenchHref ? '<h3>Trace the model inputs and outputs</h3>' : ''}
    ${readerTask(lesson.task, 'Try it')}
    <p class="chapter-browser-note">${workbenchHref ? 'These controls change only this model and its displayed source excerpt. They do not edit or run the CUDA program above.' : 'This preview runs the teaching model.'}</p>
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
      <summary>Read the complete model program</summary>
      ${codePanel({ id: 'v2-full', label: 'CUDA C++ · complete program', source: initial.source, explainedLocally: true })}
      <button id="v2-download" type="button" disabled>Download model program</button>
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
    ${cudaStarter(programEvidence[slug])}
    ${programNotes[slug] ? `<p>${programNotes[slug]}</p>` : ''}
    ${readerTask(programTasks[slug], 'Change the source')}
    ${workbenchEditor(slug, workbenchHref, 'Editable CUDA program and output')}
  </section>
  ${renderContext(slug)}
  <details class="more-settings v2-starter-model"${slug === 'scheduling' ? ' open' : ''}><summary>${slug === 'scheduling' ? 'Compare ready and waiting warps' : 'Explore the model: ' + modelTopics[slug]}</summary>` : renderContext(slug)}
  <section class="book-section v2-experiment" data-v2-guided="${slug}" aria-labelledby="v2-activity">
    <h2 id="v2-activity">Predict and run</h2>
    ${lessonContexts[slug].introduction ? `<p>${escape(lesson.before)}</p>` : ''}
    ${readerTask(lesson.task, 'Try it')}
    <p class="chapter-browser-note">These controls change only this model and its displayed excerpt; they do not edit the CUDA program above. Enter a prediction to compare with the model result.</p>
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
        <p id="v2-feedback" role="status">Optionally enter a prediction, then click Run model.</p>
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
    <h1>${lesson.title}</h1><p class="lead">${lesson.goal}</p>
  </header>
  ${lesson.practical ? renderPractical(lesson, workbenchHref, legacy) : lesson.mode === 'hello' ? renderFirstKernel(workbenchHref, firstProgram, href) :
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

export const v2Styles = ['style.css', 'lessons.css', 'chapter.css', 'continuation.css', 'parallel.css', 'sm-video.css', 'v2.css', 'code-runner.css'];
export function renderV2Page(lesson, versionMarkup = '', { home = false, firstProgram = '', appendix } = {}) {
  const base = home ? './' : '../';
  const href = (slug, part) => slug === 'contents' ? base + (part ? '#' + part : '') : `${home ? './v2/' : './'}${slug}.html`;
  const legacy = slug => `${base}lessons/${slug}.html`;
  const title = (lesson?.title||appendix?.title) ? (lesson?.title||appendix.title) + ' · CUDA C++ Lab' : 'CUDA C++ Lab';
  const styles = v2Styles.map(name => `<link rel="stylesheet" href="${base}src/${name}">`).join('');
  return `<!doctype html>
<!-- Copyright © 2026 Christopher Snow. -->
<html lang="en-GB" data-course-session><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${title}</title>${styles}
<meta name="description" content="Learn GPU architecture through hands-on CUDA C++ lessons. Edit, compile and run examples in your browser using GPU simulation.">
<link rel="icon" type="image/svg+xml" href="${base}assets/icon.svg">
<script type="module" src="${base}src/theme.mjs"></script>
<script type="module" src="${base}src/code-runner-host.mjs"></script>
${lesson ? `<script type="module" src="${base}src/v2.mjs"></script><script type="module" src="${base}src/recording.mjs"></script>` : ''}
</head>
<body class="book-chapter v2-book">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar v2-topbar">${renderV2Brand(base, base + 'assets/icon.svg')}
<div class="top-actions">
<button id="theme" type="button" aria-label="Switch colour theme">Theme</button></div></header>
<main id="main" class="v2-main">${appendix ? `<header class="intro"><nav aria-label="Breadcrumb"><a href="../index.html">Course overview</a> / <span aria-current="page">${escape(appendix.title)}</span></nav><h1>${escape(appendix.title)}</h1><p class="lead">${escape(appendix.lead)}</p></header>${appendix.body}<nav class="v2-pager" aria-label="Appendix navigation"><a href="../index.html">Course overview</a><a href="${appendix.otherHref}">${escape(appendix.otherTitle)}</a></nav>` : lesson ? renderV2Lesson(lesson, href, legacy, './cuda-source-workbench.html', firstProgram) : renderV2Contents(href)}<footer><span>Copyright © 2026 Christopher Snow.</span>${lesson ? '<a href="./cuda-source-workbench.html#software-licences">Software licences</a>' : ''}${versionMarkup}</footer></main>
</body></html>`;
}
