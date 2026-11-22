// Reads the KMLfile column of the civil-works Google Sheet, downloads each KML/KMZ
// (Google Drive link, Drive file ID, a file name inside one of the Drive folders below,
// or any public URL), converts it to GeoJSON and writes kml/works.geojson for the website.
// Runs in GitHub Actions (.github/workflows/kml.yml); no API keys needed as long as the
// sheet and the files are shared "anyone with the link".
import { writeFileSync, mkdirSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { kml as kmlToGeo } from '@tmcw/togeojson';
import { unzipSync, strFromU8 } from 'fflate';

const SHEET_ID = '1zQYDFJ8cJNiZhuKysX9rHrJRUg--cde7or3h9hllRSQ';
const SHEET_NAME = 'works';
// Folders searched when the KMLfile cell holds a file name instead of a link
const FOLDERS = ['1bGTxzjS1F13fwUKfeOcrDzmjkp-NX5Wi'];
const UA = { 'User-Agent': 'Mozilla/5.0 (civil-works-site build)' };

const norm = h => String(h || '').toLowerCase().replace(/[^a-z]/g, '');

async function readSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}&headers=1`;
  const txt = await (await fetch(url, { headers: UA })).text();
  const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  const cols = json.table.cols.map(c => norm(c.label));
  return json.table.rows.map(r => {
    const o = {};
    cols.forEach((k, i) => { const c = r.c && r.c[i]; o[k] = c && c.v != null ? String(c.v).trim() : ''; });
    return o;
  });
}

let folderIndex = null;
async function listFolders() {
  if (folderIndex) return folderIndex;
  folderIndex = {};
  for (const f of FOLDERS) {
    try {
      const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${f}`, { headers: UA })).text();
      // each entry: <a href="https://drive.google.com/file/d/ID/view..." ...> ... <div class="flip-entry-title">NAME</div>
      const re = /\/file\/d\/([-\w]{20,})\/[^"]*"[\s\S]*?flip-entry-title">([^<]+)</g;
      let m; while ((m = re.exec(html))) folderIndex[m[2].trim().toLowerCase()] = m[1];
    } catch (e) { console.warn('folder list failed', f, e.message); }
  }
  return folderIndex;
}

async function resolve(cell) {
  const v = cell.trim();
  const id = (v.match(/\/d\/([-\w]{20,})/) || v.match(/[?&]id=([-\w]{20,})/) || v.match(/^([-\w]{25,})$/) || [])[1];
  if (id) return { url: `https://drive.google.com/uc?export=download&id=${id}`, src: 'drive-id' };
  if (/^https?:\/\//i.test(v)) return { url: v, src: 'url' };
  const name = v.split('/').pop().toLowerCase();
  const idx = await listFolders();
  if (idx[name]) return { url: `https://drive.google.com/uc?export=download&id=${idx[name]}`, src: 'drive-folder' };
  throw new Error(`file "${name}" not found in the Drive folder(s); paste the file's Drive link instead`);
}

function toGeo(buf) {
  let text;
  if (buf[0] === 0x50 && buf[1] === 0x4b) { // KMZ (zip)
    const files = unzipSync(buf);
    const k = Object.keys(files).find(n => n.toLowerCase().endsWith('.kml'));
    if (!k) throw new Error('KMZ has no .kml inside');
    text = strFromU8(files[k]);
  } else text = new TextDecoder().decode(buf);
  if (/<html/i.test(text.slice(0, 500))) throw new Error('got a web page instead of a KML (is the file shared "anyone with the link"?)');
  const geo = kmlToGeo(new DOMParser().parseFromString(text, 'text/xml'));
  if (!geo.features.length) throw new Error('KML has no shapes');
  return geo;
}

const rows = await readSheet();
const out = { type: 'FeatureCollection', features: [] };
const status = { works: [] };
for (const r of rows) {
  const cell = r.kmlfile || r.kml || '';
  const workId = r.idno || '';
  if (!cell || !workId) continue;
  const s = { id: workId, kml: cell };
  try {
    const { url, src } = await resolve(cell);
    const res = await fetch(url, { headers: UA, redirect: 'follow' });
    if (!res.ok) throw new Error('download failed: HTTP ' + res.status);
    const geo = toGeo(new Uint8Array(await res.arrayBuffer()));
    geo.features.forEach(f => { f.properties = { workId, name: f.properties?.name || '' }; out.features.push(f); });
    Object.assign(s, { ok: true, src, shapes: geo.features.length });
  } catch (e) { Object.assign(s, { ok: false, error: e.message }); }
  status.works.push(s);
  console.log(JSON.stringify(s));
}
mkdirSync('kml', { recursive: true });
writeFileSync('kml/works.geojson', JSON.stringify(out));
status.folderFiles = folderIndex ? Object.keys(folderIndex).length : null;
writeFileSync('kml/status.json', JSON.stringify(status, null, 1));
