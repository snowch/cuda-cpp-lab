import {parallelChapters} from '../src/parallel-chapters.mjs';
// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {guides,referenceTasks,renderReferenceTask,chapterReferences,renderChapterReferences} from '../src/reference-tasks.mjs';

import {pythonSource} from '../src/hello-model.mjs';

test('reference exercises use official guides and retain local answer comparisons',()=>{
  for(const [key,task] of Object.entries(referenceTasks)){
    for(const target of [task.page,task.followUpPage,task.solution].filter(Boolean)) {
      const url=new URL(guides[target]);
      assert.equal(url.protocol,'https:');
      assert.ok(['docs.pytorch.org','docs.nvidia.com','github.com','pytorch.org'].includes(url.hostname));
      assert.ok(!url.pathname.includes('/cuda-c-programming-guide/'));
    }
    const html=renderReferenceTask(key);
    assert.match(html,/target="_blank" rel="noopener noreferrer"/);
    assert.match(html,/<summary>Compare your answer<\/summary>/);
    assert.match(html,/comparison works offline/);
    if(task.followUpPage){
      assert.ok(task.followUp&&task.followUpLabel,key);
      const first=html.indexOf(`href="${guides[task.page]}"`),second=html.indexOf(`href="${guides[task.followUpPage]}"`);
      assert.ok(first<second&&second<html.indexOf('<summary>Compare your answer</summary>'),key);
      assert.ok(first<html.indexOf(task.followUp.split('<<<')[0]),key);
    }
    if(task.independent){
      assert.ok(!new URL(guides[task.page]).hash);
      assert.match(html,/Open the relevant section/);
    }
  }
  for(const key of ['reduction','matmul','tensor-cores','attention','inference']) assert.equal(referenceTasks[key].independent,true);
  assert.throws(()=>renderReferenceTask('missing'));
  assert.equal(referenceTasks['hello-pytorch'].code,pythonSource());
});
