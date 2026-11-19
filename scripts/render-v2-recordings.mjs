// Copyright © 2026 Christopher Snow.
// Prepare lesson-specific recording frames from the visible starter bridges.
import { mkdir, writeFile } from 'node:fs/promises';
import { v2CoreCourse as v2Course } from '../content/v2-course.mjs';
import { lessonContexts } from '../content/v2-lesson-context.mjs';
import { introDeck, introScenes } from './intro-recording-deck.mjs';
import {plans} from './architecture-recording-stories.mjs';
import {renderArchitectureDeck} from './architecture-recording-design.mjs';
const inputs = [];
for (const [index, lesson] of v2Course.entries()) {
  if (!lessonContexts[lesson.slug]) continue;
  if (introScenes[lesson.slug]) {
    inputs.push({slug:lesson.slug, title:lesson.title, scenes:introScenes[lesson.slug].map(scene => ({
      ...scene, text:scene.captions.join(' '), html:introDeck(lesson.slug,[scene],1.25),
    }))});
    continue;
  }
  const plan=plans.find(plan=>plan.slug===lesson.slug);
  if(plan){
    inputs.push({slug:lesson.slug,title:lesson.title,
      learning:{title:plan.title,outcome:plan.outcome,scope:plan.scope},
      scenes:plan.scenes.map(scene=>({...scene,text:scene.captions.join(' '),html:renderArchitectureDeck(plan,[scene],1.25)}))});
    continue;
  }
  throw new Error('Author an architecture walkthrough for the current lesson: '+lesson.slug);

}
await mkdir('test-results/v2-recordings', {recursive:true});
await writeFile('test-results/v2-recordings/inputs.json', JSON.stringify(inputs));
