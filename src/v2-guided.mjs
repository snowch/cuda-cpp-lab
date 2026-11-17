// Copyright © 2026 Christopher Snow.
import { coreLessons } from './v2-core-lessons.mjs';
import { parallelLessons } from './v2-parallel-lessons.mjs';
import { runTrace } from './v2-traces.mjs';

export const guidedLessons = { ...coreLessons, ...parallelLessons };

export function mountGuided(root) {
  const activity = root.querySelector('[data-v2-guided]');
  if (!activity) return;
  const slug = activity.dataset.v2Guided;
  const lesson = guidedLessons[slug];
  const get = selector => activity.querySelector(selector);
  const choice = get('#v2-choice');
  const prediction = get('#v2-prediction');
  const source = get('#v2-source code');
  const result = get('#v2-result');
  const form = get('form');
  const feedback = get('#v2-feedback');
  const summary = get('[data-summary]');
  const trace = get('[data-trace]');
  const steps = get('[data-steps]');
  const previous = get('[data-prev]');
  const next = get('[data-next]');
  const position = get('[data-position]');
  const key = 'gpu-lab-v2:' + slug;
  let state = { choice: 0, prediction: '', step: 0, ran: false };
  let run;

  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Number.isInteger(saved?.choice) && lesson.cases[saved.choice]) {
      state = {
        choice: saved.choice,
        prediction: typeof saved.prediction === 'string' ? saved.prediction : '',
        step: Number.isInteger(saved.step) && saved.step >= 0 ? saved.step : 0,
        ran: saved.ran === true,
      };
    }
  } catch { /* Storage is optional. */ }

  function currentValue() {
    return lesson.cases[state.choice][0];
  }

  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Storage is optional. */ }
  }

  function showStep() {
    state.step = Math.min(state.step, run.frames.length - 1);
    trace.innerHTML = run.frames[state.step];
    steps.hidden = run.frames.length < 2;
    previous.disabled = state.step === 0;
    next.disabled = state.step >= run.frames.length - 1;
    position.textContent = `Step ${state.step + 1} of ${run.frames.length}`;
  }

  function showResult() {
    result.hidden = !state.ran;
    if (!state.ran) {
      summary.replaceChildren();
      trace.replaceChildren();
      feedback.textContent = 'Optionally enter a prediction, then click Run model.';
      return;
    }
    run = runTrace(slug, currentValue());
    summary.innerHTML = run.summary;
    const guess = state.prediction.trim();
    const answer = run.answer;
    feedback.textContent = !guess ? `The model gives ${answer}. Explore the result below.` :
      Number(guess) === answer ? `Your prediction matches the model result of ${answer}.` :
        `You predicted ${guess}. The model gives ${answer}. Use the trace to explain the difference.`;
    showStep();
  }

  choice.value = String(state.choice);
  prediction.value = state.prediction;
  source.textContent = lesson.code(currentValue());
  choice.addEventListener('change', () => {
    state = { choice: Number(choice.value), prediction: '', step: 0, ran: false };
    prediction.value = '';
    source.textContent = lesson.code(currentValue());
    showResult();
    save();
  });
  prediction.addEventListener('input', () => {
    state.prediction = prediction.value;
    state.ran = false;
    showResult();
    save();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    state.ran = true;
    state.step = 0;
    showResult();
    save();
  });
  for (const [button, direction, other] of [[previous, -1, next], [next, 1, previous]]) {
    button.addEventListener('click', () => {
      state.step += direction;
      showStep();
      if (button.disabled) other.focus();
      save();
    });
  }
  for (const control of [choice, prediction, get('#v2-run')]) control.disabled = false;
  showResult();
}
