// Copyright © 2026 Christopher Snow.
// The two standalone builds share the DOM contract of cuda-sim-wasm's workbench.
export function workbenchFrame(html) {
  const key = "const storageKey = 'gpu-lab-v2:editable-cuda-kernel';";
  if (!html.includes(key)) throw new Error('The CUDA workbench storage contract changed.');
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
@media(max-width:480px) { html[data-inline] .kernel-shortcut { display:none; } }
</style>
<script>
const inlineMode = new URLSearchParams(location.search).get('embed') ||
  document.documentElement.dataset.inline;
if (inlineMode === 'scale' || inlineMode === 'bounds') document.documentElement.dataset.inline = inlineMode;
</script></head>`)
    .replace(key, key.replace("';", "' + (document.documentElement.dataset.inline || '');"))
    .replace('</body>', `<script>
if (document.documentElement.dataset.inline) {
  const toolbar = document.createElement('div');
  toolbar.className = 'kernel-tools';
  const exportSource = document.createElement('button');
  exportSource.type = 'button';
  exportSource.textContent = 'Export .cu';
  exportSource.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([editor.value], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'runKernel.cu';
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  toolbar.append(reset, exportSource);
  const label = document.querySelector('.editor-label');
  label.querySelector('label').textContent = 'runKernel.cu';
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
  new ResizeObserver(() => {
    parent.postMessage({gpuLabWorkbenchHeight: document.querySelector('main').offsetHeight + 4}, '*');
  }).observe(document.querySelector('main'));
}
</script></body>`);
}
