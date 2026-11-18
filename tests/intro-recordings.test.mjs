// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { introScenes, introExample, introPrediction, introDeck, architectureFrame } from '../scripts/intro-recording-deck.mjs';
import { renderV2Video } from '../content/v2-lesson-video.mjs';

test('intro recordings use the starter mapping, distinguish skipped threads and leave predictions unrevealed',()=>{
 assert.deepEqual(introExample.output,[2,4,6,8,10]);
 assert.deepEqual(introPrediction.output,[.5,1,1.5,2,2.5]);
 assert.deepEqual(introExample.threads.filter(t=>t.skipped).map(t=>t.i),[5,6,7]);
 const guard=architectureFrame('one-thread-one-element','guard');
 assert.equal((guard.match(/class="skipped"/g)||[]).length,3);
 assert.equal((guard.match(/class="occupied"/g)||[]).length,8);
 assert.equal((guard.match(/class="unoccupied"/g)||[]).length,56);
 const prompt=architectureFrame('one-thread-one-element','predict');
 assert.doesNotMatch(prompt,/>1\.5</);
 assert.match(architectureFrame('one-thread-one-element','answer'),/>1\.5</);
 for(const [slug,scenes] of Object.entries(introScenes)){
  const question=scenes.findIndex(s=>s.stage==='predict');
  assert.ok(question>0&&scenes[question+1].stage==='answer');
  assert.ok(scenes[question].hold>=5);
  for(const scene of scenes){
   assert.ok(scene.captions.every(c=>c.length<=86),'Short captions must leave the diagram readable');
   assert.equal(scene.captionSettings,'line:0 position:50% size:95%');
  }
  assert.match(introDeck(slug),/System RAM/);
 }
});

test('new hardware walkthrough captions and visible transcripts use the same reviewed scripts',()=>{
 const media=JSON.parse(readFileSync(new URL('../content/v2-media.json',import.meta.url)))['one-thread-one-element'];
 const first=JSON.parse(readFileSync(new URL('../content/first-kernel-media.json',import.meta.url)));
 for(const [slug,data] of [['first-kernel',first],['one-thread-one-element',media]])
  assert.deepEqual(data.cues.map(c=>c.text),introScenes[slug].flatMap(s=>s.captions));
 const html=renderV2Video('one-thread-one-element',true);
 assert.match(html,/Follow one element through an SM/);
 assert.match(html,/The index selects a memory element/);
 assert.doesNotMatch(html,/<h3>Read the CUDA example<\/h3>/);
});
