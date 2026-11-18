// Copyright © 2026 Christopher Snow.
import { introDeck, introScenes } from './intro-recording-deck.mjs';
import { writeRecordingDeck } from './recording-deck.mjs';
await writeRecordingDeck(process.argv[2] || 'test-results/first-kernel-recording',
  introDeck('first-kernel'), introScenes['first-kernel']);
