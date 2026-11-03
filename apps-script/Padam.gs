/**
 * Padam semua baris untuk satu tarikh dari tab Data.
 * Dijalankan dari menu Sheet: Kehadiran > Padam data satu tarikh.
 *
 * Hanya lajur A:E dipadam (Delete cells > Shift up). Lajur F tidak disentuh
 * supaya ARRAYFORMULA di F2 kekal.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Kehadiran')
    .addItem('Padam data satu tarikh', 'padamTarikh')
    .addToUi();
}

/** Tukar "dd/mm/yyyy" kepada "yyyy-mm-dd". Pulang null jika tidak sah. */
function ddmmyyyyKeIso_(teks) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(String(teks));
  if (!m) return null;
  const d = parseInt(m[1], 10), b = parseInt(m[2], 10), y = parseInt(m[3], 10);
  const t = new Date(Date.UTC(y, b - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== b - 1 || t.getUTCDate() !== d) return null;
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return y + '-' + pad(b) + '-' + pad(d);
}

/**
 * Kumpul nombor baris (menaik) kepada blok berturutan, susun dari bawah ke atas
 * supaya padam satu blok tak mengganggu nombor baris blok lain.
 * Contoh: [2,3,4,10,11] -> [[10,2],[2,3]]  (baris mula, bilangan)
 */
function kumpulBlok_(baris) {
  const blok = [];
  baris.forEach(function (r) {
    const akhir = blok[blok.length - 1];
    if (akhir && akhir[0] + akhir[1] === r) akhir[1]++;
    else blok.push([r, 1]);
  });
  return blok.reverse();
}

/** Cari baris tab Data untuk satu tarikh. Pulang {baris: [no baris menaik], hadir, jumlah}. */
function cariBarisTarikh_(td, iso) {
  const sheet = td.sheet;
  const maxRows = sheet.getMaxRows();
  const nilai = maxRows > 1 ? sheet.getRange(2, 1, maxRows - 1, 5).getValues() : [];
  const baris = [];
  let hadir = 0, jumlah = 0;
  nilai.forEach(function (r, i) {
    const v = r[0];
    if (v === '' || v === null) return;
    const vIso = v instanceof Date ? Utilities.formatDate(v, td.tz, 'yyyy-MM-dd') : String(v);
    if (vIso === iso) {
      baris.push(i + 2);
      hadir += Number(r[3]) || 0;
      jumlah += Number(r[4]) || 0;
    }
  });
  return { baris: baris, hadir: hadir, jumlah: jumlah };
}

/** Padam lajur A:E sahaja (shift up) supaya ARRAYFORMULA di F2 kekal. */
function padamBaris_(sheet, baris) {
  kumpulBlok_(baris).forEach(function (b) {
    sheet.getRange(b[0], 1, b[1], 5).deleteCells(SpreadsheetApp.Dimension.ROWS);
  });
  SpreadsheetApp.flush();
}

/** Satu baris ringkasan per tarikh (terbaru dahulu). Tiada panggilan ke Sheet. */
function ringkasPerTarikh_(rows) {
  const ikut = {};
  rows.forEach(function (r) {
    const t = ikut[r.iso] || (ikut[r.iso] = { iso: r.iso, bilKelas: 0, hadir: 0, jumlah: 0 });
    t.bilKelas++;
    t.hadir += r.hadir;
    t.jumlah += r.jumlah;
  });
  return Object.keys(ikut).sort().reverse().map(function (k) {
    const t = ikut[k];
    t.peratus = t.jumlah ? t.hadir / t.jumlah : null;
    return t;
  });
}

/* ---------------- Web app (admin sahaja) ---------------- */

/** Senarai tarikh yang ada data, untuk menu Padam Data. */
function getSenaraiPadam() {
  const a = semakAkses_(true);
  const td = tabData_();
  const rows = bacaData_(td);
  const tarikh = ringkasPerTarikh_(rows);
  return {
    email: a.emel,
    peranan: a.peranan,
    kemaskini: tarikh.length ? tarikh[0].iso : null,
    tarikhSemua: tarikh.map(function (t) { return t.iso; }),
    tarikh: tarikh,
  };
}

/**
 * Padam semua baris satu tarikh dari web app.
 * sahTeks mesti sama dengan tarikh dalam format dd/mm/yyyy (pengguna taip sendiri).
 */
function padamDataWeb(iso, sahTeks) {
  try {
    const a = semakAkses_(true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) throw new Error('Tarikh tidak sah.');
    const paparan = iso.split('-').reverse().join('/');
    if (ddmmyyyyKeIso_(sahTeks) !== iso) {
      throw new Error('Pengesahan tidak sepadan. Taip ' + paparan + ' untuk sahkan.');
    }
    const td = tabData_();
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const cari = cariBarisTarikh_(td, iso);
      if (!cari.baris.length) throw new Error('Tiada data untuk ' + paparan + '. Tiada apa dipadam.');
      padamBaris_(td.sheet, cari.baris);
      Logger.log('Padam (web) ' + cari.baris.length + ' baris untuk ' + iso + ' oleh ' + a.emel);
      return { ok: true, mesej: cari.baris.length + ' kelas untuk ' + paparan + ' telah dipadam (' +
        cari.hadir + '/' + cari.jumlah + ' murid). Anda boleh upload semula tarikh yang betul.' };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { ok: false, mesej: String(e && e.message ? e.message : e) };
  }
}

function padamTarikh() {
  semakAkses_(true);
  const ui = SpreadsheetApp.getUi();
  const jawapan = ui.prompt('Padam data satu tarikh',
    'Masukkan tarikh yang hendak dipadam (dd/mm/yyyy):', ui.ButtonSet.OK_CANCEL);
  if (jawapan.getSelectedButton() !== ui.Button.OK) return;

  const teks = jawapan.getResponseText().trim();
  const iso = ddmmyyyyKeIso_(teks);
  if (!iso) { ui.alert('Tarikh tidak sah: "' + teks + '". Guna format dd/mm/yyyy, contoh 30/10/2026.'); return; }
  const paparan = iso.split('-').reverse().join('/');

  const td = tabData_();
  const sheet = td.sheet;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cari = cariBarisTarikh_(td, iso);
    const baris = cari.baris, hadir = cari.hadir, jumlah = cari.jumlah;

    if (baris.length === 0) { ui.alert('Tiada data untuk ' + paparan + '. Tiada apa dipadam.'); return; }

    const sah = ui.alert('Sahkan padam',
      baris.length + ' baris untuk ' + paparan + ' akan dipadam' +
      ' (baris ' + baris[0] + ' hingga ' + baris[baris.length - 1] + ', jumlah ' + hadir + '/' + jumlah + ' murid).\n\n' +
      'Tindakan ini tidak boleh dibatalkan dari sistem (guna Edit > Undo atau Version history jika perlu).\n\nTeruskan?',
      ui.ButtonSet.YES_NO);
    if (sah !== ui.Button.YES) { ui.alert('Dibatalkan. Tiada apa dipadam.'); return; }

    padamBaris_(sheet, baris);
    Logger.log('Padam ' + baris.length + ' baris untuk ' + iso + ' oleh ' + Session.getActiveUser().getEmail());
    ui.alert(baris.length + ' baris untuk ' + paparan + ' telah dipadam. Anda boleh upload semula tarikh yang betul.');
  } finally {
    lock.releaseLock();
  }
}
