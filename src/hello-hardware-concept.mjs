// Copyright © 2026 Christopher Snow.
import {simulateIntro} from './hello-model.mjs';
import {tensorValue} from './value-format.mjs';

export function renderHelloHardwareConcept(){
  const example=simulateIntro(2,2),threads=example.threads.filter(t=>t.block===0).slice(0,2);
  const values=(working=false)=>`<table class="hello-hardware-values"><thead><tr><th scope="col">${working?'Thread':'Array index'}</th><th scope="col">Input</th><th scope="col">${working?'Result':'Output'}</th></tr></thead><tbody>${threads.map(t=>`<tr><th scope="row">${working?'Thread ':''}${t.i}</th><td>${tensorValue(t.input)}</td><td>${tensorValue(t.output)}</td></tr>`).join('')}</tbody></table>`;
  return `<figure class="hello-hardware-concept" aria-labelledby="hello-hardware-caption">
    <figcaption id="hello-hardware-caption">Worked value path · two threads from block 0</figcaption>
    <p class="hello-hardware-boundary">GPU device · detail</p>
    <div class="hello-hardware-path">
      <div class="hello-hardware-storage"><h4>GPU memory</h4><p>Arrays outside the compute chip</p>${values()}</div>
      <div class="hello-hardware-links"><span>Read inputs <b aria-hidden="true">→</b></span><span><b aria-hidden="true">←</b> Write results</span></div>
      <div class="hello-hardware-chip"><h4>GPU compute chip</h4>
        <div class="hello-hardware-sm"><h5>Inside one SM</h5>
          <div class="hello-hardware-working"><h6>Each thread’s working values</h6>${values(true)}</div>
          <p class="hello-hardware-exchange">Inputs to arithmetic <span aria-hidden="true">↕</span> Results back to working values</p>
          <div class="hello-hardware-math"><h6>Shared arithmetic hardware</h6><p class="hello-hardware-operation">× ${example.factor}</p><p>Uses each thread’s input to calculate its result.</p></div>
        </div>
      </div>
    </div>
    <p class="hello-note">Only two threads and one SM are shown. Arrows connect storage and shared arithmetic; they do not show execution order or unit counts.</p>
  </figure>`;
}
