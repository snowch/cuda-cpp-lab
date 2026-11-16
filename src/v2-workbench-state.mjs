// Copyright © 2026 Christopher Snow.
import {registerExperiment} from './experiment-state.mjs';

const editor = document.getElementById('source');
const status = document.getElementById('status');
const diagnostics = document.getElementById('diagnostics');
const ptx = document.getElementById('ptx');
const ptxPanel = document.getElementById('ptx-panel');
const consoleOutput = document.getElementById('program-output');
const operations = document.getElementById('program-operations');
const outputCells = () => [...document.querySelectorAll('#values tr')].map(row => row.lastElementChild);

addEventListener('gpu-lab:before-restart', ({detail}) => {
  if (editor.readOnly) detail.reason = 'Wait for the CUDA compile/run to finish in this window, then restart to update.';
});

registerExperiment('v2-cuda-workbench', () => ({
  version: 1, source: editor.value,
  output: outputCells().map(cell => cell.textContent),
  console: consoleOutput.textContent, consoleHidden: consoleOutput.hidden,
  operations: operations.querySelector('pre').textContent, operationsHidden: operations.hidden,
  status: status.textContent, error: status.dataset.error === 'true',
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
  diagnostics.textContent = saved.diagnostics;
  diagnostics.hidden = saved.diagnosticsHidden;
  ptx.textContent = saved.ptx;
  ptxPanel.hidden = saved.ptxHidden;
});
