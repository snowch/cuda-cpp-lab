// Copyright © 2026 Christopher Snow.
import first from '../content/first-kernel-scenes.json' with {type:'json'};
import second from '../content/one-thread-one-element-scenes.json' with {type:'json'};
import {renderIntroDeck,renderArchitectureFrame} from './focused-intro-recording-deck.mjs';
export {introExample,introPrediction} from './focused-intro-recording-deck.mjs';
export const introScenes={'first-kernel':first,'one-thread-one-element':second};
export const architectureFrame=renderArchitectureFrame;
export function introDeck(slug,scenes=introScenes[slug],scale=1){return renderIntroDeck(slug,scenes,scale);}
