import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as math from '../src/components/heroScrollProgress.js';

function mount(width = 375, reduced = false, heroCount = 1, homeDeck = false) {
  let y = 0, top = 1000, stripHeight = 240, reads = 0, writes = 0, rafId = 0, viewportHeight = 812;
  const frames = new Map(), listeners = new Map(), cleanups = [], observers = [], motionInputs = [];
  const classes = () => { const values = new Set(); return { contains: key => values.has(key), add: key => values.add(key), remove: key => values.delete(key), toggle(key,on) { if (on) values.add(key); else values.delete(key); } }; };
  const element = () => {
    const values = {}, attributes = new Map();
    return { classList: classes(), style: new Proxy({ getPropertyValue: key => values[key] || '', setProperty(key,value) { writes++; values[key]=value; }, removeProperty(key) { writes++; delete values[key]; } }, { get(target,key) { return key in target ? target[key] : values[key] || ''; }, set(target,key,value) { writes++; values[key]=value; return true; } }),
      setAttribute(key,value) { writes++; attributes.set(key,value); }, hasAttribute: key => attributes.has(key), removeAttribute(key) { attributes.delete(key); } };
  };
  const root=element(), shell=element(), stage=element(), hero=element(), strip=element(), section=element(), parent=element();
  if (homeDeck) root.setAttribute('data-home-brand-deck', '');
  const probe=element();let smallViewportHeight=812,probeRemoved=false;
  probe.getBoundingClientRect=()=>{reads++;return {height:smallViewportHeight};};
  probe.remove=()=>{probeRemoved=true;};root.appendChild=()=>{};
  Object.defineProperty(strip,'offsetHeight',{get(){reads++; return stripHeight;}});
  shell.getBoundingClientRect = () => { reads++; return {top:top-y}; };
  root.parentElement=parent;
  root.querySelector = selector => selector === '.hero-stage-shell' ? shell : selector === '.hero-stage' ? stage : null;
  section.querySelector = selector => selector === ':scope > .home-brand__banner-layer > .brand-showcase' ? hero : strip;
  const sections=[section];
  for(let index=1;index<heroCount;index++) {
    const nextSection=element(),nextHero=element(),nextStrip=element();
    Object.defineProperty(nextStrip,'offsetHeight',{get(){reads++;return stripHeight;}});
    nextSection.querySelector=selector=>selector===':scope > .home-brand__banner-layer > .brand-showcase'?nextHero:nextStrip;
    sections.push(nextSection);
  }
  stage.querySelectorAll = () => sections;
  stage.addEventListener=()=>{}; stage.removeEventListener=()=>{};
  const context = {
    ...math,
    heroStageMotion(input) { if (input.motionPurpose !== 'handoff-reference') motionInputs.push(input); return math.heroStageMotion(input); },
    useRef: current => ({current}),
    useLayoutEffect(effect) { const cleanup=effect(); if(cleanup) cleanups.push(cleanup); },
    document: { getElementById: () => root, createElement:()=>probe, documentElement: {}, body:{classList:classes()} },
    getComputedStyle: () => ({getPropertyValue:()=> '72px'}),
    ResizeObserver: class { constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);} observe(){} unobserve(){} disconnect(){this.disconnected=true;} },
    MutationObserver: class { observe(){} disconnect(){} },
    window: { innerWidth:width,get innerHeight(){return viewportHeight;},get scrollY(){return y;},
      matchMedia: query => ({matches:query.includes('reduce') ? reduced : width>=1101,addEventListener(){},removeEventListener(){}}),
      requestAnimationFrame(callback){frames.set(++rafId,callback);return rafId;},cancelAnimationFrame(id){frames.delete(id);},
      addEventListener(name,callback){listeners.set(name,callback);},removeEventListener(name){listeners.delete(name);},
    },
  };
  const source=fs.readFileSync(new URL('../src/components/useHeroStageMotion.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function useHeroStageMotion','function useHeroStageMotion');
  vm.runInNewContext(source+"\nuseHeroStageMotion('showcases',true);",context);
  const flush=()=>{const current=[...frames.values()];frames.clear();current.forEach(callback=>callback());};
  return { root,shell,stage,strip,hero,sections,frames,listeners,motionInputs,
    get probeRemoved(){return probeRemoved;},
    resize(height,smallHeight=smallViewportHeight){viewportHeight=height;smallViewportHeight=smallHeight;listeners.get('resize')?.();},
    get reads(){return reads;},get writes(){return writes;},
    scroll(next){y=next;listeners.get('scroll')?.();},flush,
    parentResize(){observers[0].callback([{target:parent}]);},
    stripResize(next){stripHeight=next;observers[0].callback([{target:strip,borderBoxSize:[{blockSize:next}]}]);},
    moveShell(next){top=next;observers[0].callback([{target:parent}]);},
    dispose(){cleanups.forEach(fn=>fn());},observers,
  };
}

test('mobile Home reverse keeps card dimensions fixed and reveals Baby behind the outgoing card', () => {
 const home=mount(390,false,4,true);
 home.scroll(1750);home.flush();
 for(let y=1700;y>=1450&&!home.root.hasAttribute('data-mobile-hero-up');y-=50){home.scroll(y);home.flush();}
 assert.equal(home.root.hasAttribute('data-mobile-hero-up'),true,'direction state still records native upward input');
 assert.equal(home.sections.filter(section=>section.hasAttribute('data-active')).length,1);
 home.scroll(1450);home.flush();
 const previous = home.sections[0].querySelector(':scope > .home-brand__banner-layer > .brand-showcase');
 const previousY=Number.parseFloat(previous.style.transform.split(',')[1]);
 const previousClipTop=Number.parseFloat(previous.style.clipPath.match(/inset\((\d+(?:\.\d+)?)px/)[1]);
 assert.equal(previousY+previousClipTop,0,'Baby remains visually anchored at the first-banner boundary');
 assert.equal(previous.style.height,'370px','Baby keeps its measured card height throughout the reverse gesture');
 const outgoingY=Number.parseFloat(home.sections[1].querySelector(':scope > .home-brand__banner-layer > .brand-showcase').style.transform.split(',')[1]);
 assert.ok(outgoingY>0&&outgoingY<=370,'outgoing Kids moves within the fixed card lane');
 assert.equal(home.sections[0].querySelector(':scope > .home-brand__product-layer > .brand-strip').classList.contains('is-concealed'),true,'the destination strip stays out of the card transition');
 assert.equal(home.stage.style.height,'740px','the pinned scene height stays fixed through an in-flight brand transition');
 assert.equal(home.sections.filter(section=>section.hasAttribute('data-active')).length,1,'active brand marker moves instead of accumulating');
 home.dispose();
});

test('scroll events coalesce into one frame using the latest position without geometry reads', () => {
 const stage=mount(); const reads=stage.reads;
 stage.scroll(1100);stage.scroll(1200);stage.scroll(1150);
 assert.equal(stage.frames.size,1);
 stage.flush();
 assert.equal(stage.reads,reads);
 const writes=stage.writes;
 stage.scroll(1150);stage.flush();
 assert.equal(stage.writes,writes,'unchanged input must not rewrite the pose');
 stage.dispose();
});

test('release-induced parent resize is ignored, but real geometry changes invalidate the cache', () => {
 const stage=mount();
 stage.parentResize();
 assert.equal(stage.frames.size,0,'own release height does not require measuring every strip again');
 stage.stripResize(300);
 assert.equal(stage.frames.size,1);
 const reads=stage.reads;stage.flush();assert.ok(stage.reads>reads);
 stage.moveShell(1050);
 assert.equal(stage.frames.size,1);stage.flush();
 stage.dispose();
});

test('pending frames/listeners/observers are cleaned up and reduced motion stays cleared', () => {
 const stage=mount();stage.scroll(1500);assert.equal(stage.frames.size,1);stage.dispose();
 assert.equal(stage.frames.size,0);assert.equal(stage.listeners.size,0);assert.ok(stage.observers[0].disconnected);
 const reduced=mount(390,true);
 assert.equal(reduced.root.hasAttribute('data-hero-motion'),false);
 assert.equal(reduced.hero.style.willChange,'');
 reduced.stripResize(300);reduced.flush();assert.equal(reduced.hero.style.willChange,'');
 reduced.dispose();
});


test('parked slides do not rewrite CSS during different scroll positions before the stage', () => {
 const stage=mount();
 stage.scroll(500);stage.flush();
 const writes=stage.writes;
 stage.scroll(600);stage.flush();
 assert.equal(stage.writes,writes);
 stage.dispose();
});

test('only the existing mobile breakpoint opts into the bounded UP deck', () => {
 const mobile=mount(1100);
 assert.equal(mobile.motionInputs[0].upDeckDepth,8);
 mobile.dispose();
 const desktop=mount(1101);
 assert.equal(desktop.motionInputs[0].upDeckDepth,undefined);
 desktop.dispose();
});

test('mobile UP changes the local shell length while DOWN and desktop keep the original property', () => {
 for(const width of [390,1440]) {
  const stage=mount(width,false,12);
  const h=width<1101?370:740;
  const slides=Array.from({length:24},(_,i)=>i%2?{kind:'strip',height:240}:{kind:'hero'});
  const geometry=math.stageGeometry(slides,h),boundary=928+geometry.offsets[22];
  stage.scroll(boundary);stage.flush();
  const downSpan=stage.shell.style.getPropertyValue('--hero-stage-span');
  stage.scroll(boundary-50);stage.flush();
  if(width<1101) {
   assert.equal(stage.root.hasAttribute('data-mobile-hero-up'),true);
   assert.ok(stage.shell.style.getPropertyValue('--mobile-up-stage-span'));
   assert.equal(stage.shell.style.getPropertyValue('--hero-stage-span'),downSpan);
  } else {
   assert.equal(stage.root.hasAttribute('data-mobile-hero-up'),false);
   assert.equal(stage.shell.style.getPropertyValue('--mobile-up-stage-span'),'');
  }
  stage.scroll(boundary+10);stage.flush();
  assert.equal(stage.root.hasAttribute('data-mobile-hero-up'),false);
  const local=boundary+10-928;
  const expected=math.stageReleaseBox(slides,h,width<1101?740:h,local,'down',geometry);
  assert.equal(stage.shell.style.getPropertyValue('--hero-stage-span'),`${expected.shellHeight}px`);
  stage.dispose();
  assert.equal(stage.shell.style.getPropertyValue('--mobile-up-stage-span'),'');
 }
});

test('mobile UP starts from the DOWN layout and restores it over scroll distance', () => {
 const width=390,h=370,pin=740,stage=mount(width,false,12);
 const slides=Array.from({length:24},(_,i)=>i%2?{kind:'strip',height:240}:{kind:'hero'});
 const geometry=math.stageGeometry(slides,h),base=928+geometry.offsets[22];
 const assertLayoutAt=(y)=>{
  const local=y-928;
  const down=math.stageReleaseBox(slides,h,pin,local,'down',geometry);
  const expected=math.restoreMobileUpLayout(down,{local:geometry.offsets[22],shellHeight:math.stageReleaseBox(slides,h,pin,geometry.offsets[22],'down',geometry).shellHeight,boxHeight:math.stageReleaseBox(slides,h,pin,geometry.offsets[22],'down',geometry).boxHeight},local,pin);
  assert.equal(stage.root.hasAttribute('data-mobile-hero-up'),true);
  assert.equal(stage.shell.style.getPropertyValue('--mobile-up-stage-span'),`${expected.shellHeight}px`);
  assert.equal(stage.stage.style.height,`${expected.boxHeight}px`);
 };

 // DOWN's existing layout is unchanged at the reversal boundary.
 stage.scroll(base);stage.flush();
 const down=math.stageReleaseBox(slides,h,pin,geometry.offsets[22],'down',geometry);
 assert.equal(stage.shell.style.getPropertyValue('--hero-stage-span'),`${down.shellHeight}px`);
 assert.equal(stage.stage.style.height,`${down.boxHeight}px`);

 // Crossing into UP and subsequent small reverse inputs cannot make the
 // layout box follow the changing number of visible deck slices.
 for(const retreat of [50,130,210,290,370]){
  stage.scroll(base-retreat);stage.flush();assertLayoutAt(base-retreat);
 }
 stage.dispose();
});

test('mobile wheel-up restores released page geometry without a terminal jump', () => {
 const width=390,h=370,pin=740,stage=mount(width,false,12);
 const slides=Array.from({length:24},(_,i)=>i%2?{kind:'strip',height:240}:{kind:'hero'});
 const geometry=math.stageGeometry(slides,h),start=928+geometry.span-50;
 stage.scroll(start);stage.flush();
 const before=math.stageReleaseBox(slides,h,pin,geometry.span-50,'down',geometry);
 const anchor={local:geometry.span-50,shellHeight:before.shellHeight,boxHeight:before.boxHeight};
 const results=[];
 for(const retreat of [120,240,360,480]){
  const local=geometry.span-50-retreat;
  const release=math.stageReleaseBox(slides,h,pin,local,'down',geometry);
  const expected=math.restoreMobileUpLayout(release,anchor,local,pin);
  stage.scroll(928+local);stage.flush();
  const property=stage.root.hasAttribute('data-mobile-hero-up')?'--mobile-up-stage-span':'--hero-stage-span';
  results.push({shell:Number.parseFloat(stage.shell.style.getPropertyValue(property)),box:Number.parseFloat(stage.stage.style.height),expected});
 }
 assert.ok(results.every(entry=>Math.abs(entry.shell-entry.expected.shellHeight)<=1&&Math.abs(entry.box-entry.expected.boxHeight)<=1));
 assert.ok(results.every((entry,index)=>index===0||entry.shell-results[index-1].shell<140),'restoring shell height must track the 120px scroll input without a terminal jump');
 stage.dispose();
});

test('mobile UP restores the sticky viewport at the remaining released-height distance', () => {
 const pin=756,release={span:5447,shellHeight:5817,boxHeight:386};
 const anchor={local:5447,shellHeight:5817,boxHeight:386};
 const atStart=math.restoreMobileUpLayout(release,anchor,anchor.local,pin);
 assert.equal(atStart.boxHeight,anchor.boxHeight);
 assert.equal(atStart.shellHeight,anchor.shellHeight);

 for(const retreat of [60,120,240,369]){
  const restored=math.restoreMobileUpLayout(release,anchor,anchor.local-retreat,pin);
  const progress=retreat/386;
  assert.equal(restored.boxHeight,Math.round(anchor.boxHeight+(pin-anchor.boxHeight)*progress));
  assert.equal(restored.shellHeight,Math.round(anchor.shellHeight+(release.span+pin-anchor.shellHeight)*progress));
 }

 const complete=math.restoreMobileUpLayout(release,anchor,anchor.local-386,pin);
 assert.equal(complete.boxHeight,pin);
 assert.equal(complete.shellHeight,release.span+pin);
});

test('mobile reverse layout remains stable while the direction latch is still DOWN', () => {
 const width=390,h=370,pin=740,stage=mount(width,false,12);
 const slides=Array.from({length:24},(_,i)=>i%2?{kind:'strip',height:240}:{kind:'hero'});
 const geometry=math.stageGeometry(slides,h);
 const y=928+geometry.offsets[21]+120;
 stage.scroll(y);stage.flush();
 assert.equal(stage.root.hasAttribute('data-mobile-hero-up'),false);

 stage.scroll(y-20);stage.flush();
 assert.equal(stage.root.hasAttribute('data-mobile-hero-up'),false,'the latch waits for the preceding hero boundary');
 const anchoredShell=stage.shell.style.getPropertyValue('--hero-stage-span');
 const anchoredBox=stage.stage.style.height;

 stage.scroll(y-20);stage.flush();
 assert.equal(stage.shell.style.getPropertyValue('--hero-stage-span'),anchoredShell,'the same-position follow-up frame must not revert the release interpolation');
 assert.equal(stage.stage.style.height,anchoredBox,'the sticky box must not jump when delta becomes zero');

 stage.scroll(y+10);stage.flush();
 assert.equal(stage.root.hasAttribute('data-mobile-hero-up'),false);
 const local=y+10-928;
 const expected=math.stageReleaseBox(slides,h,pin,local,'down',geometry);
 assert.equal(stage.shell.style.getPropertyValue('--hero-stage-span'),`${expected.shellHeight}px`,'DOWN layout is restored after the user reverses direction');
 stage.dispose();
});

test('Android toolbar resizing cannot remap a stationary mobile DOWN or UP pose', () => {
 for(const up of [false,true]) {
  const stage=mount(390,false,12),slides=Array.from({length:24},(_,i)=>i%2?{kind:'strip',height:240}:{kind:'hero'});
  const geometry=math.stageGeometry(slides,370),boundary=928+geometry.offsets[22];
  stage.scroll(boundary);stage.flush();
  stage.scroll(boundary+(up?-90:90));stage.flush();
  const before=stage.motionInputs.at(-1),beforePose=math.heroStageMotion(before),box=stage.stage.style.height;
  for(const height of [868,840,812,868,812]) {
   stage.resize(height);stage.flush();
   const after=stage.motionInputs.at(-1);
   assert.equal(after.stageHeight,370);
   assert.deepEqual(math.heroStageMotion(after),beforePose,'toolbar changes must not move a banner without scroll input');
   assert.equal(stage.stage.style.height,box);
  }
  assert.equal(stage.hero.style.height,'370px');
  stage.dispose();assert.equal(stage.probeRemoved,true);assert.equal(stage.hero.style.height,'');
 }
});

test('real small-viewport resizing still remeasures mobile geometry, while desktop uses innerHeight', () => {
 const mobile=mount(390);mobile.resize(915,915);mobile.flush();
 assert.equal(mobile.motionInputs.at(-1).stageHeight,422);
 assert.equal(mobile.hero.style.height,'422px','rendered height must match the rounded pose height');
 mobile.dispose();
 const desktop=mount(1440);desktop.resize(868,812);desktop.flush();
 assert.equal(desktop.motionInputs.at(-1).stageHeight,796);
 assert.equal(desktop.hero.style.height,'');desktop.dispose();
});
