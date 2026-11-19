// Copyright © 2026 Christopher Snow.
import {cp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {v2Course} from '../content/v2-course.mjs';
import {renderV2Page} from '../content/v2-view.mjs';
import {renderCurrentDesktop} from '../content/v2-appendices.mjs';
import {renderProfiling} from '../content/profiling.mjs';
import {practicalSource} from '../content/v2-practical-source.mjs';
import {workbenchFrame} from '../content/v2-workbench-frame.mjs';
import {insertProgramStarters} from '../content/v2-programs.mjs';
import {cacheCompilerAssets,publishCompilerAssets} from './v2-compiler-assets.mjs';
import {buildOffline} from './offline.mjs';
import {retainPublishedRuntime} from './publish-runtime.mjs';
await rm('dist',{recursive:true,force:true});
for(const path of ['dist/src','dist/examples','dist/lessons'])await mkdir(path,{recursive:true});
await cp('src','dist/src',{recursive:true});
await cp('assets','dist/assets',{recursive:true});
await cp('manifest.webmanifest','dist/manifest.webmanifest');
for(const path of ['first-kernel.cu','profile-pytorch.py','inspect-pytorch-trace.py','v2-programs','v2-practical'])
 await cp('examples/'+path,'dist/examples/'+path,{recursive:true});
await writeFile('dist/examples/v2-practical/softmax-capstone.cu',practicalSource('softmax-capstone'));
// Stamp the checked-out source revision before fingerprinting the offline files.
// The commit date is stable across rebuilds of the same revision.
let identity = { commit: null, date: null };
let versionMarkup = '<span class="build-info">Development build · source revision unavailable</span>';
try {
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: new URL('../', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (dirty) throw new Error('Development build has uncommitted changes');
  const [sha, committedAt] = execFileSync('git', ['log', '-1', '--format=%H%n%cI'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim().split('\n');
  const date = new Date(committedAt).toISOString().slice(0, 10);
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid commit hash');
  identity = { commit: sha, date };
  versionMarkup = `<span class="build-info" data-commit="${sha}">Commit <a href="https://github.com/snowch/gpu-lab/commit/${sha}" aria-label="View commit ${sha.slice(0, 7)}">${sha.slice(0, 7)}</a> · <time datetime="${date}">${date}</time></span>`;
} catch {
  // Source archives may have no Git metadata; keep them buildable without inventing a version.
}

await writeFile('dist/lessons/desktop.html',renderV2Page(undefined,versionMarkup,{appendix:{
 title:'Run the examples on your desktop',lead:'Export current CUDA source or prepare PyTorch for an optional GPU trace.',
 body:renderCurrentDesktop(),otherHref:'profiling.html',otherTitle:'Inspect PyTorch GPU launches'}}));
await writeFile('dist/lessons/profiling.html',renderV2Page(undefined,versionMarkup,{appendix:{
 title:'Inspect PyTorch GPU launches',lead:'Capture a real GPU operation and interpret its launch dimensions and timing boundaries.',
 body:renderProfiling(await readFile('examples/profile-pytorch.py','utf8')),otherHref:'desktop.html',otherTitle:'Desktop setup'}}));
await mkdir('dist/v2', { recursive: true });
await writeFile('dist/index.html', renderV2Page(undefined, versionMarkup, { home: true }));
await writeFile('dist/v2/index.html', renderV2Page(undefined, versionMarkup));
const cudaWorkbench = await readFile('content/v2-cuda-source-workbench.html', 'utf8');
const compilerAssets = await cacheCompilerAssets(cudaWorkbench);
const compilerParts = await publishCompilerAssets(compilerAssets, 'dist/assets/v2-compiler');
await writeFile('dist/v2/cuda-source-workbench.html', workbenchFrame(await insertProgramStarters(cudaWorkbench), {
  compilerBase: '../releases/__BUILD_ID__/assets/v2-compiler/', compilerParts,
}).replace(
  '</main>', `<footer class="workbench-version">${versionMarkup}</footer></main>`));
const firstProgram = await readFile('examples/first-kernel.cu', 'utf8');
for (const lesson of v2Course) {
  await writeFile(`dist/v2/${lesson.slug}.html`, renderV2Page(lesson, versionMarkup, { firstProgram }));
}
await retainPublishedRuntime('dist',['index.html','v2/index.html','v2/cuda-source-workbench.html',...v2Course.map(l=>'v2/'+l.slug+'.html'),'lessons/desktop.html','lessons/profiling.html']);
await buildOffline('dist', identity);
console.log('Built static course in dist/ with explicit, verified offline downloads (all asset paths are relative).');
