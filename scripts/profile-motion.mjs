/** Local-only audit harness. No production configuration or backend writes.
 * Run: node scripts/profile-motion.mjs [baseline|after]
 * Open http://127.0.0.1:5178/en and use the Profile scroll button.
 * Uses the public catalog read-only, caches it in memory, and stubs other API calls.
 */
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const label = process.argv[2] || 'baseline';
const apiUrl = 'https://api-staging.igroup.website';
const origin = 'https://mintcream-mink-816924.hostingersite.com';
const response = await fetch(`${apiUrl}/api/storefront/content?locale=en`, {
  headers: { 'X-Company-Id': 'kids-velvet', 'X-Site-Id': 'kids-velvet-storefront', Origin: origin },
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Public catalog GET failed: ${response.status}`);
const content = await response.json();
const directory = process.env.MOTION_REPORT_DIR || path.join(process.cwd(), 'motion-profile-results');
await mkdir(directory, { recursive: true });
const client = `
(() => {
 const nativeFetch = window.fetch.bind(window);
 window.fetch = (input, init = {}) => {
   const url = String(input);
   if (url.includes('/api/storefront/content')) return nativeFetch('/__motion/content');
   if (url.includes('/api/')) return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
   return nativeFetch(input, init);
 };
 let recording = false, reads = 0, styleWrites = 0, attributes = 0, readAfterWrite = 0, dirty = false;
 let counts = {}, commits = 0;
 window.__motionProfile = { count(key) { if (recording) counts[key] = (counts[key] || 0) + 1; }, commit() { if (recording) commits++; } };
 const rect = Element.prototype.getBoundingClientRect;
 Element.prototype.getBoundingClientRect = function(...args) { if (recording) { reads++; if (dirty) readAfterWrite++; } return rect.apply(this, args); };
 const computed = window.getComputedStyle;
 window.getComputedStyle = function(...args) { if (recording) { reads++; if (dirty) readAfterWrite++; } return computed.apply(this, args); };
 const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
 Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { ...height, get() { if (recording) { reads++; if (dirty) readAfterWrite++; } return height.get.call(this); } });
 for (const key of ['transform', 'clipPath', 'zIndex', 'height', 'top', 'willChange']) {
   const descriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, key);
   if (descriptor?.set) Object.defineProperty(CSSStyleDeclaration.prototype, key, { ...descriptor, set(value) { if (recording) { styleWrites++; dirty = true; } descriptor.set.call(this, value); } });
 }
 const setProperty = CSSStyleDeclaration.prototype.setProperty;
 CSSStyleDeclaration.prototype.setProperty = function(...args) { if (recording) { styleWrites++; dirty = true; } return setProperty.apply(this, args); };
 const setAttribute = Element.prototype.setAttribute;
 Element.prototype.setAttribute = function(...args) { if (recording) { attributes++; dirty = true; } return setAttribute.apply(this, args); };
 new MutationObserver(records => { if (recording) styleWrites += records.filter(record => record.attributeName === 'style').length; }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style'] });
 const next = () => new Promise(resolve => requestAnimationFrame(resolve));
 const round = value => Math.round(value * 100) / 100;
 const untilReady = async () => { while (!document.querySelector('.site-header') || document.documentElement.classList.contains('intro-active')) await next(); };
 const run = async () => {
  const button = document.getElementById('__motion_run'); button.disabled = true; button.textContent = 'Profiling…';
  await untilReady();
  const root = document.getElementById('showcases');
  const shell = root?.querySelector('.hero-stage-shell');
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 88;
  const stageStart = shell ? shell.getBoundingClientRect().top + scrollY - header : 0;
  const height = innerHeight - header;
  const limit = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const base = shell ? Math.min(limit(), stageStart + height * 2) : Math.min(limit() / 2, innerHeight);
  scrollTo({top:base,behavior:'instant'}); for (let i = 0; i < 12; i++) await next();
  counts = {}; commits = 0; reads = 0; styleWrites = 0; attributes = 0; readAfterWrite = 0;
  const frames = [], trace = []; let previous = performance.now();
  recording = true;
  const phase = async (name, offsets) => {
   for (const offset of offsets) {
    dirty = false;
    scrollTo({top:Math.max(0, Math.min(limit(), offset)),behavior:'instant'});
    await next(); await next();
    const now = performance.now(); frames.push(now - previous); previous = now;
    const stage = root?.querySelector('.hero-stage');
    trace.push({ name, y: round(scrollY), box: stage?.style.height || '', span: shell?.style.getPropertyValue('--hero-stage-span') || '',
      poses: stage ? [...stage.querySelectorAll(':scope > .home-brand > .brand-showcase, :scope > .home-brand > .brand-strip')].map(el => [el.style.transform, el.style.clipPath, el.style.zIndex, el.classList.contains('is-concealed')]) : [] });
   }
  };
  await phase('slow-down', Array.from({length: 8}, (_,i) => base + i * 12));
  await phase('slow-up', Array.from({length: 8}, (_,i) => base + (7-i) * 12));
  await phase('fast-down', Array.from({length: 6}, (_,i) => base + i * 160));
  await phase('fast-up', Array.from({length: 6}, (_,i) => base + (5-i) * 160));
  await phase('down-up', [base+320,base+640,base+960,base+640,base+320,base]);
  await phase('up-down', [base+960,base+640,base+320,base,base+320,base+640]);
  await phase('short-reversals', Array.from({length: 10}, (_,i) => base + (i % 2 ? 32 : 0)));
  if (shell) { const tail = stageStart + shell.offsetHeight - height; await phase('terminal-reversal', [tail-200,tail-100,tail,tail+100,tail,tail-100,tail-200,tail]); }
  recording = false;
  frames.sort((a,b)=>a-b);
  const cards = [...document.querySelectorAll('.shop-products .product-card')].slice(0,4).map(el=>({ x:round(el.getBoundingClientRect().x),y:round(el.getBoundingClientRect().y),width:round(el.getBoundingClientRect().width) }));
  const result = { label: ${JSON.stringify(label)}, route: location.pathname, width: innerWidth, height: innerHeight, counts, commits, reads, styleWrites, attributes, readAfterWrite,
    twoFrameStepP50:round(frames[Math.floor(frames.length*.5)]||0),twoFrameStepP95:round(frames[Math.floor(frames.length*.95)]||0),
    overflow:document.documentElement.scrollWidth>innerWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,cards,trace };
  await nativeFetch('/__motion/report', {method:'POST',body:JSON.stringify(result)});
  document.getElementById('__motion_output').textContent = JSON.stringify({...result,trace:result.trace.length});
  button.textContent = 'Profile scroll'; button.disabled = false;
 };
 window.addEventListener('DOMContentLoaded', () => {
  const panel=document.createElement('aside'); panel.style.cssText='position:fixed;bottom:0;left:0;z-index:999999;background:white;color:black;font:11px monospace;max-width:280px;max-height:100px;overflow:auto;contain:content';
  panel.innerHTML='<button id="__motion_run">Profile scroll</button><output id="__motion_output"></output>';
  document.body.appendChild(panel); document.getElementById('__motion_run').onclick=run;
 });
})();`;
Object.assign(process.env, { VITE_IGROUP_CONTENT_ENABLED: 'true', VITE_IGROUP_API_URL: apiUrl, VITE_IGROUP_COMPANY_ID: 'kids-velvet', VITE_IGROUP_SITE_ID: 'kids-velvet-storefront' });
const server = await createServer({
  root: process.cwd(), server: { host: '127.0.0.1', port: 5178, strictPort: true },
  define: { 'import.meta.env': JSON.stringify({ VITE_IGROUP_CONTENT_ENABLED: 'true', VITE_IGROUP_API_URL: apiUrl, VITE_IGROUP_COMPANY_ID: 'kids-velvet', VITE_IGROUP_SITE_ID: 'kids-velvet-storefront' }) },
  plugins: [{ name: 'local-motion-profile', enforce: 'pre',
    transformIndexHtml(html) { return html.replace('<head>', '<head><script>'+client+'</script>'); },
    transform(source, id) {
      if (id.endsWith('/useHeroStageMotion.js')) return source.replace('const measure = () => {', "const measure = () => { window.__motionProfile?.count('measure');").replace('const apply = () => {', "const apply = () => { window.__motionProfile?.count('apply');");
      if (id.endsWith('/heroScrollProgress.js')) return source.replace('export function stageGeometry(slides, stageHeight) {', "export function stageGeometry(slides, stageHeight) { window.__motionProfile?.count('geometry');");
      if (id.endsWith('/ProductCard.jsx')) return source.replace('export default function ProductCard({ product, onAddToCart, onSelect, active = false }) {', "export default function ProductCard({ product, onAddToCart, onSelect, active = false }) { window.__motionProfile?.count('productCardRender');");
      if (id.endsWith('/Header.jsx')) return source.replace('export default function Header({ introActive, solid = false }) {', "export default function Header({ introActive, solid = false }) { window.__motionProfile?.count('headerRender');").replace('const onScroll = () => {', "const onScroll = () => { window.__motionProfile?.count('headerScroll');");
      if (id.endsWith('/main.jsx')) return source.replaceAll('<React.StrictMode><App /></React.StrictMode>', '<React.Profiler id="store" onRender={() => window.__motionProfile?.commit()}><React.StrictMode><App /></React.StrictMode></React.Profiler>');
    },
    configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
      if (req.url === '/__motion/content') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(content)); }
      if (req.url === '/__motion/report') {
        let body=''; for await (const chunk of req) body+=chunk;
        const report=JSON.parse(body); const file=label+'-'+report.width+'x'+report.height+'-'+report.route.replaceAll('/','_')+'.json';
        await writeFile(path.join(directory,file),JSON.stringify(report)); res.end('ok'); return;
      }
      next();
    }); },
  }],
});
await server.listen();
console.log(`Motion profiler ready http://127.0.0.1:5178 (${label}); reports: ${directory}`);
