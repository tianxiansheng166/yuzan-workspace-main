import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
async function buildHtml(){
  let html=await readFile('index.html','utf8'); let css=await readFile('styles.css','utf8'); let js=await readFile('app.js','utf8');
  const assets=['logo-symbol.png','sidebar-mountain.jpg','header-ridge.jpg','path-landscape.jpg','book-valley.png','learning-tree.png','teacher-book.png','network-valley.png'];
  for(const name of assets){const buf=await readFile(`assets/${name}`); const ext=extname(name).slice(1).replace('jpg','jpeg'); const uri=`data:image/${ext};base64,${buf.toString('base64')}`; html=html.split(`assets/${name}`).join(uri);css=css.split(`assets/${name}`).join(uri);js=js.split(`assets/${name}`).join(uri)}
  return html.replace('<link rel="stylesheet" href="styles.css" />',`<style>${css}</style>`).replace('<script src="app.js"></script>',`<script>${js}</script>`);
}
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const html=await buildHtml();
const results=[];
for(const [name,width,height] of [['desktop',1672,941],['tablet',768,1024],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height}}); await page.setContent(html,{waitUntil:'load'}); await page.waitForTimeout(250);
  await page.screenshot({path:`qa/${name}.png`,fullPage:true});
  const bodyWidth=await page.evaluate(()=>document.documentElement.scrollWidth); results.push({name,width,height,scrollWidth:bodyWidth,horizontalOverflow:bodyWidth>width+1});
  if(name==='desktop'){
    await page.click('#rulesBtn'); results[0].modalOpened=await page.locator('#rulesModal').evaluate(el=>el.classList.contains('show'));
    await page.keyboard.press('Escape'); await page.click('#continueMain'); results[0].toastShown=await page.locator('#toast').evaluate(el=>el.classList.contains('show'));
  }
  await page.close();
}
await browser.close(); await writeFile('qa/browser-check.json',JSON.stringify(results,null,2)); console.log(results);
