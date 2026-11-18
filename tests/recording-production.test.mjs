// Copyright © 2026 Christopher Snow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const json = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const hash = path => createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');
const inventory = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? inventory(join(directory, entry.name)) : [join(directory, entry.name)]);

test('every published recording matches the decoded and speech-screened production', () => {
  const production = json('content/recording-production.json');
  const screen = json('docs/recording-speech-screen.json');
  const videos = inventory('assets/media').filter(path => path.endsWith('.mp4')).sort();
  assert.deepEqual(production.recordings.map(item => item.video).sort(), videos);
  assert.equal(production.skill.commit, 'c9a7c521568632aa216932f4c965df386498602a');
  assert.equal(production.voice, 'af_heart');
  assert.equal(production.backend, 'onnx');
  assert.equal(production.speed, 1);
  assert.equal(screen.model, 'small.en');
  assert.equal(production.asrCueCount, screen.scenes.length);
  assert.equal(new Set(screen.scenes.map(cue => cue.id)).size, screen.scenes.length);
  assert.deepEqual(Object.keys(screen.rawFlags).sort(), Object.keys(screen.reviews).sort());
  const screened = new Set(screen.scenes.map(cue => cue.id));
  const screenedText = new Map(screen.scenes.map(cue => [cue.id,cue.text]));
  assert.deepEqual(Object.keys(screen.spokenForms).sort(), [...screened].sort());
  for (const spoken of Object.values(screen.spokenForms)) {
    assert.doesNotMatch(spoken, /[<>]/, 'Code comparisons need spoken words; Kokoro can omit symbolic operators');
  }
  let cues = 0;
  for (const item of production.recordings) {
    const directory = item.video.slice(0, item.video.lastIndexOf('/'));
    assert.equal(hash(item.video), item.sha256, item.key + ': video changed after decode');
    assert.equal(hash(directory + '/captions.vtt'), item.captionSha256, item.key + ': captions changed after review');
    assert.equal(hash(directory + '/poster.jpg'), item.posterSha256, item.key + ': poster changed after review');
    assert.equal(item.fullDecode, true);
    assert.deepEqual([item.width, item.height, item.fps], [3840, 2160, 30]);
    assert.ok(Math.abs(item.measuredLUFS + 16) < 1);
    assert.ok(item.measuredTruePeakDB < 0);
    assert.ok(item.minSceneSSIM > .99, item.key + ': encoded scene differs from reviewed source');
    const media = item.key.startsWith('v2-')
      ? json('content/v2-media.json')[item.key.slice(3)]
      : json('content/' + item.key + '-media.json');
    assert.deepEqual(media.speech.skill, production.skill);
    assert.deepEqual(media.speech.engine.sha256, production.modelSha256);
    assert.deepEqual([media.speech.voice, media.speech.speed, media.speech.engine.backend], ['af_heart', 1, 'onnx']);
    assert.equal(media.cues.length, item.cueCount);
    for (const cue of media.cues) assert.equal(screenedText.get(item.key + '__' + cue.id), cue.text, item.key + ': changed or unscreened cue');
    cues += media.cues.length;
  }
  assert.equal(cues, screen.scenes.length);
});
