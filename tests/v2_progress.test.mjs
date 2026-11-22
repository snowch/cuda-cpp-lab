import test from 'node:test';
import assert from 'node:assert/strict';
import {LessonCompletionStore,completionKey} from '../src/lesson-completion-store.mjs';
const prefix='gpu-lab:v2:manual-completion:';
function storage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
test('V2 progress has a separate namespace and independent per-lesson writes',()=>{
 const disk=storage(),a=new LessonCompletionStore(disk,['first-kernel','scan'],prefix),b=new LessonCompletionStore(disk,['first-kernel','scan'],prefix);
 a.set('first-kernel',true);b.set('scan',true);a.refresh();
 assert.equal(a.isDone('first-kernel'),true);assert.equal(a.isDone('scan'),true);
 assert.equal(disk.getItem(completionKey('scan')),null);
 a.set('first-kernel',false);b.refresh();assert.equal(b.isDone('first-kernel'),false);assert.equal(b.isDone('scan'),true);
});
test('an unsaved V2 completion can be undone without changing durable progress',()=>{
 const disk=storage(),marks=new LessonCompletionStore(disk,['first-kernel'],prefix);disk.setItem=()=>{throw new Error('Quota');};
 assert.equal(marks.set('first-kernel',true),false);assert.equal(marks.unsaved.size,1);
 assert.equal(marks.set('first-kernel',false),true);assert.equal(marks.unsaved.size,0);assert.equal(disk.values.size,0);
});
