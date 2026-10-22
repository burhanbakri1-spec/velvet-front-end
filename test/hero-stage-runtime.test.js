import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import * as math from '../src/components/heroScrollProgress.js';

function mount(width = 375, reduced = false) {
  let y = 0, top = 1000, stripHeight = 240, reads = 0, writes = 0, rafId = 0;
  const frames = new Map(), listeners = new Map(), cleanups = [], observers = [];
  const classes = () => { const values = new Set(); return { contains: key => values.has(key), add: key => values.add(key), remove: key => values.delete(key), toggle(key,on) { if (on) values.add(key); else values.delete(key); } }; };
  const element = () => {
    const values = {}, attributes = new Map();
    return { classList: classes(), style: new Proxy({ getPropertyValue: key => values[key] || '', setProperty(key,value) { writes++; values[key]=value; }, removeProperty(key) { writes++; delete values[key]; } }, { get(target,key) { return key in target ? target[key] : values[key] || ''; }, set(target,key,value) { writes++; values[key]=value; return true; } }),
      setAttribute(key,value) { writes++; attributes.set(key,value); }, hasAttribute: key => attributes.has(key), removeAttribute(key) { attributes.delete(key); } };
  };
  const root=element(), shell=element(), stage=element(), hero=element(), strip=element(), section=element(), parent=element();
  Object.defineProperty(strip,'offsetHeight',{get(){reads++; return stripHeight;}});
  shell.getBoundingClientRect = () => { reads++; return {top:top-y}; };
  root.parentElement=parent;
  root.querySelector = selector => selector === '.hero-stage-shell' ? shell : selector === '.hero-stage' ? stage : null;
  section.querySelector = selector => selector === ':scope > .brand-showcase' ? hero : strip;
  stage.querySelectorAll = () => [section];
  stage.addEventListener=()=>{}; stage.removeEventListener=()=>{};
  const context = {
    ...math,
    useRef: current => ({current}),
    useLayoutEffect(effect) { const cleanup=effect(); if(cleanup) cleanups.push(cleanup); },
    document: { getElementById: () => root, documentElement: {}, body:{classList:classes()} },
    getComputedStyle: () => ({getPropertyValue:()=> '72px'}),
    ResizeObserver: class { constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);} observe(){} unobserve(){} disconnect(){this.disconnected=true;} },
    MutationObserver: class { observe(){} disconnect(){} },
    window: { innerWidth:width,innerHeight:812,get scrollY(){return y;},
      matchMedia: query => ({matches:query.includes('reduce') ? reduced : width>=1101,addEventListener(){},removeEventListener(){}}),
      requestAnimationFrame(callback){frames.set(++rafId,callback);return rafId;},cancelAnimationFrame(id){frames.delete(id);},
      addEventListener(name,callback){listeners.set(name,callback);},removeEventListener(name){listeners.delete(name);},
    },
  };
  const source=fs.readFileSync(new URL('../src/components/useHeroStageMotion.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function useHeroStageMotion','function useHeroStageMotion');
  vm.runInNewContext(source+"\nuseHeroStageMotion('showcases',true);",context);
  const flush=()=>{const current=[...frames.values()];frames.clear();current.forEach(callback=>callback());};
  return { root,shell,stage,strip,hero,frames,listeners,
    get reads(){return reads;},get writes(){return writes;},
    scroll(next){y=next;listeners.get('scroll')?.();},flush,
    parentResize(){observers[0].callback([{target:parent}]);},
    stripResize(next){stripHeight=next;observers[0].callback([{target:strip,borderBoxSize:[{blockSize:next}]}]);},
    moveShell(next){top=next;observers[0].callback([{target:parent}]);},
    dispose(){cleanups.forEach(fn=>fn());},observers,
  };
}

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
