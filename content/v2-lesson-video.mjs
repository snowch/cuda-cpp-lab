// Copyright © 2026 Christopher Snow.
import media from './v2-media.json' with {type: 'json'};
import { lessonContexts } from './v2-lesson-context.mjs';
import { escape } from '../src/continuation-ui.mjs';
export function renderV2Video(slug, inline) {
  const metadata = media[slug];
  if (!metadata) throw new Error('Missing V2 recording: ' + slug);
  const context = lessonContexts[slug];
  const path = `../assets/media/v2/${slug}/`;
  return `<details class="more-settings sm-recording" id="v2-video">
    <summary>Watch the example <span class="reference-new-tab">(${metadata.durationSeconds} sec)</span></summary>
    ${inline ? `<video data-recording="v2-${slug}" controls playsinline preload="none" width="1280" height="720" poster="${path}poster.jpg" aria-label="Recap of this CUDA example">
      <source src="${path}recap.mp4" type="video/mp4">
      <track kind="captions" src="${path}captions.vtt" srclang="en" label="English" default>
      Read the transcript below.</video>` : `<p><a href="https://snowch.github.io/gpu-lab/v2/${slug}.html#v2-video">Open the recording on the course site</a></p>`}
    <details class="sm-transcript"><summary>Read the transcript</summary>
      <h3>Read the CUDA example</h3><p>${escape(context.explanation)}</p>
      <h3>Follow execution</h3><p>${escape(context.stages.map(([a,b]) => a + '. ' + b).join(' '))}</p>
      <h3>Locate the hardware</h3><p>${escape(context.hardware)}</p>
    </details></details>`;
}
