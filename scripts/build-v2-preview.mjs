// Copyright © 2026 Christopher Snow.
// Export the V2 teaching models as a browser-readable file.
import { readFile, writeFile } from 'node:fs/promises';
import { v2Course } from '../content/v2-course.mjs';
import { renderV2Contents, renderV2Lesson, v2Styles } from '../content/v2-view.mjs';
import { workbenchFrame } from '../content/v2-workbench-frame.mjs';
import { insertProgramStarters } from '../content/v2-programs.mjs';
import { renderV2Brand } from '../content/v2-brand.mjs';

const output = process.argv[2];
if (!output) throw new Error('Pass the preview output path.');
const firstProgram = await readFile(new URL('../examples/first-kernel.cu', import.meta.url), 'utf8');
const workbench = process.argv[3] ? workbenchFrame(await insertProgramStarters(await readFile(process.argv[3], 'utf8'))) : '';
const source = name => readFile(new URL('../src/' + name, import.meta.url), 'utf8');
const encode = (type, value) => 'data:' + type + ';base64,' + Buffer.from(value).toString('base64');
const icon = encode('image/svg+xml', await readFile(new URL('../assets/icon.svg', import.meta.url)));
const href = (slug, part) => '#' + (part ?? slug);
const current = 'https://snowch.github.io/cuda-cpp-lab/';
const legacy = slug => current + 'lessons/' + slug + '.html';
const imports = {};
const localImport = /^(import .*?['"])\.\/([\w-]+\.mjs)(['"];?)$/gm;
async function embedModule(name) {
  const specifier = 'cuda-cpp-lab/' + name;
  if (imports[specifier]) return;
  const script = await source(name);
  imports[specifier] = encode('text/javascript', script.replace(localImport, '$1cuda-cpp-lab/$2$3'));
  for (const [, , dependency] of script.matchAll(localImport)) await embedModule(dependency);
}
for (const entry of ['theme.mjs', 'v2.mjs']) await embedModule(entry);
let styling = (await Promise.all(v2Styles.map(source))).join('\n');
const fontNames = [...new Set([...styling.matchAll(/\/fonts\/([\w-]+\.woff2)/g)].map(match => match[1]))];
for (const name of fontNames) {
  const font = await readFile(new URL('../assets/fonts/' + name, import.meta.url));
  styling = styling.replaceAll('../assets/fonts/' + name, encode('font/woff2', font));
}
const escapeText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const licenseNames = ['ibmplexmono-OFL.txt', 'ibmplexsans-OFL.txt'];
const licenses = await Promise.all(licenseNames.map(name =>
  readFile(new URL('../assets/fonts/' + name, import.meta.url), 'utf8')));
const templates = [
  ['contents', renderV2Contents(href)],
  ...v2Course.map(lesson => [lesson.slug, renderV2Lesson(lesson, href, legacy, workbench ? 'bundled' : undefined, firstProgram)]),
].map(([slug, markup]) => `<template id="page-${slug}">${markup.replaceAll('href="../examples/', 'href="' + current + 'examples/').replaceAll('href="../lessons/profiling.html"', 'href="'+legacy('profiling')+'"').replaceAll('href="./measure-a-kernel.html"', 'href="#measure-a-kernel"')}</template>`).join('\n');

await writeFile(output, `<!doctype html>
<!-- Copyright © 2026 Christopher Snow. -->
<html lang="en-GB">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>CUDA C++ Lab</title>
<link rel="icon" type="image/svg+xml" href="${icon}">
<style>${styling}</style>
<script type="importmap">${JSON.stringify({ imports })}</script>
</head>
<body class="book-chapter v2-book">
<a class="skip" href="#main">Skip to content</a>
<header class="topbar v2-topbar">${renderV2Brand('#contents', icon)}
<div class="top-actions">
<button id="theme" type="button" aria-label="Switch colour theme">Theme</button></div></header>
<main id="main" class="v2-main" tabindex="-1">${renderV2Contents(href)}</main>
${templates}
${workbench ? `<script id="offline-workbench" type="application/json">${JSON.stringify(workbench).replaceAll('<', '\\u003c')}</script>` : ''}
<!-- Embedded font licences
${licenses.map(escapeText).join('\n\n').replaceAll('--', '—')}
-->
<script type="module">
import 'cuda-cpp-lab/theme.mjs';
import { mountV2 } from 'cuda-cpp-lab/v2.mjs';
const main = document.querySelector('#main');
function route() {
  const slug = location.hash.slice(1);
  if (slug === 'main') return;
  const template = document.getElementById('page-' + slug) ?? document.getElementById('page-contents');
  main.replaceChildren(template.content.cloneNode(true));
  mountV2(main);
  const frames = main.querySelectorAll('[data-kernel-workbench]');
  if (frames.length) {
    const workbench = JSON.parse(document.getElementById('offline-workbench').textContent);
    frames.forEach((frame, index) => {
      const attributes = index === 0 ? 'data-show-licences ' : '';
      frame.srcdoc = workbench.replace('<html ', '<html ' + attributes + 'data-inline="' + frame.dataset.kernelWorkbench + '" ');
    });
  }
  const title = main.querySelector('h1').textContent;
  document.title = title + ' · CUDA C++ Lab';
  const part = document.getElementById(slug);
  if (part?.matches('.v2-list h2')) {
    part.focus({ preventScroll: true });
    part.scrollIntoView({ behavior: 'instant' });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (slug) main.focus({ preventScroll: true });
}
addEventListener('hashchange', route);
route();
</script>
</body>
</html>`);
