import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage({viewport:{width:1672,height:941},deviceScaleFactor:1});
let html=await readFile('index.html','utf8');
let css=await readFile('styles.css','utf8');
let js=await readFile('app.js','utf8');
const assets=['logo-symbol.png','sidebar-mountain.jpg','header-ridge.jpg','path-landscape.jpg','book-valley.png','learning-tree.png','teacher-book.png','network-valley.png'];
for(const name of assets){
  const buf=await readFile(`assets/${name}`); const ext=extname(name).slice(1).replace('jpg','jpeg'); const uri=`data:image/${ext};base64,${buf.toString('base64')}`;
  html=html.split(`assets/${name}`).join(uri); css=css.split(`assets/${name}`).join(uri); js=js.split(`assets/${name}`).join(uri);
}
html=html.replace('<link rel="stylesheet" href="styles.css" />',`<style>${css}</style>`).replace('<script src="app.js"></script>',`<script>${js}</script>`);
await page.setContent(html,{waitUntil:'load'});
await page.waitForTimeout(700);
await page.screenshot({path:'qa/current.png',fullPage:true});
await browser.close();
