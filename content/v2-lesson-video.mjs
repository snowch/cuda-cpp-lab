// Copyright © 2026 Christopher Snow.
import { resourceSummary, recordingTranscript } from './v2-resource-view.mjs';
import media from './v2-media.json' with {type: 'json'};
import { escape } from '../src/continuation-ui.mjs';
import arrayScenes from './one-thread-one-element-scenes.json' with {type:'json'};
export function renderV2Video(slug, inline) {
  const metadata = media[slug];
  if (!metadata) throw new Error('Missing V2 recording: ' + slug);
  const path = `../assets/media/v2/${slug}/`;
  const architecture = slug === 'one-thread-one-element' || Boolean(metadata.learning);
  // A future script edit must never silently replace a published transcript.
  const published=metadata.scenes.map(scene=>({title:scene.title,captions:metadata.cues.filter(cue=>cue.id.startsWith(scene.id+'-')).map(cue=>cue.text)}));
  return `<details class="more-settings sm-recording v2-resource" id="v2-video">
    ${resourceSummary('recap', metadata.learning?.title || (architecture ? 'Follow one element through an SM' : 'Watch the example'), `${metadata.durationSeconds} sec · ${architecture ? 'Video walkthrough' : 'Video'}, captions and transcript`)}
    <div class="v2-resource-body">
    ${architecture && inline ? '<p>Use fullscreen to inspect the code and diagram labels.</p>' : ''}
    ${inline ? `<video data-recording="v2-${slug}" controls playsinline preload="none" width="1280" height="720" poster="${path}poster.jpg" aria-label="${escape(metadata.learning?.outcome || (architecture ? 'Thread indices, GPU memory and shared SM execution hardware' : 'Recap of this CUDA example'))}">
      <source src="${path}recap.mp4" type="video/mp4">
      <track kind="captions" src="${path}captions.vtt" srclang="en" label="English" default>
      Read the transcript below.</video>` : `<p><a href="https://snowch.github.io/cuda-cpp-lab/v2/${slug}.html#v2-video">Open the recording on the course site</a></p>`}
    <details class="sm-transcript"><summary>Read the transcript</summary>
      ${recordingTranscript(slug==='one-thread-one-element'?arrayScenes:published)}
    </details></div></details>`;
}
