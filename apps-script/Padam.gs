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

    if (baris.length === 0) { ui.alert('Tiada data untuk ' + paparan + '. Tiada apa dipadam.'); return; }

    const sah = ui.alert('Sahkan padam',
      baris.length + ' baris untuk ' + paparan + ' akan dipadam' +
      ' (baris ' + baris[0] + ' hingga ' + baris[baris.length - 1] + ', jumlah ' + hadir + '/' + jumlah + ' murid).\n\n' +
      'Tindakan ini tidak boleh dibatalkan dari sistem (guna Edit > Undo atau Version history jika perlu).\n\nTeruskan?',
      ui.ButtonSet.YES_NO);
    if (sah !== ui.Button.YES) { ui.alert('Dibatalkan. Tiada apa dipadam.'); return; }

    kumpulBlok_(baris).forEach(function (b) {
      sheet.getRange(b[0], 1, b[1], 5).deleteCells(SpreadsheetApp.Dimension.ROWS);
    });
    SpreadsheetApp.flush();
    Logger.log('Padam ' + baris.length + ' baris untuk ' + iso);
    ui.alert(baris.length + ' baris untuk ' + paparan + ' telah dipadam. Anda boleh upload semula tarikh yang betul.');
  } finally {
    lock.releaseLock();
  }
}
