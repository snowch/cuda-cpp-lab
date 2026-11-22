// Copyright © 2026 Christopher Snow.
import { resourceSummary, recordingTranscript, durationLabel } from './v2-resource-view.mjs';
import scenes from './first-kernel-scenes.json' with {type:'json'};
import metadata from './first-kernel-media.json' with {type:'json'};

export function renderFirstKernelVideo(inline) {
  const media = '../assets/media/first-kernel/';
  return `<details class="more-settings sm-recording v2-resource" id="v2-first-video">
    ${resourceSummary('recap', 'Follow the value through the GPU and back', `${durationLabel(metadata.durationSeconds)} · Video walkthrough, captions and transcript`)}
    <div class="v2-resource-body">
    ${inline ? '<p>Use fullscreen to inspect the code and diagram labels.</p>' : ''}
    ${inline ? `<video data-recording="v2-first-kernel" controls playsinline preload="none" width="1920" height="1080"
      poster="${media}poster.jpg" aria-label="From kernel launch to SM execution, device storage and CPU readback">
      <source src="${media}first-kernel.mp4" type="video/mp4">
      <track kind="captions" src="${media}captions.vtt" srclang="en" label="English" default>
      Read the transcript below.
    </video>` : '<p><a href="https://snowch.github.io/cuda-cpp-lab/v2/first-kernel.html#v2-first-video">Open the recording on the course site</a></p>'}
    <details class="sm-transcript"><summary>Read the transcript</summary>
      ${recordingTranscript(scenes)}
    </details>
    </div>
  </details>`;
}
