// Copyright © 2026 Christopher Snow.
// Self-contained so the standalone workbench can embed the same enhancement.
export function mountFirstKernelFocus(editor, reset) {
  const document = editor.ownerDocument;
  const view = document.defaultView;
  const guidance = document.createElement('div');
  guidance.className = 'source-focus';
  guidance.innerHTML = `<p id="source-focus-help"><strong>Change this:</strong> the value assigned to <code>output[0]</code> in <code>hello</code> (<code>42.0f</code> in the starter). The remaining code allocates memory, checks errors and reads back the result; you can leave it unchanged for now.</p>
    <button type="button">Show target line</button>
    <p id="source-focus-missing" hidden>The output assignment in hello could not be found. Restore starter to return to the example.</p>`;
  editor.before(guidance);
  editor.setAttribute('aria-describedby', 'source-focus-help source-focus-missing');
  const show = guidance.querySelector('button');
  const missing = guidance.querySelector('#source-focus-missing');
  let target;

  function update() {
    // Follow the assignment after edits, rather than a fixed line number or value.
    const kernel = /\b__global__\s+void\s+hello\s*\([^)]*\)\s*\{([^]*?)\}/.exec(editor.value);
    const assignment = kernel && /^[\t ]*output\s*\[\s*0\s*\]\s*=[^\n]+/m.exec(kernel[1]);
    target = assignment ? kernel.index + kernel[0].indexOf('{') + 1 + assignment.index : null;
    missing.hidden = target !== null;
    show.disabled = target === null;
    editor.classList.toggle('has-source-focus', target !== null);
    if (target === null) return;
    const style = view.getComputedStyle(editor);
    const height = parseFloat(style.lineHeight);
    const line = editor.value.slice(0, target).split('\n').length - 1;
    const top = parseFloat(style.paddingTop) + line * height;
    editor.style.setProperty('--source-focus-top', top + 'px');
    editor.style.setProperty('--source-focus-bottom', top + height + 'px');
    editor.style.setProperty('--source-focus-height', Math.max(editor.scrollHeight, editor.clientHeight) + 'px');
    return {top, height};
  }

  function reveal(focus = false) {
    const position = update();
    if (!position) return;
    // Include the kernel declaration above the assignment, without selecting text.
    editor.scrollTop = Math.max(0, position.top - position.height * 2);
    editor.scrollLeft = 0;
    if (focus) {
      editor.focus({preventScroll: true});
      editor.setSelectionRange(target, target);
      // Setting the caret can scroll a textarea; keep its context visible.
      editor.scrollTop = Math.max(0, position.top - position.height * 2);
    }
  }

  show.addEventListener('click', () => reveal(true));
  editor.addEventListener('input', update);
  editor.addEventListener('gpu-lab:source-restored', () => reveal());
  reset.addEventListener('click', () => reveal());
  new view.ResizeObserver(update).observe(editor);
  view.requestAnimationFrame(() => reveal());
}
