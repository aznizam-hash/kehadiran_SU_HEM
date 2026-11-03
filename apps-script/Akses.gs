/**
 * Kawalan akses web app.
 *
 * Peranan:
 *   admin : semua menu, termasuk Import CSV.
 *   lihat : Dashboard, Analisis, Trend sahaja.
 * Pemilik script (akaun yang deploy) sentiasa admin walaupun tiada dalam senarai.
 * Orang lain ditolak.
 *
 * Senarai disimpan dalam tab "Pengguna": A Emel | B Peranan | C Nama | D Catatan.
 * Jalankan setupPengguna() sekali untuk cipta tab itu.
 *
 * Nota: web app perlu di-deploy "Execute as: Me" dan
 * "Who has access: Anyone within <domain>". Google hanya beri emel pengguna
 * dalam domain yang sama; emel kosong = ditolak.
 */

const TAB_PENGGUNA = 'Pengguna';
const PERANAN_SAH = ['admin', 'lihat'];

function setupPengguna() {
  semakAkses_(true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(TAB_PENGGUNA)) {
    Logger.log('Tab Pengguna sudah wujud. Tiada perubahan.');
    return;
  }
  const sh = ss.insertSheet(TAB_PENGGUNA);
  sh.getRange('A1:D1').setValues([['Emel', 'Peranan', 'Nama', 'Catatan']]).setFontWeight('bold');
  sh.getRange('A2:D2').setValues([[Session.getEffectiveUser().getEmail(), 'admin', 'SU HEM', 'Pemilik sistem']]);
  sh.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(PERANAN_SAH, true).setAllowInvalid(false).build());
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 280);
  sh.setColumnWidth(3, 180);
  sh.setColumnWidth(4, 240);
  Logger.log('Tab Pengguna dicipta.');
}

/**
 * Tentukan peranan bagi emel. Tiada panggilan ke Sheet (boleh diuji dengan Node).
 * @param {string} emel emel pengguna semasa ('' jika Google tak beri)
 * @param {string} emelPemilik emel pemilik script
 * @param {Array<Array>} senarai baris tab Pengguna tanpa header: [emel, peranan, ...]
 * @return {string|null} 'admin' | 'lihat' | null (ditolak)
 */
function tentukanPeranan_(emel, emelPemilik, senarai) {
  const e = String(emel || '').trim().toLowerCase();
  if (!e) return null;
  if (e === String(emelPemilik || '').trim().toLowerCase()) return 'admin';
  let hasil = null;
  (senarai || []).forEach(function (r) {
    const re = String(r[0] || '').trim().toLowerCase();
    const p = String(r[1] || '').trim().toLowerCase();
    if (re === e && PERANAN_SAH.indexOf(p) >= 0) {
      if (p === 'admin' || !hasil) hasil = p;   // jika berulang, admin menang
    }
  });
  return hasil;
}

/** Pulang {emel, peranan}. Peranan null jika tiada akses. */
function aksesSemasa_() {
  const emel = Session.getActiveUser().getEmail();
  const pemilik = Session.getEffectiveUser().getEmail();
  let senarai = [];
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_PENGGUNA);
  if (sh && sh.getLastRow() > 1) senarai = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  return { emel: emel, peranan: tentukanPeranan_(emel, pemilik, senarai) };
}

/**
 * Throw jika pengguna semasa tiada akses (atau bukan admin bila perluAdmin).
 * Wajib dipanggil di awal setiap fungsi yang dipanggil dari web app.
 */
function semakAkses_(perluAdmin) {
  const a = aksesSemasa_();
  if (!a.peranan) throw new Error('Akses ditolak' + (a.emel ? ' untuk ' + a.emel : '') + '.');
  if (perluAdmin && a.peranan !== 'admin') throw new Error('Fungsi ini untuk admin sahaja.');
  return a;
}

function halamanDitolak_(emel, sebab) {
  const t = HtmlService.createTemplateFromFile('Ditolak');
  t.emel = emel || '';
  t.sebab = sebab;
  return t.evaluate().setTitle('Akses ditolak').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
