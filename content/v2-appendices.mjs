// Copyright © 2026 Christopher Snow.
import {codePanel,readerTask} from '../src/chapter-view.mjs';
const command=(id,source)=>codePanel({id,source,language:'shell',label:'Terminal · shell commands'});
export function renderCurrentDesktop(){
 return `<section class="book-section"><h2>Choose the execution environment</h2>
 <p>The course’s browser editor compiles and executes CUDA C++ with a functional GPU simulator. No installation is needed for those activities. Native CUDA execution requires an NVIDIA GPU, its driver and a compatible CUDA toolkit.</p>
 <p>Keep functional correctness and physical GPU measurements separate. Browser simulation checks program behaviour; it does not measure your GPU’s speed.</p></section>
 <section class="book-section" id="cuda"><h2>Run a current CUDA example</h2>
 <p>Install the toolkit using NVIDIA’s <a href="https://docs.nvidia.com/cuda/cuda-installation-guide-linux/" target="_blank" rel="noopener noreferrer">CUDA installation guide (new tab)</a> for your operating system. In any course editor, open <strong>Editor tools</strong> and choose <strong>Export .cu</strong> to download your current source.</p>
 <p>For a small complete starting program, <a href="../examples/first-kernel.cu" download>download first-kernel.cu</a>. In its download directory, compile and run:</p>
 ${command('desktop-first-kernel','nvcc -O2 first-kernel.cu -o first-kernel\n./first-kernel')}
 <p>The unchanged example prints <code>42.0</code>. The project validates examples in functional simulation; physical GPU execution of this example has not been validated here. Native compiler or driver errors are different from the program’s printed result.</p>
 ${readerTask('In the downloaded hello kernel, change output[0] = 42.0f to output[0] = 7.0f. Compile again, run the new executable and check for 7.0 in the output. Keep the supplied allocation, CUDA error handling and result copy unchanged.','Change the written value')}
 <p><a href="../v2/first-kernel.html">Return to the first CUDA lesson</a>. Later complete examples are in the current lesson editors and the repository’s <code>examples/v2-programs</code> and <code>examples/v2-practical</code> directories.</p></section>
 <section class="book-section" id="pytorch"><h2>Prepare PyTorch for an optional GPU trace</h2>
 <p>To capture actual framework-selected GPU launches, use the <a href="https://pytorch.org/get-started/locally/" target="_blank" rel="noopener noreferrer">PyTorch installation selector (new tab)</a> for your operating system and CUDA configuration. Then run:</p>
 ${command('desktop-pytorch-check','python -c "import torch; print(torch.__version__); print(torch.cuda.is_available())"')}
 <p>The first line identifies the installed PyTorch version. The second must be <code>True</code> before using the profiling appendix’s CUDA capture. A CPU-only installation can check values but cannot capture GPU launches.</p>
 <p>Continue to <a href="profiling.html">Inspect PyTorch GPU launches</a> for the complete capture program, trace reader and interpretation limits. Native tools and their installations are separate from the course’s offline download.</p></section>`;
}
