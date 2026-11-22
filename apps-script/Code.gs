/**
 * ATR Forest Civil Works – "Add record" receiver.
 * Saves a record sent by the website into the "works" sheet and the photo into the works_Images Drive folder.
 *
 * Setup (once), signed in as the Google account that owns the sheet and the photo folder:
 *  1. Open the civil-works Google Sheet > Extensions > Apps Script. Delete what is there, paste this file, Save.
 *  2. Change the PIN in setPin() below, choose setPin in the function list at the top and press Run.
 *     Allow the permissions it asks for. (Run it again any time you want to change the PIN.)
 *  3. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy.
 *  4. Copy the Web app URL (ends in /exec) and send it to be added to the website.
 * After editing this code later: Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy.
 */
const SHEET_ID = '1zQYDFJ8cJNiZhuKysX9rHrJRUg--cde7or3h9hllRSQ';
const SHEET_NAME = 'works';
const FOLDER_ID = '1bGTxzjS1F13fwUKfeOcrDzmjkp-NX5Wi'; // works_Images
const TZ = 'Asia/Kolkata';

function setPin() {
  PropertiesService.getScriptProperties().setProperty('PIN', 'CHANGE-ME-1234'); // <-- put your PIN here
}

function doGet() {
  return out({ ok: true, service: 'ATR civil works add-record' });
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const pin = PropertiesService.getScriptProperties().getProperty('PIN');
    if (!pin || pin === 'CHANGE-ME-1234') return out({ ok: false, error: 'PIN is not set up yet' });
    if (String(d.pin || '') !== pin) return out({ ok: false, error: 'Wrong PIN' });
    for (const k of ['year', 'division', 'range', 'section', 'beat', 'location', 'structure']) {
      if (!String(d[k] || '').trim()) return out({ ok: false, error: 'Missing ' + k });
    }
    if (!d.photo) return out({ ok: false, error: 'Missing photo' });

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
      const vals = sh.getDataRange().getValues();
      const head = vals[0].map(String);
      const norm = h => h.toLowerCase().replace(/[^a-z]/g, '');
      const col = n => head.findIndex(h => norm(h) === n);
      const ids = vals.slice(1).map(r => Number(r[col('idno')])).filter(n => n > 0);
      const id = (ids.length ? Math.max.apply(null, ids) : 5000) + 1;
      const now = new Date();

      const bytes = Utilities.base64Decode(String(d.photo).split(',').pop());
      const name = id + '.Photo.' + Utilities.formatDate(now, TZ, 'HHmmss') + '.jpg';
      const file = DriveApp.getFolderById(FOLDER_ID).createFile(Utilities.newBlob(bytes, 'image/jpeg', name));
      const photoUrl = 'https://drive.google.com/file/d/' + file.getId() + '/view';

      const row = head.map(() => '');
      const set = (k, v) => { const i = col(k); if (i >= 0) row[i] = v; };
      const num = v => (String(v || '').trim() !== '' && !isNaN(Number(v))) ? Number(v) : String(v || '').trim();
      set('idno', id);
      set('division', String(d.division).trim());
      set('range', String(d.range).trim());
      set('section', String(d.section).trim());
      set('beat', String(d.beat).trim());
      set('compno', num(d.comp));
      set('location', String(d.location).trim());
      set('scheme', String(d.scheme || '').trim());
      set('year', String(d.year).trim());
      set('structure', String(d.structure).trim());
      set('latitude', num(d.lat));
      set('longitude', num(d.lng));
      set('photourl', photoUrl);
      set('picturetakendate', Utilities.parseDate(Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), TZ, 'yyyy-MM-dd'));
      sh.appendRow(row);
      // keep Year as text (e.g. 2026-27)
      const yc = col('year'); if (yc >= 0) sh.getRange(sh.getLastRow(), yc + 1).setNumberFormat('@').setValue(String(d.year).trim());
      const dc = col('picturetakendate'); if (dc >= 0) sh.getRange(sh.getLastRow(), dc + 1).setNumberFormat('dd/mm/yyyy');
      return out({ ok: true, id: id, photo: photoUrl });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
