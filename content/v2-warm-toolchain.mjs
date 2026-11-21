// Copyright © 2026 Christopher Snow.
// Extend the vendored worker without editing its binary-bearing HTML payload.
export function warmToolchain(html) {
  const prefix='<script>const lab = ';
  const line=html.split('\n').find(line=>line.startsWith(prefix));
  const lab=JSON.parse(line.slice(prefix.length).replace(/;$/,''));
  let worker=lab.worker;
  const start=worker.indexOf('async function initialise(assets, advanced) {');
  const end=worker.indexOf('\nfunction compileModule(source)',start);
  if(start<0||end<0)throw new Error('Review the vendored worker initialisation before updating it.');
  worker=worker.slice(0,start)+`const toolchains = new Map();
const compilerMemories = new Set(), nvptxMemories = new Set(), activeMemories = new Set();
let unknownAllocation = false;
function allocatedWasm() {
  if (unknownAllocation || !compilerMemories.size || (nvptxCompiler && !nvptxMemories.size)) return null;
  return [...new Set([...compilerMemories, ...nvptxMemories, ...activeMemories])]
    .reduce((total, memory) => total + memory.buffer.byteLength, 0);
}
function allocationSample(instance, module, imports = {}, kind = 'active') {
  try {
    // Inspect only declared memory imports: enumerating Emscripten's GOT
    // proxies would resolve unrelated symbols and change dynamic linking.
    const memories = [
      ...WebAssembly.Module.exports(module).filter(entry => entry.kind === 'memory').map(entry => instance.exports[entry.name]),
      ...WebAssembly.Module.imports(module).filter(entry => entry.kind === 'memory').map(entry => imports[entry.module]?.[entry.name]),
    ].filter(value => value instanceof WebAssembly.Memory);
    if (!memories.length) unknownAllocation = true;
    const target = kind === 'compiler' ? compilerMemories : kind === 'nvptx' ? nvptxMemories : activeMemories;
    for (const memory of memories) target.add(memory);
    postMessage({ telemetry: { wasmBytes: allocatedWasm() } });
  } catch { unknownAllocation = true; }
}
async function initialise(assets, advanced) {
  const cached = toolchains.get(advanced);
  if (cached) { simulatorModule = cached; return; }
  postMessage({ stage: compiler ? 'Preparing the simulator for this lesson…' : 'Starting the compiler and GPU simulator…', phase: 'starting' });
  const loadCompiler = async () => {
    if (compiler) return;
    const [glue, wasm, data] = await Promise.all(assets.compiler.map(getCompilerAsset));
    const createCompiler = await importProgram(glue);
    compiler = await createCompiler({
      ...instantiate(await WebAssembly.compile(wasm), 'compiler'),
      locateFile: name => new URL(name, 'https://cuda-workbench.invalid/').href,
      getPreloadedPackage: () => data,
      print: line => compilerMessages.push(line), printErr: line => compilerMessages.push(line),
    });
  };
  const [simGlue, simWasm] = await Promise.all([
    advanced ? getCompilerAsset(assets.advanced.simGlue) : unpack(assets.simulator.glue),
    advanced ? getCompilerAsset(assets.advanced.simWasm) : unpack(assets.simulator.wasm),
    loadCompiler(),
  ]);
  simulatorModule = await WebAssembly.compile(simWasm);
  if (advanced) {
    const [glue, wasm] = await Promise.all([getCompilerAsset(assets.advanced.nvptxGlue), getCompilerAsset(assets.advanced.nvptxWasm)]);
    const createNvptx = await importProgram(glue, 'createNvptxCompiler');
    nvptxCompiler = await createNvptx({
      ...instantiate(await WebAssembly.compile(wasm), 'nvptx'), noInitialRun: true,
      printErr: line => compilerMessages.push(line),
    });
    moduleSimulator = await importProgram(simGlue, 'createModuleSimulator');
    moduleRuntime.installHeaders(compiler, matrixHeader);
  } else createSimulator = await importProgram(simGlue, 'createPtxSimulator');
  toolchains.set(advanced, simulatorModule);
}
`+worker.slice(end);
  const patch=(before,after)=>{
    if(!worker.includes(before))throw new Error('Review the vendored worker adapter contract before updating it.');
    worker=worker.replace(before,after);
  };
  // Both adapters share Clang but supply different CUDA API shims. Restore the
  // correct headers before compiling, including when navigating back to L1.
  patch(`  if (!compiler.FS.analyzePath('/workbench').exists) {
    compiler.FS.mkdir('/workbench');
    for (const [name, text] of Object.entries(programHeaders)) {
      compiler.FS.writeFile('/workbench/' + name, text);
    }
  }`, `  if (!compiler.FS.analyzePath('/workbench').exists) compiler.FS.mkdir('/workbench');
  for (const [name, text] of Object.entries(programHeaders)) compiler.FS.writeFile('/workbench/' + name, text);`);
  patch(`  if (!compiler.FS.analyzePath('/workbench').exists) {
    compiler.FS.mkdir('/workbench');
    if (matrixHeader) compiler.FS.writeFile('/workbench/mma.h', matrixHeader);
    for (const [name, text] of Object.entries(programHeaders)) {
      compiler.FS.writeFile('/workbench/' + name, text);
    }
  }`, `  if (!compiler.FS.analyzePath('/workbench').exists) compiler.FS.mkdir('/workbench');
  if (matrixHeader) compiler.FS.writeFile('/workbench/mma.h', matrixHeader);
  for (const [name, text] of Object.entries(programHeaders)) compiler.FS.writeFile('/workbench/' + name, text);`);
  patch('function compileModule(source) {','function compileModule(source) {\n  moduleRuntime.installHeaders(compiler);');
  patch('source, assets, profile, fullProgram, advanced }','source, assets, profile, fullProgram, advanced, type }');
  patch("    postMessage({ stage: 'Compiling your CUDA source…', ready: true });", "    if (type === 'prepare') { activeMemories.clear(); postMessage({ prepared: true, wasmBytes: allocatedWasm() }); return; }\n    postMessage({ stage: 'Compiling your CUDA source…', phase: 'compiling', ready: true });\n    postMessage({ telemetry: { wasmBytes: allocatedWasm() } });");
  patch('function instantiate(module) {', "function instantiate(module, kind = 'active') {");
  patch('const instance = new WebAssembly.Instance(module, imports);', 'const instance = new WebAssembly.Instance(module, imports);\n      allocationSample(instance, module, imports, kind);');
  const hostInstance='instance = await WebAssembly.instantiate(module, { env: runtime });';
  if(worker.split(hostInstance).length!==3)throw new Error('Review both host-memory instances before updating the worker.');
  worker=worker.replaceAll(hostInstance,hostInstance+'\n  allocationSample(instance, module);');
  patch("postMessage({ ...result, diagnostics: compilerMessages.join('\\n') });", "activeMemories.clear();\n    postMessage({ ...result, diagnostics: compilerMessages.join('\\n'), wasmBytes: allocatedWasm() });");
  patch("postMessage({ error: String(error.message ?? error) });", "activeMemories.clear();\n    postMessage({ error: String(error.message ?? error), wasmBytes: allocatedWasm() });");
  patch("postMessage({ diagnostics: compilerMessages.join('\\n'), compileError: true });", "activeMemories.clear();\n      postMessage({ diagnostics: compilerMessages.join('\\n'), compileError: true, wasmBytes: allocatedWasm() });");
  lab.worker=worker;
  return html.replace(line,prefix+JSON.stringify(lab).replaceAll('<','\\u003c')+';');
}
