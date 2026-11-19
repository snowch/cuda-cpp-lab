// Copyright © 2026 Christopher Snow.
import {mkdir,writeFile} from 'node:fs/promises';
import {escape} from '../src/continuation-ui.mjs';
export async function writeRecordingDeck(output,deck,scenes,speechText=text=>text){
 await mkdir(output,{recursive:true});await writeFile(`${output}/deck.html`,deck);
 await writeFile(`${output}/scenes.json`,JSON.stringify(scenes.flatMap(s=>s.captions.map((text,i)=>{
  const say=speechText(s.speech?.[i] ?? text).replace(/\bcuda\b/gi,'[CUDA](/ˈkuːdə/)').replace(/\bmatrix A\b/g,'matrix [A](/ˈeɪ/)');
  return {id:`${s.id}-c${i+1}`,step:s.title,text,...(say!==text?{say}:{})};
 })),null,2));
 console.log(`Rendered ${scenes.length} slides in ${output}`);
}
