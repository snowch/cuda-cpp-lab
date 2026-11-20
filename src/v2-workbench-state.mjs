// Copyright © 2026 Christopher Snow.
import {registerExperiment} from './experiment-state.mjs';

const editor = document.getElementById('source');
const status = document.getElementById('status');
const diagnostics = document.getElementById('diagnostics');
const messages = document.getElementById('compiler-messages');
const ptx = document.getElementById('ptx');
const ptxPanel = document.getElementById('ptx-panel');
const consoleOutput = document.getElementById('program-output');
const operations = document.getElementById('program-operations');
const provenance = document.getElementById('result-provenance');
const outputCells = () => [...document.querySelectorAll('#values tr')].map(row => row.lastElementChild);

addEventListener('gpu-lab:before-restart', ({detail}) => {
  if (editor.readOnly) detail.reason = 'Wait for the CUDA compile/run to finish in this window, then restart to update.';
  // The editor owns its durable/tab fallback and Undo restore copies. An
  // automatic reading snapshot must not override that recovery policy when
  // storage cannot retain a draft or its recovery copy safely.
  else if(detail.kind==='navigation'&&!document.getElementById('draft-warning').hidden)
    detail.reason='Automatic reading state defers to the editor’s saved recovery copies while storage is constrained.';
});

registerExperiment('v2-cuda-workbench', () => ({
  version: 1, source: editor.value,
  output: outputCells().map(cell => cell.textContent),
  console: consoleOutput.textContent, consoleHidden: consoleOutput.hidden,
  previous: !provenance.hidden,
  operations: operations.querySelector('pre').textContent, operationsHidden: operations.hidden,
  status: status.textContent, error: status.dataset.error === 'true',
  outcome: status.dataset.outcome ?? '', messagesOpen: messages.open,
  diagnostics: diagnostics.textContent, diagnosticsHidden: diagnostics.hidden,
  ptx: ptx.textContent, ptxHidden: ptxPanel.hidden,
}), saved => {
  const cells = outputCells();
  if (saved.version !== 1 || typeof saved.source !== 'string' || !Array.isArray(saved.output) ||
      saved.output.length !== cells.length || saved.output.some(value => typeof value !== 'string') ||
      ['status', 'diagnostics', 'ptx', 'console', 'operations'].some(key => typeof saved[key] !== 'string') ||
      ['error', 'diagnosticsHidden', 'ptxHidden', 'consoleHidden', 'operationsHidden'].some(key => typeof saved[key] !== 'boolean')) {
    throw new Error('The saved CUDA workbench state changed.');
  }
  editor.value = saved.source;
  editor.dispatchEvent(new Event('gpu-lab:source-restored'));
  cells.forEach((cell, index) => { cell.textContent = saved.output[index]; });
  consoleOutput.textContent = saved.console;
  consoleOutput.hidden = saved.consoleHidden;
  operations.querySelector('pre').textContent = saved.operations;
  operations.hidden = saved.operationsHidden;
  status.textContent = saved.status;
  status.dataset.error = String(Boolean(saved.error));
  status.dataset.outcome = saved.outcome === 'program-exit' ? 'program-exit' : '';
  editor.dispatchEvent(new CustomEvent('gpu-lab:result-restored', { detail: {
    hasResult: Boolean(saved.console) || saved.output.some(value => value !== '—'),
    previous: saved.previous === true,
  }}));
  diagnostics.textContent = saved.diagnostics;
  diagnostics.hidden = saved.diagnosticsHidden;
  messages.hidden = saved.diagnosticsHidden;
  messages.open = saved.error || saved.messagesOpen === true;
  messages.dataset.error = String(Boolean(saved.error));
  ptx.textContent = saved.ptx;
  ptxPanel.hidden = saved.ptxHidden;
});
