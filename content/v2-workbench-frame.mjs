// Copyright © 2026 Christopher Snow.
import { mountFirstKernelFocus } from '../src/v2-editor-focus.mjs';
// The two standalone builds share the DOM contract of cuda-sim-wasm's workbench.
export function workbenchFrame(html, {compilerBase, compilerParts} = {}) {
  if (!html.includes('lab.arrayProgram')) throw new Error('This workbench must support complete CUDA programs.');
  if (compilerBase) {
    const marker = "\nconst editor = document.querySelector('#source');";
    if (!html.includes(marker)) throw new Error('The CUDA workbench initialisation changed.');
    html = html.replace(marker, `
for (const [index, asset] of lab.assets.compiler.entries()) {
  asset.parts = ${JSON.stringify(compilerParts)}[index].map(name => new URL(${JSON.stringify(compilerBase)} + name, location.href).href);
  delete asset.url;
}${marker}`).replace('The first run downloads about 127 MiB of compiler assets.',
      'Compiler assets are included in App status downloads and updates.')
      .replace('</body>', '<script type="module" src="../src/v2-workbench-state.mjs"></script></body>');
  }
  return html.replace('</head>', `<style>
html[data-inline] body { min-height:0; background:transparent; }
html[data-inline] main { width:100%; padding:2px; }
html[data-inline] main>header,html[data-inline] .task { display:none; }
html[data-inline] .grid {
  grid-template-columns:1fr;
  gap:0;
  border:1px solid #49615c;
  border-radius:10px;
  overflow:hidden;
  background:#142622;
  color:#edf8f1;
}
html[data-inline] .card { border:0; border-radius:0; background:transparent; padding:14px; }
html[data-inline] .card+.card { border-top:1px solid #49615c; background:#192f2a; }
html[data-inline] .editor-label span,html[data-inline] .sub,html[data-inline] .card .note { color:#b8cdc4; }
html[data-inline] textarea { min-height:240px; background:#0f211d; border-color:#49615c; }
html[data-inline][data-program] textarea { min-height:280px; height:340px; }
html[data-inline] .workbench-version,html[data-inline]:not([data-show-licences]) #software-licences { display:none; }
html[data-inline] button { background:#223d35; border-color:#557268; color:#edf8f1; }
html[data-inline] button.primary { background:#a7e3c8; color:#172f29; border-color:#a7e3c8; }
html[data-inline] :focus-visible { outline-color:#a7e3c8; }
html[data-inline] #status,html[data-inline] tbody td:last-child { color:#a7e3c8; }
html[data-inline] #status[data-error="true"],html[data-inline] #diagnostics { color:#ffaea2; }
html[data-inline] .card table th,html[data-inline] .card table td { border-color:#49615c; }
html[data-inline] .card pre { background:#0f211d; border-color:#49615c; }
html[data-inline] .kernel-tools { display:flex; flex-wrap:wrap; gap:6px; }
html[data-inline] .kernel-tools button { min-height:34px; font-size:.8rem; }
html[data-inline] .editor-label { align-items:center; flex-wrap:wrap; }
html[data-inline] .editor-label label { font-family:var(--mono); }
html[data-inline] .controls { align-items:center; justify-content:flex-end; }
html[data-inline] .kernel-shortcut { font-size:.82rem; color:#b8cdc4; }
html[data-inline] .source-focus { margin:0 0 12px; font-size:1rem; line-height:1.5; }
html[data-inline] .source-focus p { max-width:68ch; }
html[data-inline] .source-focus strong { color:#a7e3c8; }
html[data-inline] .source-focus code { font-family:var(--mono); }
html[data-inline="hello"] textarea { font-size:16px; }
html[data-inline] .source-focus button { margin-top:8px; min-height:44px; }
html[data-inline] #source-focus-missing { margin-top:8px; color:#ffaea2; }
html[data-inline] textarea.has-source-focus {
  background-image:linear-gradient(to bottom,
    transparent var(--source-focus-top),
    #a7e3c82b var(--source-focus-top) var(--source-focus-bottom),
    transparent var(--source-focus-bottom)),
    linear-gradient(to bottom,
      transparent var(--kernel-focus-top),
      #8fcbff26 var(--kernel-focus-top) var(--kernel-focus-bottom),
      transparent var(--kernel-focus-bottom)),
    linear-gradient(to bottom,
      transparent var(--launch-focus-top),
      #8fcbff26 var(--launch-focus-top) var(--launch-focus-bottom),
      transparent var(--launch-focus-bottom));
  background-size:100% var(--source-focus-height);
  background-attachment:local;
  background-repeat:no-repeat;
}
@media(max-width:480px) { html[data-inline] .kernel-shortcut { display:none; } }
</style>
<script>
const inlineMode = new URLSearchParams(location.search).get('embed') ||
  document.documentElement.dataset.inline;
if (inlineMode && /^[a-z0-9-]+$/.test(inlineMode)) {
  document.documentElement.dataset.inline = inlineMode;
  document.documentElement.dataset.program = 'true';
}
</script></head>`)
    .replace('</body>', `<script>
if (document.documentElement.dataset.inline) {
  ${mountFirstKernelFocus.toString()}
  if (inlineMode === 'hello') mountFirstKernelFocus(editor, reset);
  const filename = profile === 'hello' ? 'hello.cu' : advanced || inlineMode === 'coalescing' ? inlineMode + '.cu' : 'runKernel.cu';
  const toolbar = document.createElement('div');
  toolbar.className = 'kernel-tools';
  const exportSource = document.createElement('button');
  exportSource.type = 'button';
  exportSource.textContent = 'Export .cu';
  exportSource.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([editor.value], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  toolbar.append(reset, exportSource);
  const label = document.querySelector('.editor-label');
  label.querySelector('label').textContent = filename;
  editor.setAttribute('aria-label', 'CUDA source');
  label.querySelector('span').replaceWith(toolbar);
  document.querySelector('#output-title').textContent = 'Console · simulated output';
  const shortcut = document.createElement('span');
  shortcut.className = 'kernel-shortcut';
  shortcut.textContent = 'Ctrl / ⌘ + Enter';
  document.querySelector('.controls').prepend(shortcut);
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!run.disabled) run.click();
    }
  });
  const reportHeight = () => {
    parent.postMessage({gpuLabWorkbenchHeight: document.querySelector('main').offsetHeight + 4}, '*');
  };
  new ResizeObserver(reportHeight).observe(document.querySelector('main'));
  // The parent's module can mount after the initial resize notification.
  addEventListener('message', event => {
    if (event.source === parent && event.data?.gpuLabWorkbenchMeasure) reportHeight();
  });
}
</script></body>`);
}
