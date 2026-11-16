// Copyright © 2026 Christopher Snow.
import scenes from './first-kernel-scenes.json' with {type:'json'};
import metadata from './first-kernel-media.json' with {type:'json'};
import { escape } from '../src/continuation-ui.mjs';

export function renderFirstKernelVideo(inline) {
  const media = '../assets/media/first-kernel/';
  return `<details class="more-settings sm-recording" id="v2-first-video">
    <summary>Watch the kernel launch <span class="reference-new-tab">(${metadata.durationSeconds} sec)</span></summary>
    ${inline ? `<video controls playsinline preload="none" width="1920" height="1080"
      poster="${media}poster.jpg" aria-label="What is a CUDA kernel?">
      <source src="${media}first-kernel.mp4" type="video/mp4">
      <track kind="captions" src="${media}captions.vtt" srclang="en" label="English" default>
      Read the transcript below.
    </video>` : '<p><a href="https://snowch.github.io/gpu-lab/v2/first-kernel.html#v2-first-video">Open the recording on the course site</a></p>'}
    <details class="sm-transcript"><summary>Read the transcript</summary>
      ${scenes.map(({title,captions}) => `<section><h3>${escape(title)}</h3><p>${escape(captions.join(' '))}</p></section>`).join('')}
    </details>
  </details>`;
}
