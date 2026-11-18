// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {introScenes,introExample,introPrediction,introDeck,architectureFrame} from '../scripts/intro-recording-deck.mjs';
import {renderV2Video} from '../content/v2-lesson-video.mjs';

// The exercises keep the real starter's inputs and launch. The video changes
// only the multiplier; the new result must not appear before its pause point.
test('intro walkthroughs retain the starter mapping and reveal comparisons after the pause',()=>{
 assert.deepEqual(introExample.output,[2,4,6,8,10]);
 assert.deepEqual(introPrediction.output,[4,8,12,16,20]);
 assert.deepEqual(introExample.threads.filter(t=>t.skipped).map(t=>t.i),[5,6,7]);
 assert.match(architectureFrame('one-thread-one-element','index'),/0 × 4 \+ 2 = 2/);
 assert.doesNotMatch(architectureFrame('one-thread-one-element','predict'),/>12\.0</);
 assert.match(architectureFrame('one-thread-one-element','answer'),/>12\.0</);
 for(const [slug,scenes] of Object.entries(introScenes)){
  const pause=scenes.findIndex(s=>s.hold>=5);
  assert.ok(pause>0);
  assert.equal(scenes[pause+1].stage,slug==='first-kernel'?'before-copy':'answer');
  for(const s of scenes){assert.equal(s.captionMaxChars,48);assert.equal(s.captionSettings,'position:50% size:92% align:center');}
  const html=introDeck(slug);
  assert.match(html,/class="caption-safe"/);
  assert.doesNotMatch(html,/class="caption">/,'Captions use the native player, not a second baked copy');
 }
 const second=introScenes['one-thread-one-element'].flatMap(s=>s.captions).join(' ');
 assert.doesNotMatch(second,/\bwarps?\b|\bregisters?\b/i,'L2 stays with index, SM arithmetic and array storage');
 assert.match(second,/CUDA source editor/);
 assert.match(second,/Click Compile and run/);
});

test('published display captions are short, preserve the complete script and match transcripts',()=>{
 const all=JSON.parse(readFileSync(new URL('../content/v2-media.json',import.meta.url)));
 const first=JSON.parse(readFileSync(new URL('../content/first-kernel-media.json',import.meta.url)));
 for(const [slug,data,path] of [['first-kernel',first,'first-kernel'],['one-thread-one-element',all['one-thread-one-element'],'v2/one-thread-one-element']]){
  const source=introScenes[slug].flatMap(s=>s.captions);
  assert.deepEqual(data.cues.map(c=>c.text),source);
  const vtt=readFileSync(new URL('../assets/media/'+path+'/captions.vtt',import.meta.url),'utf8');
  const shown=vtt.split('\n').filter(l=>l&&l!=='WEBVTT'&&!l.includes(' --> '));
  assert.ok(shown.every(t=>t.length<=48));
  assert.equal(shown.join(' '),source.join(' '));
  assert.equal(data.displayCues.map(c=>c.text).join(' '),source.join(' '));
  assert.ok(data.displayCues.every(c=>c.end-c.start>=1),'Avoid flashing an orphaned word as a separate caption');
 }
 const html=renderV2Video('one-thread-one-element',true);
 assert.match(html,/Follow one element through an SM/);
 assert.match(html,/One index selects both positions/);
 assert.doesNotMatch(html,/warp grouping/);
});
