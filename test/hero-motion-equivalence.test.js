import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as motion from '../src/components/heroScrollProgress.js';

function snapshot(api) {
 const result = [];
 for (const stageHeight of [160, 247, 317, 370, 386, 680, 812, 951]) {
  for (const kinds of [['hero','hero','hero'], ['hero','strip','hero','strip','hero'], ['hero','strip','hero'], ['hero','strip']]) {
   const slides = kinds.map((kind,index) => ({kind, ...(kind === 'strip' ? {height: 140 + index * 17} : {})}));
   const geometry = api.stageGeometry(slides, stageHeight);
   const locals = [-5,0,0.01,...geometry.offsets.flatMap(offset => [offset-0.5,offset,offset+0.5,offset+stageHeight*.4,offset+stageHeight*.4001]),geometry.span+300];
   for (const mode of ['down','up']) for (const pinHeight of [stageHeight, Math.max(stageHeight,740)]) for (const local of locals) {
    const motion = api.heroStageMotion({slides,local,stageHeight,mode});
    result.push([api.stageSlidePos(slides,local,stageHeight),motion,api.stageReleaseBox(slides,stageHeight,pinHeight,local,mode)]);
   }
  }
 }
 return result;
}

test('approved motion snapshots remain unchanged across sizes, holds, release and both directions', () => {
 // Captured from the approved pre-optimization implementation at 3f620a7.
 assert.equal(createHash('sha256').update(JSON.stringify(snapshot(motion))).digest('hex'), '3107997d61a31c0991a9275efbc76e6545a6e8135d023d28e921c91dd187f195');
});

test('cached geometry and a shared pose produce exactly the same outputs', () => {
 const slides = [{kind:'hero'}, {kind:'strip',height:317}, {kind:'hero'}, {kind:'strip',height:241}, {kind:'hero'}];
 for (const stageHeight of [160,247,370,680,812]) {
  const geometry = motion.stageGeometry(slides,stageHeight);
  for (let local=0;local<=geometry.span+100;local+=17) for (const mode of ['up','down']) {
   const pose=motion.heroStageMotion({slides,local,stageHeight,mode,geometry});
   assert.deepEqual(pose,motion.heroStageMotion({slides,local,stageHeight,mode}));
   assert.equal(motion.stageSlidePos(slides,local,stageHeight,geometry),motion.stageSlidePos(slides,local,stageHeight));
   assert.deepEqual(motion.stageReleaseBox(slides,stageHeight,740,local,mode,geometry,pose),motion.stageReleaseBox(slides,stageHeight,740,local,mode));
  }
 }
});
