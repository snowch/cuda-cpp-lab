// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleWarps,branchWarp,sharedBanks} from '../src/architecture.mjs';
import {tiledMatmul,precisionMatmul,attention,inferenceBudget,reduceBlock} from '../src/ai-models.mjs';

test('each reduction dependency level partitions the inputs and sums exactly those contributions',()=>{
  for(const size of [4,8]){
    const r=reduceBlock({size});
    for(const level of r.levels){
      assert.deepEqual(level.flatMap(node=>node.threads).sort((a,b)=>a-b),Array.from({length:size},(_,i)=>i));
      for(const node of level)assert.equal(node.value,node.threads.reduce((sum,i)=>sum+r.inputs[i],0));
    }
    assert.equal(r.levels.at(-1)[0].value,r.result);
    assert.equal(r.trace.at(-1).level,r.levels.length-1);
  }
});
test('attention diagram terms are the actual recurrence operands, not reconstructed labels',()=>{
  for(const n of [8,16,32])for(const scale of [1,1000]){
    const r=attention({n,scale});let previousL=0;
    for(const step of r.trace){
      assert.equal(step.previous.l,previousL);
      assert.equal(step.l,step.previous.l*step.rescale+step.tileDenominator);
      assert.equal(step.acc[0],step.previous.acc[0]*step.rescale+step.tileNumerator0);
      assert.equal(step.output[0],step.acc[0]/step.l);previousL=step.l;
    }
  }
});
test('cache growth distinguishes an empty prefill cache from an existing decode cache',()=>{
  for(const sequence of [128,512,2048]){
    const decode=inferenceBudget({sequence}),prefill=inferenceBudget({sequence,phase:'prefill'});
    assert.equal(decode.cacheTokensAfter-decode.cacheTokensBefore,1);
    assert.equal(prefill.cacheTokensBefore,0);assert.equal(prefill.cacheTokensAfter,sequence);
    assert.equal(decode.kvWriteBytes,2*decode.layers*decode.batch*decode.kvWidth*2);
  }
});
