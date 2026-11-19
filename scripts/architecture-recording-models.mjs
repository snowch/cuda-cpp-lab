// Copyright © 2026 Christopher Snow.
// Numerical examples come from course models or the checked starter contracts.
import {v2Run} from '../src/v2-model.mjs';
import {simulateLoad} from '../src/model.mjs';
import {branchWarp,sharedBanks} from '../src/architecture.mjs';
import {smFrame} from '../src/sm-hardware-model.mjs';
import {reduceBlock,tiledMatmul,precisionMatmul} from '../src/ai-models.mjs';
import {histogram,scan,compaction,barrier,pipeline,routing} from '../src/parallel-models.mjs';
import {starterFor} from '../content/v2-lesson-context.mjs';

export const fp=n=>Number.isInteger(n)?n.toFixed(1):Number(n.toPrecision(5)).toString();
export function matrixExample(width=4,tile=2){
 const source=starterFor('matmul');
 for(const text of ['((i * 3 + i / width) % 11 - 5) * 0.25f','((i * 7 + i / width) % 13 - 6) * 0.25f'])
  if(!source.includes(text))throw Error('Review the changed matrix starter before rebuilding recordings.');
 const a=Array.from({length:width},(_,r)=>Array.from({length:width},(_,k)=>((3*(r*width+k)+r)%11-5)*.25));
 const b=Array.from({length:width},(_,k)=>Array.from({length:width},(_,c)=>((7*(k*width+c)+k)%13-6)*.25));
 const phases=[];let sums=Array.from({length:tile},()=>Array(tile).fill(0));
 for(let begin=0;begin<width;begin+=tile){
  const left=a.slice(0,tile).map(row=>row.slice(begin,begin+tile)),right=b.slice(begin,begin+tile).map(row=>row.slice(0,tile));
  sums=sums.map((row,r)=>row.map((old,c)=>left[r].reduce((sum,x,k)=>Math.fround(sum+Math.fround(x*right[k][c])),old)));
  phases.push({begin,left,right,sums:sums.map(row=>[...row])});
 }
 return {width,tile,a,b,phases,sums,loads:2*width*width*Math.ceil(width/tile),sharedBytes:2*tile*tile*4};
}
export function scalarAttention(tile=2){
 const source=starterFor('attention');
 if(!source.includes('{-2,-1,0,1,2,3,4,5}')||!source.includes('{1,2,3,4,5,6,7,8}'))throw Error('Review changed scalar attention inputs.');
 const keys=Array.from({length:8},(_,i)=>i-2),values=keys.map((_,i)=>i+1),trace=[];
 let maximum=keys[0],denominator=0,weighted=0;
 for(let begin=0;begin<keys.length;begin+=tile){
  const next=Math.max(maximum,...keys.slice(begin,begin+tile)),keep=Math.exp(maximum-next);
  denominator*=keep;weighted*=keep;
  for(let i=begin;i<begin+tile;i++){const weight=Math.exp(keys[i]-next);denominator+=weight;weighted+=weight*values[i];}
  maximum=next;trace.push({begin,maximum,denominator,weighted});
 }
 return {keys,values,tile,trace,result:weighted/denominator};
}
export function cacheExample(cached=4){
 const source=starterFor('inference');
 if(!source.includes('constexpr int width = 4;')||!source.includes('constexpr int capacity = 17;'))throw Error('Review changed KV-cache dimensions.');
 return {cached,width:4,capacity:17,bytesPerToken:2*4*4,readBytes:cached*2*4*4,appendBytes:2*4*4,laneSum:cached*2};
}
export function tensorExample(start=0){
 const source=starterFor('tensor-cores');
 if(!source.includes('16, 16, 16')||!source.includes('tile<<<1, 32>>>')||!source.includes('__float2half_rn(1.0f)'))throw Error('Review changed WMMA example.');
 return {width:16,warp:32,entries:16*16,start,result:Array(16).fill(1).reduce((s,x)=>s+x,start)};
}
export const examples={
 bounds:v2Run('bounds',4),boundsOther:v2Run('bounds',8),copies:v2Run('copies',5),copiesOther:v2Run('copies',9),
 adjacent:simulateLoad({stride:1}),strided:simulateLoad({stride:8}),
 sm:[...Array(9)].map((_,i)=>smFrame(i)),mixed:branchWarp({pattern:'alternating',negativeOps:1}),positive:branchWarp({pattern:'positive',negativeOps:1}),
 reduction:reduceBlock(),banks:sharedBanks({stride:32}),spread:sharedBanks({stride:33}),broadcast:sharedBanks({broadcast:true}),
 matrix:matrixExample(),precision:precisionMatmul(),exact:precisionMatmul({pattern:'exact'}),tensor:tensorExample(),tensorOther:tensorExample(5),
 attention:scalarAttention(),attentionOther:scalarAttention(4),cache:cacheExample(),cacheOther:cacheExample(8),
 smallTile:tiledMatmul({tile:2,sharedBudget:128}),largeTile:tiledMatmul({tile:4,sharedBudget:128}),moreShared:tiledMatmul({tile:4,sharedBudget:512}),
 histogram:histogram({strategy:'private'}),hotHistogram:histogram({distribution:'hot',strategy:'private'}),
 scan:scan({kind:'exclusive'}),compact:compaction({order:'reverse'}),barrier:barrier(),
 pipeline:pipeline({mode:'pipeline'}),routing:routing({goal:'group'}),
};

