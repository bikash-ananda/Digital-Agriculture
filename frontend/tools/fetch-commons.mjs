import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('photo-work');
const OUT = path.join(ROOT, 'candidates');
const arg = (n, d) => ((process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || d);
const PER = Number(arg('per', 10));
const ONLY = arg('theme', '');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = `KaskiAgriPlatform/1.0 (${process.env.SITE_URL || 'https://kaskikotagro.com.np'}; ${process.env.CONTACT_EMAIL || 'webmaster@kaskikotagro.com.np'})`;
const MIN_W = 2400;
const MIN_H = 1300;

const THEMES = {
  himal: ['Machapuchare Pokhara', 'Annapurna range Pokhara', 'Phewa Lake Annapurna', 'Annapurna South Pokhara sunrise', 'Pokhara Sarangkot Himalaya panorama', 'Dhaulagiri Himalaya Nepal', 'Manaslu Gorkha Himalaya', 'Gandaki Province landscape Nepal', 'Begnas Lake Pokhara'],
  traditional: ['rice terraces Nepal', 'Nepal farmer ploughing oxen', 'Nepal women planting rice', 'Nepal millet harvest village', 'Nepal terrace farming hills', 'Nepal village farm Kaski', 'Nepal buffalo farmer hills', 'Nepal paddy field harvest'],
  modern: ['greenhouse Nepal', 'polytunnel Nepal vegetable', 'drip irrigation Nepal', 'Nepal tomato greenhouse', 'Nepal orange orchard', 'Nepal vegetable farming', 'Nepal agriculture training farmers', 'Nepal tunnel farming']
};

const OK = /^(cc0|public domain|pd[ -]|cc[ -]by(-sa)?[ -]\d)/i;
const NO = /-(nc|nd)/i;
const PEOPLE = /\b(farmer|farmers|woman|women|man|men|girl|boy|child|children|people|portrait|villager|villagers|worker|workers|family|couple)\b/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

async function jget(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function search(q) {
  const u = new URL(API);
  Object.entries({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: 6, gsrsearch: `${q} filetype:bitmap`, gsrlimit: 40,
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: 2560,
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|Restrictions|ImageDescription'
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await jget(u);
  return Object.values((j.query && j.query.pages) || {});
}

async function download(url, file) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status}`);
  await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
}

function reviewHtml(list) {
  const data = JSON.stringify(list).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Photo review</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#f3f6f4;color:#17261e}
header{position:sticky;top:0;background:#123221;color:#fff;padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;z-index:5}
header button{padding:6px 12px;border-radius:6px;border:0;cursor:pointer}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:16px}
.card{background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 0 0 1px #d7e8dc}
.card img{width:100%;height:200px;object-fit:cover;display:block}
.card div.b{padding:10px 12px;font-size:13px;line-height:1.4}
.pill{display:inline-block;padding:1px 7px;border-radius:99px;background:#eef5f0;margin-right:4px;font-size:12px}
.warn{background:#fef3c7}
.sel{outline:4px solid #2b6a3b}
</style></head><body>
<header><b>Pick 6 to 10 photos per theme</b><span id="count">0 selected</span>
<span id="filters"></span><button id="exp">Export selection.json</button></header>
<div id="grid"></div>
<script>
var items = ${data};
var THEMES = ['himal','traditional','modern','other'];
var grid = document.getElementById('grid');
function el(tag, text, cls){ var e=document.createElement(tag); if(text!==undefined) e.textContent=text; if(cls) e.className=cls; return e; }
items.forEach(function(c){
  var d = el('div','', 'card'); d.dataset.theme = c.theme; d.dataset.id = c.id;
  var img = el('img'); img.src = c.file; img.loading = 'lazy'; img.alt = c.title; d.appendChild(img);
  var b = el('div','', 'b');
  var t = el('b', c.title); b.appendChild(t); b.appendChild(el('br'));
  b.appendChild(el('span', c.license, 'pill')); b.appendChild(el('span', c.width + 'x' + c.height, 'pill'));
  if (c.people) b.appendChild(el('span', 'people: check consent', 'pill warn'));
  b.appendChild(el('br')); b.appendChild(el('span', 'Author: ' + c.author));
  b.appendChild(el('br'));
  var a = el('a', 'source page'); a.href = c.source_url; a.target = '_blank'; a.rel = 'noreferrer'; b.appendChild(a);
  var row = el('div'); row.style.marginTop = '8px';
  var cb = el('input'); cb.type = 'checkbox'; cb.onchange = function(){ d.classList.toggle('sel', cb.checked); upd(); };
  var lab = el('label', ' use '); lab.insertBefore(cb, lab.firstChild);
  var sel = el('select'); THEMES.forEach(function(x){ var o = el('option', x); o.value = x; if (x === c.theme) o.selected = true; sel.appendChild(o); });
  sel.style.marginLeft = '8px'; row.appendChild(lab); row.appendChild(sel); b.appendChild(row);
  d.appendChild(b); grid.appendChild(d);
});
function upd(){ document.getElementById('count').textContent = document.querySelectorAll('.card input:checked').length + ' selected'; }
var f = document.getElementById('filters');
['all'].concat(THEMES).forEach(function(x){ var bt = el('button', x); bt.onclick = function(){ document.querySelectorAll('.card').forEach(function(c){ c.style.display = (x==='all' || c.dataset.theme===x) ? '' : 'none'; }); }; f.appendChild(bt); });
document.getElementById('exp').onclick = function(){
  var out = [];
  document.querySelectorAll('.card').forEach(function(card){
    if (!card.querySelector('input').checked) return;
    var c = items.filter(function(i){ return i.id === card.dataset.id; })[0];
    out.push({ id: c.id, file: c.file, theme: card.querySelector('select').value, title: c.title, author: c.author, license: c.license, license_url: c.license_url, source_url: c.source_url, width: c.width, height: c.height, people: c.people });
  });
  var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'selection.json'; a.click();
};
</script></body></html>`;
}

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const seen = new Map();
  JSON.parse(await fs.readFile(path.join(ROOT, 'candidates.json'), 'utf8').catch(() => '[]')).forEach((c) => seen.set(c.id, c));
  for (const [theme, queries] of Object.entries(THEMES)) {
    if (ONLY && ONLY !== theme) continue;
    let kept = 0;
    for (const q of queries) {
      let pages = [];
      try { pages = await search(q); } catch (e) { console.log(`  search failed "${q}": ${e.message}`); await sleep(1500); continue; }
      let n = 0;
      for (const p of pages) {
        if (n >= PER) break;
        const ii = p.imageinfo && p.imageinfo[0];
        if (!ii || ii.mime !== 'image/jpeg' || ii.width < MIN_W || ii.height < MIN_H || !ii.thumburl) continue;
        const md = ii.extmetadata || {};
        const license = strip(md.LicenseShortName && md.LicenseShortName.value);
        if (!OK.test(license) || NO.test(license)) continue;
        const author = strip(md.Artist && md.Artist.value);
        if (!author && !/^(cc0|public domain|pd)/i.test(license)) continue;
        const id = `c${p.pageid}`;
        if (seen.has(id)) continue;
        const title = p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' ');
        const desc = strip(md.ImageDescription && md.ImageDescription.value).slice(0, 220);
        const restrictions = strip(md.Restrictions && md.Restrictions.value);
        try { await download(ii.thumburl, path.join(OUT, `${id}.jpg`)); } catch (e) { console.log(`  download failed: ${title} (${e.message})`); await sleep(1000); continue; }
        seen.set(id, {
          id, theme, query: q, title, description: desc, author: author || 'Public domain', license, license_url: strip(md.LicenseUrl && md.LicenseUrl.value),
          source_url: ii.descriptionshorturl || ii.descriptionurl, width: ii.width, height: ii.height, file: `candidates/${id}.jpg`,
          people: PEOPLE.test(`${title} ${desc}`) || /personality/i.test(restrictions)
        });
        n++; kept++;
        process.stdout.write('.');
        await sleep(400);
      }
      await sleep(600);
    }
    console.log(`\n${theme}: ${kept} new candidates`);
  }
  const list = [...seen.values()];
  await fs.writeFile(path.join(ROOT, 'candidates.json'), JSON.stringify(list, null, 2));
  await fs.writeFile(path.join(ROOT, 'review.html'), reviewHtml(list));
  console.log(`\n${list.length} candidates in total. Open photo-work/review.html`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
