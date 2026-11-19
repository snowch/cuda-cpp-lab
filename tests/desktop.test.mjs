import {parallelChapters} from '../src/parallel-chapters.mjs';
// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

import {runnableSource} from '../src/hello-model.mjs';

test('CUDA suite covers safe workshop templates and independent references',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'gpu-cuda-cases-'));
  try{
    execFileSync('node',['scripts/generate-cuda-cases.mjs',dir]);
    assert.equal((await readdir(dir)).filter(f=>f.endsWith('.cu')).length,21);
    assert.deepEqual(JSON.parse(await readFile(join(dir,'launch-input-nine.json'),'utf8')),[2,4,6,8,10,-2,0,1,24]);
    assert.match(await readFile(join(dir,'double-eight.cu'),'utf8'),/runKernel<<<\(n \+ 8 - 1\) \/ 8, 8>>>/);
    assert.deepEqual(JSON.parse(await readFile(join(dir,'double-eight.json'),'utf8')),[2,4,6,8,10]);
    for(const op of ['multiply','add','vector-add'])for(const size of [8,16,32,64]){
      const name=`workshop-${op}-${size}`;
      const expected=Array.from({length:35},(_,i)=>{const x=(i%2?-1:1)*(i+1)/2;return op==='multiply'?x*2:op==='add'?x+2:x+(i%5)-2.25;});
      assert.deepEqual(JSON.parse(await readFile(join(dir,name+'.json'),'utf8')),expected);
      const source=await readFile(join(dir,name+'.cu'),'utf8');
      assert.match(source,/blockIdx.x \* blockDim.x \+ threadIdx.x/);assert.match(source,/if \(i < n\)/);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
  const bank=await readFile('examples/shared-memory.cu','utf8');
  assert.match(bank,/BEGIN BANK KERNEL[\s\S]*__syncthreads\(\)[\s\S]*END BANK KERNEL/);
  assert.match(bank,/readColumn<<<1, 32>>>/);assert.match(bank,/std::isfinite/);
});
