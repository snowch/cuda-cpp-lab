// Copyright © 2026 Christopher Snow.
import { mountGuided } from './v2-guided.mjs';
import { downloadCuda } from './cuda-program.mjs';
import { fp32, v2Experiments, v2Run } from './v2-model.mjs';

const vector = values => '[' + values.map(fp32).join(', ') + ']';
const table = (caption, headers, rows) => `<table class="v2-result-table">
  <caption>${caption}</caption><thead><tr>${headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody></table>`;

function scaleResult(model) {
  return table('Modelled values', ['Thread index', 'Input', 'Output'],
    model.threads.map(thread => `<tr><th scope="row">${thread.index}</th>
      <td>${fp32(model.input[thread.index])}</td><td>${fp32(thread.output)}</td></tr>`));
}

function boundsResult(model) {
  return table('Modelled thread activity', ['Index i', 'Block', 'Index in block', 'Array access'],
    model.threads.map(thread => `<tr${thread.output === null ? ' data-skipped' : ''}>
      <th scope="row">${thread.index}</th><td>${thread.block}</td><td>${thread.local}</td>
      <td>${thread.output === null ? 'Skipped' : 'Wrote ' + fp32(thread.output)}</td></tr>`));
}

function copiesResult(model, step) {
  const phase = model.phases[step];
  const values = vector(model.output);
  return `<div class="v2-step-actions">
    <button type="button" data-v2-step="-1"${step === 0 ? ' disabled' : ''}>Previous step</button>
    <strong>Step ${step + 1} of ${model.phases.length}</strong>
    <button type="button" data-v2-step="1"${step === model.phases.length - 1 ? ' disabled' : ''}>Next step</button>
  </div>
  <h3>${phase.label}</h3>
  <div class="v2-memory">
    <div><strong>CPU input</strong><p><code>${vector(model.input)}</code></p></div>
    <div><strong>GPU input</strong><p>${step < 1 ? `${model.bytes} bytes reserved` : `<code>${vector(model.input)}</code>`}</p></div>
    <div><strong>GPU output</strong><p>${step < 2 ? `${model.bytes} bytes reserved` : `<code>${values}</code>`}</p></div>
    <div><strong>CPU output</strong><p>${step < 3 ? 'Awaiting copy from GPU' : `<code>${values}</code>`}</p></div>
  </div>`;
}

export function mountV2(root = document) {
  mountGuided(root);
  const activity = root.querySelector('[data-v2-mode]');
  if (!activity) return;
  const mode = activity.dataset.v2Mode;
  const experiment = v2Experiments[mode];
  const key = 'gpu-lab-v2:' + mode;
  const choice = activity.querySelector('#v2-choice');
  const run = activity.querySelector('#v2-run');
  const download = activity.querySelector('#v2-download');
  const feedback = activity.querySelector('#v2-feedback');
  const result = activity.querySelector('#v2-result');
  const source = activity.querySelector('#v2-source code');
  const caption = activity.querySelector('#v2-source-label');
  const full = activity.querySelector('#v2-full code');
  const input = activity.querySelector('[data-v2-input]');
  let state = { choice: experiment.initial, step: 0, ran: false };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && experiment.choices.includes(saved.choice)) {
      state = {
        choice: saved.choice,
        ran: saved.ran === true,
        step: Number.isInteger(saved.step) && saved.step >= 0 && saved.step < 4 ? saved.step : 0,
      };
    }
  } catch { /* Storage is optional. */ }

  function render() {
    const model = v2Run(mode, state.choice);
    const step = state.step;
    choice.value = String(state.choice);
    input.textContent = vector(model.input);
    source.textContent = mode === 'copies' && state.ran ? model.phases[step].code : model.excerpt;
    full.textContent = model.source;
    result.hidden = !state.ran;
    if (mode === 'copies') caption.textContent = 'CUDA C++ · ' +
      (state.ran ? model.phases[step].label : 'input and allocation');

    if (!state.ran) {
      result.replaceChildren();
      feedback.textContent = 'Run to see the result.';
    } else if (mode === 'scale') {
      result.innerHTML = scaleResult(model);
      feedback.textContent = `The model produced ${model.count} output values.`;
    } else if (mode === 'bounds') {
      result.innerHTML = boundsResult(model);
      feedback.textContent = `${model.blocks} blocks × ${model.size} threads = ${model.threads.length} threads. ${model.count} write, ${model.skipped.length} skip.`;
    } else {
      result.innerHTML = copiesResult(model, step);
      const feedbackByStep = [
        `Each GPU array needs ${model.bytes} bytes for ${model.count} FP32 values.`,
        `${model.bytes} input bytes copied from the CPU to the GPU.`,
        `${model.blocks} blocks × ${model.size} threads. ${model.count} write to the GPU output array.`,
        `${model.bytes} result bytes copied back to the CPU.`,
      ];
      feedback.textContent = feedbackByStep[step];
    }
  }

  function update() {
    render();
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Storage is optional. */ }
  }

  choice.addEventListener('change', () => {
    state = { choice: Number(choice.value), ran: false, step: 0 };
    update();
  });
  run.addEventListener('click', () => {
    state.ran = true;
    state.step = 0;
    update();
  });
  result.addEventListener('click', event => {
    const button = event.target.closest('[data-v2-step]');
    if (!button || button.disabled) return;
    const direction = Number(button.dataset.v2Step);
    state.step += direction;
    update();
    const next = [...result.querySelectorAll('[data-v2-step]')].filter(button => !button.disabled);
    const target = next.find(button => Number(button.dataset.v2Step) === direction) ?? next[0];
    target?.focus();
  });
  download.addEventListener('click', () => downloadCuda(v2Run(mode, state.choice).source, 'hello.cu'));

  for (const control of [choice, run, download]) control.disabled = false;
  render();
}

mountV2();
