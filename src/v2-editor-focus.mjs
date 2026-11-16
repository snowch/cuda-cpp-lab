// Copyright © 2026 Christopher Snow.
// Self-contained so the standalone workbench can embed the same enhancement.
export function mountFirstKernelFocus(editor, reset) {
  const document = editor.ownerDocument;
  const view = document.defaultView;
  const guidance = document.createElement('div');
  guidance.className = 'source-focus';
  guidance.innerHTML = `<p id="source-focus-help">The <code>hello</code> kernel and its launch in <code>main()</code> are highlighted. <strong>Change this:</strong> the value assigned to <code>output[0]</code> (<code>42.0f</code> in the starter). The remaining code allocates memory, checks errors and reads back the result; you can leave it unchanged for now.</p>
    <button type="button">Show target line</button>
    <button type="button" data-show-launch>Show launch</button>
    <p id="source-focus-missing" hidden>The output assignment in hello could not be found. Restore starter to return to the example.</p>`;
  editor.before(guidance);
  const surface = document.createElement('div');
  surface.className = 'source-editor';
  editor.before(surface);
  surface.append(editor);
  editor.setAttribute('aria-describedby', 'source-focus-help source-focus-missing');
  const show = guidance.querySelector('button');
  const showLaunch = guidance.querySelector('[data-show-launch]');
  const missing = guidance.querySelector('#source-focus-missing');
  let target, launch;

  function syncScroll() {
    editor.style.setProperty('--source-focus-scroll-top', -editor.scrollTop + 'px');
  }

  function update() {
    // Follow the assignment after edits, rather than a fixed line number or value.
    // Mask comments and literals without shifting source offsets. Count braces
    // so adding an if/loop does not truncate the highlighted kernel definition.
    const code = editor.value.replace(/\/\/[^\n]*|\/\*[^]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
      token => token.replace(/[^\n]/g, ' '));
    const header = /\b__global__\s+void\s+hello\s*\([^)]*\)\s*\{/.exec(code);
    let kernel = null;
    if (header) {
      let depth = 1;
      for (let end = header.index + header[0].length; end < code.length; end++) {
        if (code[end] === '{') depth++;
        if (code[end] === '}' && --depth === 0) {
          kernel = {index: header.index, end: end + 1};
          break;
        }
      }
    }
    const body = kernel && code.slice(header.index + header[0].length, kernel.end - 1);
    const assignment = body && /^[\t ]*output\s*\[\s*0\s*\]\s*=[^\n]+/m.exec(body);
    target = assignment ? header.index + header[0].length + assignment.index : null;
    launch = /\bhello\s*<<<[^;]*?>>>\s*\([^;]*?\)\s*;/.exec(code);
    missing.hidden = Boolean(kernel && target !== null && launch);
    missing.textContent = missing.hidden ? '' : !kernel ? 'The complete hello kernel could not be found. Restore starter to return to the example.' :
      target === null ? 'The output assignment in hello could not be found. Restore starter to return to the example.' :
        'The launch of hello could not be found. Restore starter to return to the example.';
    show.disabled = target === null;
    showLaunch.disabled = !launch;
    editor.classList.toggle('has-source-focus', Boolean(kernel || launch));
    const style = view.getComputedStyle(editor);
    const height = parseFloat(style.lineHeight);
    const padding = parseFloat(style.paddingTop);
    const ranges = [];
    function band(name, start, end, ink) {
      const top = start == null ? 0 : padding + (code.slice(0, start).split('\n').length - 1) * height;
      const bottom = end == null ? 0 : padding + code.slice(0, end).split('\n').length * height;
      editor.style.setProperty('--' + name + '-focus-top', top + 'px');
      editor.style.setProperty('--' + name + '-focus-bottom', bottom + 'px');
      if (start != null) ranges.push({top, bottom, ink});
      return top;
    }
    band('kernel', kernel?.index, kernel?.end, 'var(--source-lesson-ink)');
    band('launch', launch?.index, launch && launch.index + launch[0].length, 'var(--source-lesson-ink)');
    // Last range wins: the editable assignment has its own font colour inside
    // the complete kernel. Clip these colours to native textarea glyphs so
    // editing, selection, accessibility and scrolling remain browser-native.
    const top = band('source', target, target === null ? null : target + assignment[0].length, 'var(--source-target-ink)');
    const contentHeight = Math.max(editor.scrollHeight, editor.clientHeight);
    const boundaries = [...new Set([0, contentHeight, ...ranges.flatMap(range => [range.top, range.bottom])])].sort((a, b) => a - b);
    const colours = boundaries.slice(0, -1).map((start, index) => {
      const ink = ranges.reduce((ink, range) => range.top <= start && start < range.bottom ? range.ink : ink, 'var(--source-neutral-ink)');
      return ink + ' ' + start + 'px ' + boundaries[index + 1] + 'px';
    });
    editor.style.setProperty('--source-focus-ink', 'linear-gradient(to bottom, ' + colours.join(', ') + ')');
    editor.style.setProperty('--source-focus-height', contentHeight + 'px');
    syncScroll();
    return {top, height};
  }

  function reveal(focus = false, section = 'source') {
    const position = update();
    const offset = section === 'launch' ? launch?.index : target;
    if (offset == null) return;
    const top = parseFloat(editor.style.getPropertyValue('--' + section + '-focus-top'));
    // Include the kernel declaration above the assignment, without selecting text.
    editor.scrollTop = Math.max(0, top - position.height * 2);
    editor.scrollLeft = 0;
    if (focus) {
      editor.focus({preventScroll: true});
      editor.setSelectionRange(offset, offset);
      // Setting the caret can scroll a textarea; keep its context visible.
      editor.scrollTop = Math.max(0, top - position.height * 2);
    }
    syncScroll();
  }

  show.addEventListener('click', () => reveal(true));
  showLaunch.addEventListener('click', () => reveal(true, 'launch'));
  editor.addEventListener('input', update);
  editor.addEventListener('scroll', syncScroll);
  editor.addEventListener('gpu-lab:source-restored', () => reveal());
  reset.addEventListener('click', () => reveal());
  new view.ResizeObserver(update).observe(editor);
  view.requestAnimationFrame(() => reveal());
}
