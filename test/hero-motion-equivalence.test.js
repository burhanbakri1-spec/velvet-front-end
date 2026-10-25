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

test('stage snapshots retain the approved poses with only the down-scroll hold remapped', () => {
 assert.equal(createHash('sha256').update(JSON.stringify(snapshot(motion))).digest('hex'), 'ea2030b322a038085a00532e4a4828ed79045ebb5acbb296bee15645d6551b76');
});

test('down-stage endpoints and the multi-hero upward deck match the approved motion', () => {
 const result=[];
 for (const stageHeight of [160,247,317,370,386,680,812,951]) {
  for (const kinds of [['hero','hero','hero'],['hero','strip','hero','strip','hero'],['hero','strip','hero'],['hero','strip']]) {
   const slides=kinds.map((kind,index)=>({kind,...(kind==='strip'?{height:140+index*17}:{})}));
   const geometry=motion.stageGeometry(slides,stageHeight);
   for (const local of geometry.offsets) result.push(['boundary',stageHeight,kinds,local,motion.heroStageMotion({slides,local,stageHeight,mode:'down'})]);
   if (kinds.filter(kind=>kind==='hero').length>=2) for (let local=0;local<=geometry.span;local+=17) {
    result.push(['up',stageHeight,kinds,local,motion.heroStageMotion({slides,local,stageHeight,mode:'up'})]);
   }
  }
 }
 // Same hash produced by the pre-change mapping at HEAD:heroScrollProgress.js.
 assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'), '1922904b9470caa1307f646f87ca590adeae906d43f111004bf79c84b4d10075');
});

test('representative normalized progress poses preserve DOM-facing styles in both directions', () => {
 const result=[];
 for (const stageHeight of [370,812]) {
  const slides=[{kind:'hero'},{kind:'strip',height:220},{kind:'hero'},{kind:'strip',height:260},{kind:'hero'}];
  const geometry=motion.stageGeometry(slides,stageHeight);
  for (const mode of ['down','up']) for (const fraction of [0,.1,.25,.5,.75,.9,1]) {
   const poses=motion.heroStageMotion({slides,local:geometry.span*fraction,stageHeight,mode,geometry});
   result.push([stageHeight,mode,fraction,poses.map(p=>({
    transform:`translate3d(0, ${p.y}px, 0)`,
    clipPath:(p.clipTop||p.clipBottom)?`inset(${p.clipTop}px 0 ${p.clipBottom}px 0)`:'',
    opacity:'',visibility:'',concealed:Boolean(p.hidden),zIndex:String(p.z||1),
   }))]);
  }
 }
 assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'), '818163f077f508d377ebd43e829fff08cec45f2a9eb4c9933f1c6e010413771a');
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
