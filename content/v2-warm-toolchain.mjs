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
async function initialise(assets, advanced) {
  const cached = toolchains.get(advanced);
  if (cached) { simulatorModule = cached; return; }
  postMessage({ stage: 'Loading Clang and GPGPU-Sim…', phase: 'starting' });
  const loadCompiler = async () => {
    if (compiler) return;
    const [glue, wasm, data] = await Promise.all(assets.compiler.map(getCompilerAsset));
    const createCompiler = await importProgram(glue);
    compiler = await createCompiler({
      wasmBinary: new Uint8Array(wasm),
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
      ...instantiate(await WebAssembly.compile(wasm)), noInitialRun: true,
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
  patch("    postMessage({ stage: 'Compiling your CUDA source…', ready: true });", "    if (type === 'prepare') { postMessage({ prepared: true }); return; }\n    postMessage({ stage: 'Compiling your CUDA source…', phase: 'compiling', ready: true });");
  lab.worker=worker;
  return html.replace(line,prefix+JSON.stringify(lab).replaceAll('<','\\u003c')+';');
}
