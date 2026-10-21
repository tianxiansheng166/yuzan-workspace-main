// VISUAL_FIXTURE_ONLY: local static server, synthetic API object, real unchanged product JS.
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, rm, mkdtemp} from 'node:fs/promises';
import {resolve, extname, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..'), front=resolve(root,'frontend');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fixture=await readFile(resolve(here,'visual-fixture.js'),'utf8');
const editable=new Set(['student/today/index.html','student/today/style.css','student/courses/index.html','student/courses/style.css','student/growth/index.html','student/growth/assets/growth-live.css']);
let phase='before';
const baseline=new Map([...editable].map(p=>[p,execFileSync('git',['show','03371f7287433dac7f09c99ff95729fb4c071652:frontend/'+p],{cwd:root})]));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'); let relative=decodeURIComponent(u.pathname).replace(/^\/+/, ''); if(relative.endsWith('/'))relative+='index.html';
 const file=resolve(front,relative);if(!file.startsWith(front+'/'))throw Error('path');
 let body=phase==='before'&&baseline.has(relative)?baseline.get(relative):await readFile(file);
 if(relative==='assets/api-client.js')body=Buffer.from(fixture);
 if(extname(relative)==='.html') body=Buffer.from(body.toString().replace('</body>','<aside style="position:fixed;bottom:4px;right:8px;z-index:99999;background:#192e50;color:white;padding:5px 9px;font:11px sans-serif;pointer-events:none">VISUAL_FIXTURE_ONLY · synthetic data</aside></body>'));
 res.writeHead(200,{'content-type':(mime[extname(relative)]||'application/octet-stream')+'; charset=utf-8','cache-control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('fixture: not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(resolve(here,'.chrome-'));
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
const wsUrl=await new Promise((resolveWs,reject)=>{let s='';chrome.stderr.on('data',d=>{s+=d;const m=s.match(/DevTools listening on (ws:\/\/\S+)/);if(m)resolveWs(m[1]);});chrome.on('error',reject);});
const socket=new WebSocket(wsUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();const errors=[];
socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result||{});}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
function cmd(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});}
let session;
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},session);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
const proof={classification:'VISUAL_FIXTURE_ONLY',base:'03371f7287433dac7f09c99ff95729fb4c071652',nativeE2E:'NOT_RUN',screenshots:[],checks:[]};
const viewports=[{width:390,height:844},{width:768,height:1024},{width:1280,height:900},{width:1440,height:1000}];
async function load(page,state='populated'){
 await cmd('Page.navigate',{url:url+'/student/'+page+'/?state='+state},session);
 for(let n=0;n<100;n++){if(await evaluate(`document.readyState==='complete' && (document.querySelector('#${page==='today'?'todayApp':page==='growth'?'growthApp':'coursePage'}')?.getAttribute('aria-busy') !== 'true') && !document.querySelector('.today-loading,.growth-loading') && ${page==='courses'?"(document.querySelector('#catalogLoading')?.hidden===true)":'true'}`))break;await delay(60);}
 await evaluate('document.fonts.ready');await evaluate(`Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{});} ))`);await delay(200);
}
async function screenshot(name,full=false){const metrics=await cmd('Page.getLayoutMetrics',{},session);const png=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,...full?{clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}}:{}},session);await writeFile(resolve(here,'screenshots',name),Buffer.from(png.data,'base64'));}
try{
 const target=await cmd('Target.createTarget',{url:'about:blank'});session=(await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
 await cmd('Page.enable',{},session);await cmd('Runtime.enable',{},session);await cmd('Network.enable',{},session);await cmd('Network.setCacheDisabled',{cacheDisabled:true},session);
 proof.browser=await cmd('Browser.getVersion');
 for(phase of ['before','after'])for(const v of viewports)for(const page of ['today','courses','growth']){
  await cmd('Emulation.setDeviceMetricsOverride',{...v,deviceScaleFactor:1,mobile:v.width===390},session);
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},session);
  await load(page);
  const m=await evaluate(`({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('main h1')?.innerText,ready:document.querySelector('main')?.dataset.state,hero:document.querySelector('.cc-hero')?.getBoundingClientRect().height,courses:document.querySelectorAll('.cc-card').length,chart:!!document.querySelector('.growth-chart-path'),links:[...document.querySelectorAll('main a[href]')].map(a=>a.getAttribute('href')),images:[...document.querySelectorAll('.cc-card-cover img')].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})),reducedAnimations:document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations===Infinity).length})`);
  const stem=phase+'-'+page+'-'+v.width+'x'+v.height;await screenshot(stem+'.png');await screenshot(stem+'-full.png',true);
  proof.screenshots.push({phase,page,...v,...m,file:stem+'.png',full:stem+'-full.png'});
  console.log(stem,JSON.stringify({overflow:m.scroll-m.client,hero:m.hero,chart:m.chart,courses:m.courses}));
  if(phase==='after'){
   assert.equal(m.scroll,m.client,stem+' horizontal overflow');assert.equal(m.reducedAnimations,0,stem+' reduced motion');
   const clipped=await evaluate(`Array.from(document.querySelectorAll('main h1,main h2,main h3,.cc-card-title,.today-record-title strong,.growth-timeline-heading strong')).filter(el=>{const s=getComputedStyle(el);return ['hidden','clip'].includes(s.overflowX)&&el.scrollWidth>el.clientWidth+1;}).map(el=>el.textContent)`);
   assert.deepEqual(clipped,[],stem+' clipped heading');
   if(page==='courses'){assert.equal(m.courses,12);assert.ok(m.hero>=150&&m.hero<=175);assert.ok(m.images.every(i=>i.loaded));assert.ok(m.links.includes('/student/courses/course-detail/?id=t098-visual-course-0&activityId=t098-visual-video-0'));}
   if(page==='growth'){assert.equal(m.chart,true);assert.ok(await evaluate(`document.querySelector('#growthApp').innerText.includes('0 分') && document.querySelector('#growthApp').innerText.includes('暂无正式得分')`),'Formal zero and null must remain distinct');}
  }
 }
 for(const v of viewports)for(const page of ['today','courses','growth']) {
  const before=proof.screenshots.find(s=>s.phase==='before'&&s.page===page&&s.width===v.width);
  const after=proof.screenshots.find(s=>s.phase==='after'&&s.page===page&&s.width===v.width);
  assert.deepEqual(after.links,before.links,'All rendered destinations preserved: '+page+' '+v.width);
  assert.deepEqual(after.images.map(i=>i.src),before.images.map(i=>i.src),'Existing cover selection preserved');
 }
 phase='after';
 // Exercise the existing catalog controls using the fixture; these are not API E2E checks.
 for(const v of viewports){
  await cmd('Emulation.setDeviceMetricsOverride',{...v,deviceScaleFactor:1,mobile:v.width===390},session);await load('courses');
  await evaluate(`document.querySelector('[data-view="list"]').click()`);await delay(100);
  const list=await evaluate(`({list:document.querySelector('#courseGrid').classList.contains('cc-grid--list'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth})`);assert.equal(list.list,true);assert.equal(list.overflow,0);
  await screenshot('after-courses-list-'+v.width+'x'+v.height+'.png',true);
  await evaluate(`document.querySelector('[data-view="grid"]').click();document.querySelector('[data-favorite]').click()`);await delay(100);assert.equal(await evaluate(`document.querySelector('[data-favorite]').getAttribute('aria-pressed')`),'true');
  await evaluate(`document.querySelector('#loadMoreBtn').click()`);await delay(150);assert.equal(await evaluate(`document.querySelectorAll('.cc-card').length`),13);
  await evaluate(`document.querySelector('#searchInput').value='古诗';document.querySelector('#searchForm').requestSubmit()`);await delay(150);assert.equal(await evaluate(`document.querySelectorAll('.cc-card').length`),2);
  await evaluate(`document.querySelector('#clearAllFilters').click()`);await delay(150);assert.equal(await evaluate(`document.querySelectorAll('.cc-card').length`),12);
  await evaluate(`document.querySelector('#gradeFilter').value='JUNIOR';document.querySelector('#gradeFilter').dispatchEvent(new Event('change',{bubbles:true}));`);await delay(150);
  await evaluate(`document.querySelector('#categoryFilter').value='CLASSICS';document.querySelector('#categoryFilter').dispatchEvent(new Event('change',{bubbles:true}));`);await delay(150);
  assert.ok(await evaluate(`window.__visualCalls.some(x=>x.filters?.capabilityTheme==='CLASSICS')`));
  await evaluate(`document.querySelector('#sortSelect').value='popularity';document.querySelector('#sortSelect').dispatchEvent(new Event('change',{bubbles:true}));`);await delay(150);assert.ok(await evaluate(`window.__visualCalls.some(x=>x.filters?.sortBy==='popularity')`));
  proof.checks.push({viewport:v,catalog:'list/grid,favorite,load more 12→13,search,clear,grade,category,sort PASS'});
 }
 for(const page of ['today','courses','growth'])for(const state of ['empty','error']){
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);await load(page,state);await screenshot('after-'+page+'-'+state+'-390.png',true);
  assert.equal(await evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth'),0);
  proof.checks.push({page,state,overflow:0});
 }
 for(const page of ['today','courses','growth']){
  await load(page);await evaluate('document.activeElement?.blur()');await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);
  const f=await evaluate(`({tag:document.activeElement.tagName,focus:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle})`);assert.equal(f.focus,true);assert.notEqual(f.outline,'none');proof.checks.push({page,keyboard:f});await screenshot('after-'+page+'-keyboard-390.png');
 }
 for(const page of ['today','courses']) {
  await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},session);
  await cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]},session);
  await load(page);
  const selector=page==='today'?'.today-primary-side':'.cc-hero-overlay';
  const motion=await evaluate(`({animations:document.getAnimations().filter(a=>a.playState==='running').length,pointerEvents:getComputedStyle(document.querySelector('${selector}'),'::before').pointerEvents})`);
  assert.ok(motion.animations>0);assert.equal(motion.pointerEvents,'none');proof.checks.push({page,decorativeMotion:motion});
  await screenshot('after-'+page+'-motion-1440.png');
 }
 proof.exceptions=errors;assert.equal(errors.length,0,'Browser script exceptions');
}finally{
 await writeFile(resolve(here,'browser-proof.json'),JSON.stringify(proof,null,2)+'\n');
 await cmd('Browser.close').catch(()=>{});socket.close();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
 await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});
}
console.log('VISUAL_FIXTURE_ONLY capture and checks PASS');
