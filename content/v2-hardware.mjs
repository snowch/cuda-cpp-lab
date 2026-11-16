// Copyright © 2026 Christopher Snow.
import { v2Course } from './v2-course.mjs';
import { lessonContexts } from './v2-lesson-context.mjs';
import { escape } from '../src/continuation-ui.mjs';

export function renderV2Hardware(slug) {
  const number = v2Course.findIndex(lesson => lesson.slug === slug) + 1;
  if (!number) throw new Error('Unknown hardware context: ' + slug);
  const focus = lessonContexts[slug]?.focus ?? 'sm';
  const detail = number >= 5;
  const node = (key, title, text) => `<div class="v2-hw-node${focus === key ? ' is-focus' : ''}" data-hardware="${key}">
    <strong>${escape(title)}${focus === key ? '<span class="v2-hw-focus">This lesson</span>' : ''}</strong><span>${escape(text)}</span></div>`;
  const hardware = lessonContexts[slug]?.hardware ?? 'The CPU launches the kernel. An SM executes its thread instructions, and the result is stored in device memory before the CPU copies it to system RAM.';
  return `<section class="book-section" aria-labelledby="v2-hardware-title">
    <h2 id="v2-hardware-title">Hardware context</h2>
    <p>${escape(hardware)}</p>
    ${detail ? `<details class="more-settings v2-hw-key"${[5,8,9,12].includes(number) ? ' open' : ''}><summary>Read the hardware key</summary><dl>
      <dt>Resident warp</dt><dd>A group of 32 threads with resources allocated on an SM.</dd>
      <dt>Warp scheduler</dt><dd>Selects ready warp instructions for available execution hardware.</dd>
      <dt>Registers</dt><dd>Hold working values associated with individual threads.</dd>
      <dt>Execution units</dt><dd>Perform arithmetic and other instructions for threads; they are shared hardware.</dd>
<dt>Load/store units</dt><dd>Execute memory instructions, forming requests from active lanes’ addresses.</dd>
      <dt>L1 / L2 cache</dt><dd>Keep recently used data on the GPU chip. L1 is local to an SM; L2 is shared across SMs in this simplified view.</dd>
      ${number >= 8 ? '<dt>Shared memory</dt><dd>SM-local storage allocated to blocks for explicit data exchange. It may share physical storage with L1, depending on the GPU.</dd>' : ''}
      ${number >= 9 ? '<dt>Bank</dt><dd>A subdivision of shared memory that serves a group of word addresses.</dd>' : ''}
      ${number >= 12 ? '<dt>Tensor cores</dt><dd>Matrix execution units used by supported warp-wide matrix instructions.</dd>' : ''}
    </dl></details>` : ''}
    <figure class="v2-hardware" data-hardware-stage="${detail ? number >= 12 ? 'matrix' : 'sm' : 'device'}">
      <figcaption>Computer / system · ${detail ? 'inside one SM' : 'host and GPU device'}</figcaption>
      <div class="v2-hw-system">
        <div class="v2-hw-host"><h3>CPU side · CUDA host</h3><div class="v2-hw-peers">
          ${node('cpu', 'CPU', 'main() and CUDA calls.')}
          ${node('ram', 'System RAM', 'CPU arrays.')}
        </div></div>
        <p class="v2-hw-link">Host ↔ device · copies move data; launches request execution</p>
        <div class="v2-hw-device"><h3>GPU device</h3>
          <div class="v2-hw-chip"><h4>GPU compute chip</h4>
            <div class="v2-hw-sms">
              <div class="v2-hw-sm${focus === 'sm' ? ' is-focus' : ''}" data-hardware="sm">
                <h5>SM · streaming multiprocessor</h5>
                ${detail ? `<div class="v2-hw-assigned">Assigned blocks → resident warps → threads<br><small>Logical groups using this SM’s resources</small></div>
                  ${node('scheduler', 'Warp schedulers', 'Ready warp instructions.')}
                  <p class="v2-hw-link">Issue to the appropriate units</p>
                  <div class="v2-hw-peers">${node('registers', 'Registers', 'Thread working values.')}${node('execution', 'Execution units', 'Shared arithmetic hardware.')}</div>
                  <p class="v2-hw-link">Registers ↔ execution units · operands and results</p>
                  ${number >= 12 ? node('tensor', 'Tensor cores', 'Supported matrix multiply-accumulate instructions.') : ''}
                  ${node('global', 'Load/store units', 'Memory instructions and addresses.')}
                  <div class="v2-hw-peers">${node('l1', 'L1 cache', 'Recently used data.')}${number >= 8 ? node(focus === 'banks' ? 'banks' : 'shared', number >= 9 ? 'Shared memory · banks' : 'Shared memory', 'Per-block data exchange.') : ''}</div>` : node('sm', 'Assigned blocks', 'Executes the kernel’s thread instructions.')}
              </div>
              <div class="v2-hw-other"><strong>Other SMs</strong><p>Have their own execution resources.</p><p>Blocks may be assigned to different SMs.</p></div>
            </div>
            ${detail ? `<p class="v2-hw-link">Global-memory requests ↔ on-chip interconnect</p>
              ${node('l2', 'Shared L2 cache', 'Data cached for multiple SMs.')}` : ''}
            ${number >= 20 ? node('copy', 'Copy engines', 'Transfer data independently of SM arithmetic when supported.') : ''}
          </div>
          <p class="v2-hw-link">Chip ↔ device memory · data transfers</p>
          ${node('memory', 'Device memory', 'GPU arrays; separate from the compute chip.')}
        </div>
      </div>
      <p class="v2-hw-scope">Simplified NVIDIA-style architecture. Boundaries show containment; arrows name relationships. Unit counts, placement, issue widths and timings vary by GPU. A thread or warp is not a dedicated physical processor.</p>
    </figure>
  </section>`;
}
