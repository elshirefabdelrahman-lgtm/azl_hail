import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const errors = [];
const reports = [];
async function walk(dir) {
  const items = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const item of items) {
    if (['backup', '.git'].includes(item.name)) continue;
    const full = resolve(dir, item.name);
    if (item.isDirectory()) found.push(...await walk(full)); else found.push(full);
  }
  return found;
}
const files = await walk(root);
const htmlFiles = files.filter(file => extname(file) === '.html');
const pageTitles = new Set();
const canonicals = new Set();
let imageCount = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const rel = file.slice(root.length + 1).replaceAll('\\','/');
  const errorsBefore = errors.length;
  if (!/<html lang="ar" dir="rtl">/.test(html)) errors.push(`${rel}: missing Arabic RTL root`);
  const titles = [...html.matchAll(/<title>(.*?)<\/title>/gs)].map(m => m[1]);
  if (titles.length !== 1 || !titles[0]) errors.push(`${rel}: expected one page title`);
  else if (rel !== '404.html' && pageTitles.has(titles[0])) errors.push(`${rel}: duplicate title ${titles[0]}`);
  else pageTitles.add(titles[0]);
  if ([...html.matchAll(/<h1\b/g)].length !== 1) errors.push(`${rel}: expected exactly one H1`);
  const description = html.match(/<meta name="description" content="([^"]+)"/);
  if (!description?.[1]) errors.push(`${rel}: missing meta description`);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!canonical?.[1]) errors.push(`${rel}: missing canonical`);
  else if (canonicals.has(canonical[1])) errors.push(`${rel}: duplicate canonical ${canonical[1]}`);
  else canonicals.add(canonical[1]);
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { JSON.parse(match[1]); } catch { errors.push(`${rel}: invalid JSON-LD`); }
  }
  for (const match of html.matchAll(/<(?:img|source)\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) {
    const src = match[1];
    if (src.startsWith('http') || src.startsWith('data:')) continue;
    const target = resolve(root, '.' + decodeURIComponent(src));
    try { await stat(target); if (src.includes('/assets/images/')) imageCount++; }
    catch { errors.push(`${rel}: missing image or source ${src}`); }
  }
  for (const match of html.matchAll(/<img\b([^>]*)>/g)) if (!/\balt="[^"]*"/.test(match[1])) errors.push(`${rel}: image is missing alt text`);
  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const href = match[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const pathname = decodeURIComponent(href.split(/[?#]/)[0]);
    if (pathname === '/') continue;
    let target = resolve(root, '.' + pathname);
    try {
      const info = await stat(target);
      if (info.isDirectory()) target = resolve(target, 'index.html');
      await stat(target);
    } catch { errors.push(`${rel}: missing local link target ${href}`); }
  }
  const phoneLinks = [...html.matchAll(/href="tel:([^"]+)"/g)].map(m => m[1]);
  if (rel !== '404.html' && !phoneLinks.includes('+966575034282')) errors.push(`${rel}: missing direct phone link`);
  if (!html.includes('wa.me/966575034282')) errors.push(`${rel}: missing WhatsApp link`);
  if (!html.includes('maps.app.goo.gl/PbJ8xsG1s7Gv6UMf8')) errors.push(`${rel}: missing supplied Maps URL`);
  if (['index.html','اتصل-بنا/index.html'].includes(rel) && !html.includes('maps.google.com/maps?output=embed')) errors.push(`${rel}: missing interactive map embed`);
  if (rel === 'index.html' && !html.includes('hero-roof-waterproofing-hail.jpg')) errors.push('index.html: designated cover photo is not the hero');
  if (!html.includes('/assets/icons/whatsapp.svg') || !html.includes('/assets/icons/phone.svg')) errors.push(`${rel}: missing WhatsApp brand mark or phone icon`);
  if (errors.length === errorsBefore) reports.push(`PASS ${rel}`);
}
const allText = await Promise.all(files.filter(file => /\.(?:html|css|js|svg|json|txt|xml|md)$/.test(file)).map(file => readFile(file,'utf8')));
if (allText.some(text => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(text))) errors.push('Emoji or emoji presentation character found in source files');
const sitemap = await readFile(resolve(root,'sitemap.xml'),'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
if (urls.length !== 16) errors.push(`Sitemap should contain 16 URLs; found ${urls.length}`);
if (new Set(urls).size !== urls.length) errors.push('Sitemap contains duplicate URLs');
if (!(await readFile(resolve(root,'robots.txt'),'utf8')).includes('/sitemap.xml')) errors.push('robots.txt does not reference sitemap');
if (!(await stat(resolve(root,'favicon.svg')))) errors.push('Missing favicon.svg');
const backups = (await readdir(resolve(root,'backup/original-photos'))).filter(x=>x.endsWith('.jfif'));
if (backups.length !== 7) errors.push(`Expected 7 original photo backups; found ${backups.length}`);
const images = files.filter(file => file.startsWith(resolve(root,'assets','images') + sep) && /\.jpg$/i.test(file));
if (images.length !== 7) errors.push(`Expected 7 optimized JPGs; found ${images.length}`);
if (process.env.QA_BASE_URL) {
  const base = process.env.QA_BASE_URL.replace(/\/$/,'');
  for (const url of urls) {
    const route = new URL(url).pathname;
    try { const response = await fetch(base + route); if (!response.ok) errors.push(`Preview returned ${response.status} for ${route}`); }
    catch (error) { errors.push(`Preview request failed for ${route}: ${error.message}`); }
  }
  for (const file of files.filter(f=>f.startsWith(resolve(root,'assets') + sep) && /\.(?:jpg|svg)$/i.test(f))) {
    const route = '/' + file.slice(root.length + 1).split(sep).join('/');
    try { const response = await fetch(base + route); if (!response.ok) errors.push(`Preview returned ${response.status} for asset ${route}`); }
    catch (error) { errors.push(`Preview asset request failed for ${route}: ${error.message}`); }
  }
}
console.log(`${reports.length}/${htmlFiles.length} HTML pages passed core checks; ${imageCount} image references found.`);
console.log(reports.join('\n'));
if (errors.length) { console.error('\nFAILURES\n' + errors.map(e=>'- '+e).join('\n')); process.exitCode=1; }
else console.log('All link, metadata, schema, contact, sitemap, image, backup, and emoji checks passed.');
