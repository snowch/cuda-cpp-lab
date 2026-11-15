// Copyright © 2026 Christopher Snow.
// Shared labels keep the chapter's orientation and its recap at the same scale.
export const deviceArchitecture={
  host:{title:'CPU side',processor:'CPU processor',work:'Runs Python; requests GPU operations.',memory:'System RAM',storage:'Stores CPU tensor values.'},
  gpu:{title:'GPU device',processor:'GPU compute chip',work:'Performs the multiplication.',memory:'GPU memory (VRAM)',storage:'Stores GPU tensor values.'},
  scope:'Simplified discrete-GPU example: dedicated GPU memory is separate from the compute chip. Arrows show data paths, not elapsed time; caches are omitted.',
};

export function renderDeviceArchitecture(){
  const {host,gpu,scope}=deviceArchitecture;
  return `<figure class="device-architecture" aria-labelledby="device-architecture-title">
    <figcaption id="device-architecture-title">Where values live; where calculation happens</figcaption>
    <p class="device-architecture-system">Computer / system</p>
    <div class="device-architecture-sides">${[host,gpu].map(side=>`<div class="device-architecture-side">
      <h3>${side.title}</h3>
      <div class="device-architecture-component"><h4>${side.processor}</h4><p>${side.work}</p></div>
      <p class="device-architecture-local"><span aria-hidden="true">↕</span> Reads inputs · writes results</p>
      <div class="device-architecture-component"><h4>${side.memory}</h4><p>${side.storage}</p></div>
    </div>`).join('')}</div>
    <div class="device-architecture-copies">
      <p><code>.to("cuda")</code><span>System RAM → GPU memory</span></p>
      <p><code>.cpu()</code><span>GPU memory → system RAM</span></p>
    </div>
    <p class="book-note">${scope}</p>
  </figure>`;
}
