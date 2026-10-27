import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../src/components/Header.jsx',import.meta.url),'utf8');
const effect=source.match(/useEffect\(\(\) => \{\r?\n    scrollAnchor\.current = window\.scrollY;([\s\S]*?)\r?\n  \}, \[aboutOpen, brandsOpen, mobileOpen\]\);/);
assert.ok(effect,'header scroll effect is available');
function mount({mobile=true,y=0,locked=false,callout=false}={}) {
 const events=new Map(),states={hidden:true,compact:false},writes=[];let change,cleanup;
 const media={matches:mobile,addEventListener(name,fn){change=fn;},removeEventListener(){change=null;}};
 const context={TOP_OFFSET:80,SCROLL_DELTA:8,scrollAnchor:{current:0},footerCalloutUnderHeader:{current:callout},mobileOpen:locked,brandsOpen:false,aboutOpen:false,
  setHidden(value){states.hidden=value;writes.push(['hidden',value]);},setCompact(value){states.compact=value;writes.push(['compact',value]);},setBrandsOpen(){},setAboutOpen(){},closeMobile(){},
  window:{scrollY:y,matchMedia:()=>media,addEventListener(name,fn){events.set(name,fn);},removeEventListener(name){events.delete(name);}},
 };
 cleanup=vm.runInNewContext('(function(){scrollAnchor.current=window.scrollY;'+effect[1]+'})()',context);
 return {states,writes,scroll(y){context.window.scrollY=y;events.get('scroll')();},resize(mobile){media.matches=mobile;change();},dispose(){cleanup();assert.equal(events.size,0);assert.equal(change,null);}};
}

test('mobile main header stays visible and compact down, up, and across footer re-entry',()=>{
 const header=mount({y:1000,callout:true});
 for(const y of [1100,1800,1700,1200,5000,4500,900]) {header.scroll(y);assert.equal(header.states.hidden,false);assert.equal(header.states.compact,true);}
 assert.equal(header.writes.length,2,'steady mobile scroll must not keep writing React state');header.dispose();
});
test('mobile top and menu-open states retain the initial utility controls',()=>{
 const header=mount();assert.equal(header.states.hidden,false);assert.equal(header.states.compact,false);
 header.scroll(100);assert.equal(header.states.compact,true);header.scroll(0);assert.equal(header.states.compact,false);header.dispose();
 const menu=mount({y:1000,locked:true});assert.equal(menu.states.hidden,false);assert.equal(menu.states.compact,false);menu.dispose();
});
test('desktop hide/show and footer overlap behavior remain unchanged',()=>{
 const desktop=mount({mobile:false});desktop.scroll(500);assert.equal(desktop.states.hidden,true);desktop.scroll(400);assert.equal(desktop.states.hidden,false);assert.equal(desktop.states.compact,true);desktop.dispose();
 const footer=mount({mobile:false,callout:true});footer.scroll(500);footer.scroll(400);assert.equal(footer.states.hidden,true);footer.dispose();
});
test('entering mobile at a scrolled position restores the logo immediately and cleanup removes listeners',()=>{
 const header=mount({mobile:false,y:500});header.scroll(600);assert.equal(header.states.hidden,true);header.resize(true);assert.equal(header.states.hidden,false);assert.equal(header.states.compact,true);header.dispose();
});
