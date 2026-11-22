// Refreshes assets/beats.json (Division > Range > Section > Beat list used by the Add record form)
// from the master Beats_Sections_ranges.xlsx in Google Drive (shared "anyone with the link").
import { writeFileSync, readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
const FILE_ID = '11yGjDALHGVqGzikGtw3LL_-IUihHVFsg';
// Divisions left out of the Add record form
const EXCLUDE = ['flying squad', 'anti poaching squad'];
const res = await fetch(`https://drive.google.com/uc?export=download&id=${FILE_ID}`, { headers: { 'User-Agent': 'Mozilla/5.0 (civil-works-site build)' } });
if (!res.ok) throw new Error('download failed ' + res.status);
const buf = Buffer.from(await res.arrayBuffer());
if (buf[0] !== 0x50) { console.log('Not an xlsx download, keeping the current list'); process.exit(0); }
const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
const ws = wb.getWorksheet('Beats') || wb.worksheets[0];
const head = Array.from(ws.getRow(1).values, v => String(v ?? '').toLowerCase().replace(/[^a-z]/g, ''));
const ix = n => head.findIndex(h => h.startsWith(n));
const [d, r, s, b] = ['division', 'range', 'section', 'beat'].map(ix);
if ([d, r, s, b].some(i => i < 0)) throw new Error('columns not found: ' + head.join(','));
const txt = c => { const v = c?.value; return String(v && typeof v === 'object' ? (v.result ?? v.text ?? '') : (v ?? '')).trim(); };
const set = new Set();
ws.eachRow((row, n) => { if (n === 1) return; const t = [d, r, s, b].map(i => txt(row.getCell(i))); if (t[0] && t[3] && !EXCLUDE.includes(t[0].toLowerCase())) set.add(JSON.stringify(t)); });
const rows = [...set].map(x => JSON.parse(x)).sort((a, b2) => a.join('|').localeCompare(b2.join('|')));
if (rows.length < 10) throw new Error('too few rows: ' + rows.length);
const out = JSON.stringify(rows);
let old = ''; try { old = readFileSync('assets/beats.json', 'utf8'); } catch {}
if (old !== out) writeFileSync('assets/beats.json', out);
console.log('beats', rows.length, old === out ? 'unchanged' : 'updated');
