import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
function buildHtml(){
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  let css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  let js=fs.readFileSync(path.join(root,'app.js'),'utf8');
  for(const f of fs.readdirSync(path.join(root,'assets'))){
    if(!/\.(png|jpg|jpeg|webp)$/i.test(f)) continue;
    const ext=path.extname(f).slice(1).replace('jpg','jpeg');
    const data=`data:image/${ext};base64,${fs.readFileSync(path.join(root,'assets',f)).toString('base64')}`;
    html=html.split(`assets/${f}`).join(data); css=css.split(`assets/${f}`).join(data); js=js.split(`assets/${f}`).join(data);
  }
  return html.replace(/<link rel="stylesheet" href="styles\.css"\s*\/>/,`<style>${css}</style>`)
             .replace(/<script src="app\.js"><\/script>/,`<script>${js}<\/script>`);
}
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-web-security']});
const html=buildHtml();
const results=[];
for(const [name,width,height] of [['desktop',1659,948],['tablet',768,1024],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});
  await page.setContent(html,{waitUntil:'load'}); await page.waitForTimeout(250);
  await page.screenshot({path:path.join(root,'qa',`${name}.png`),fullPage:true});
  const overflow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight}));
  results.push({name,width,height,errors,overflow});
  await page.close();
}
const page=await browser.newPage({viewport:{width:1659,height:948}});
await page.setContent(html,{waitUntil:'load'});
const before=await page.locator('#queueCount').textContent();
await page.locator('[data-download="1"]').click();
const after=await page.locator('#queueCount').textContent();
await page.locator('#autoSync').click();
const auto=await page.locator('#autoSync').getAttribute('aria-checked');
await page.locator('[data-filter="pending"]').click();
const pendingRows=await page.locator('.local-row').count();
await page.locator('#cleanStorage').click();
const modalVisible=await page.locator('#modalBackdrop').isVisible();
results.push({interaction:{before,after,auto,pendingRows,modalVisible}});
await page.close(); await browser.close();
fs.writeFileSync(path.join(root,'qa','results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
