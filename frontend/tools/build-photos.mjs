import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('photo-work');
const OUT = path.resolve('public/images/photos');
const MANIFEST = path.resolve('src/data/photos.json');
const WIDTHS = [640, 1024, 1600, 2400];
const readJson = async (p, d) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const exists = (p) => fs.access(p).then(() => true).catch(() => false);
const hex = (c) => `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;

(async () => {
  const picked = (await readJson(path.join(ROOT, 'selection.json'), [])).map((x) => ({ ...x, kind: 'commons' }));
  const own = (await readJson(path.join(ROOT, 'own.json'), [])).map((x) => ({ ...x, kind: 'own', id: x.id || `o-${slug(path.basename(x.file, path.extname(x.file)))}`, author: x.author || 'Own photograph', license: x.license || 'All rights reserved by the office' }));
  const all = [...picked, ...own];
  if (!all.length) { console.log('Nothing to build. Save selection.json (from review.html) or fill own.json in photo-work/'); return; }
  const old = (await readJson(MANIFEST, { items: [] })).items || [];
  const prev = Object.fromEntries(old.map((x) => [x.id, x]));
  const items = [];

  for (const it of all) {
    const src = path.join(ROOT, it.file);
    if (!(await exists(src))) { console.log(`missing file, skipped: ${it.file}`); continue; }
    const base = sharp(src, { failOn: 'none' }).rotate();
    const meta = await sharp(src, { failOn: 'none' }).rotate().metadata().then(async () => (await sharp(await base.clone().toBuffer()).metadata()));
    const widths = WIDTHS.filter((w) => w <= meta.width);
    if (!widths.length) widths.push(meta.width);
    const dir = path.join(OUT, it.id);
    await fs.mkdir(dir, { recursive: true });
    const fbW = Math.max(...widths.filter((w) => w <= 1600).concat([Math.min(...widths)]));
    for (const w of widths) {
      const a = path.join(dir, `${it.id}-${w}.avif`);
      const b = path.join(dir, `${it.id}-${w}.webp`);
      const r = () => sharp(src, { failOn: 'none' }).rotate().resize({ width: w, withoutEnlargement: true });
      if (!(await exists(a))) await r().avif({ quality: 50, effort: 4 }).toFile(a);
      if (!(await exists(b))) await r().webp({ quality: 78 }).toFile(b);
      if (w === fbW) { const j = path.join(dir, `${it.id}-${w}.jpg`); if (!(await exists(j))) await r().jpeg({ quality: 76, mozjpeg: true }).toFile(j); }
    }
    const { dominant } = await sharp(src, { failOn: 'none' }).rotate().resize(64).stats();
    const lq = await sharp(src, { failOn: 'none' }).rotate().resize(28).webp({ quality: 35 }).toBuffer();
    const p = prev[it.id] || {};
    items.push({
      id: it.id, theme: it.theme || 'other', title: it.title || it.id, author: it.author, license: it.license, license_url: it.license_url || '', source_url: it.source_url || '', people: !!it.people,
      width: meta.width, height: meta.height, widths, fallback_w: fbW, placeholder: `data:image/webp;base64,${lq.toString('base64')}`, color: hex(dominant),
      alt_en: p.alt_en ?? (it.alt_en || String(it.title || '').slice(0, 140)), alt_ne: p.alt_ne ?? (it.alt_ne || ''), caption_en: p.caption_en ?? '', caption_ne: p.caption_ne ?? '',
      place_en: p.place_en ?? (it.place_en || ''), place_ne: p.place_ne ?? (it.place_ne || ''), focal: p.focal ?? it.focal ?? [50, 50], motion: p.motion ?? 'auto', transition: p.transition ?? 'auto', enabled: p.enabled ?? true
    });
    console.log(`built ${it.id} (${widths.join(', ')} px)`);
  }
  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify({ version: 1, items }, null, 2));
  const noNe = items.filter((x) => !x.alt_ne).length;
  const people = items.filter((x) => x.people);
  console.log(`\n${items.length} photos in src/data/photos.json`);
  if (noNe) console.log(`- ${noNe} photo(s) still need alt_ne / place_ne (Nepali text) in photos.json`);
  if (people.length) console.log(`- ${people.length} photo(s) show people: confirm consent/permission before publishing: ${people.map((x) => x.id).join(', ')}`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
