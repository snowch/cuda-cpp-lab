// Copyright © 2026 Christopher Snow.
// Keep source files needed by published pages, not retired page controllers.
import {readFile,readdir,rm} from 'node:fs/promises';
import {posix} from 'node:path';
export async function retainPublishedRuntime(directory,htmlFiles){
 const seen=new Set(),queue=[...htmlFiles,'src/offline.mjs','src/experiment-state.mjs'];
 const relative=/["']((?:\.\.?\/)[^"'\s<>]+\.(?:mjs|js|css|json))(?:[?#][^"']*)?["']/g;
 while(queue.length){
  const path=queue.shift();if(seen.has(path))continue;seen.add(path);
  const source=await readFile(directory+'/'+path,'utf8');
  for(const match of source.matchAll(relative)){
   const next=posix.normalize(posix.join(posix.dirname(path),match[1]));
   if(next.startsWith('src/')&&!seen.has(next))queue.push(next);
  }
 }
 for(const name of await readdir(directory+'/src')){
  if(/\.(?:mjs|js|css|json)$/.test(name)&&!seen.has('src/'+name))await rm(directory+'/src/'+name);
 }
 return [...seen].filter(path=>path.startsWith('src/'));
}
