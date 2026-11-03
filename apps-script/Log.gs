/**
 * Sejarah Import: rekod setiap import dan padam data dalam tab "Log".
 * Tab dicipta automatik pada rekod pertama.
 *
 * Lajur: Masa | Pengguna | Tindakan | Tarikh data | Kelas | Hadir | Jumlah | Dibetulkan | Catatan
 * Upload yang ditolak tidak direkod (tiada data berubah).
 */

const TAB_LOG = 'Log';
const HEADER_LOG = ['Masa', 'Pengguna', 'Tindakan', 'Tarikh data', 'Kelas', 'Hadir', 'Jumlah', 'Dibetulkan', 'Catatan'];
const HAD_SEJARAH = 500;

function tabLog_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB_LOG);
  if (!sh) {
    sh = ss.insertSheet(TAB_LOG);
    sh.getRange(1, 1, 1, HEADER_LOG.length).setValues([HEADER_LOG]).setFontWeight('bold');
    sh.getRange('A2:A').setNumberFormat('dd/mm/yyyy hh:mm');
    sh.getRange('D2:D').setNumberFormat('@');
    sh.setFrozenRows(1);
    sh.setColumnWidth(2, 240);
    sh.setColumnWidth(9, 260);
  }
  return sh;
}

/**
 * Tambah satu rekod. Tidak pernah throw: kegagalan menulis log tidak boleh
 * membatalkan import/padam yang sudah berjaya.
 * @param {{tindakan:string, iso:string, bilKelas:number, hadir:number, jumlah:number, dibetulkan?:number, catatan?:string}} r
 */
function tulisLog_(r) {
  try {
    const emel = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '';
    tabLog_().appendRow([
      new Date(),
      emel,
      r.tindakan,
      r.iso ? r.iso.split('-').reverse().join('/') : '',
      r.bilKelas || 0,
      r.hadir || 0,
      r.jumlah || 0,
      r.dibetulkan == null ? '' : r.dibetulkan,
      teksSelamat_(String(r.catatan || '').slice(0, 200)),
    ]);
  } catch (e) {
    Logger.log('Gagal tulis log: ' + (e && e.message ? e.message : e));
  }
}

/**
 * Tukar baris tab Log (nilai sudah dalam bentuk teks/nombor) kepada objek,
 * terbaru dahulu, paling banyak `had` rekod. Tiada panggilan ke Sheet.
 * @param {Array<Array>} baris [masaTeks, pengguna, tindakan, tarikhData, kelas, hadir, jumlah, dibetulkan, catatan]
 */
function susunSejarah_(baris, had) {
  const out = [];
  baris.forEach(function (r, i) {
    if (!r[0] && !r[2]) return;
    out.push({
      _i: i,
      masa: String(r[0] || ''),
      pengguna: String(r[1] || ''),
      tindakan: String(r[2] || ''),
      tarikh: String(r[3] || ''),
      bilKelas: Number(r[4]) || 0,
      hadir: Number(r[5]) || 0,
      jumlah: Number(r[6]) || 0,
      dibetulkan: r[7] === '' || r[7] == null ? null : Number(r[7]),
      catatan: String(r[8] || ''),
    });
  });
  // masa dalam format 'yyyy-MM-dd HH:mm' -> susun teks = susun masa.
  // Masa sama (minit yang sama): baris kemudian dalam tab Log = lebih baru.
  out.sort(function (a, b) { return a.masa < b.masa ? 1 : a.masa > b.masa ? -1 : b._i - a._i; });
  return out.slice(0, had || HAD_SEJARAH).map(function (o) { delete o._i; return o; });
}

/** Dipanggil dari App.html (admin sahaja). */
function getSejarah() {
  const a = semakAkses_(true);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const sh = ss.getSheetByName(TAB_LOG);
  let baris = [];
  if (sh && sh.getLastRow() > 1) {
    baris = sh.getRange(2, 1, sh.getLastRow() - 1, HEADER_LOG.length).getValues().map(function (r) {
      const m = r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd HH:mm') : String(r[0]);
      const t = r[3] instanceof Date ? Utilities.formatDate(r[3], tz, 'dd/MM/yyyy') : String(r[3]);
      return [m, r[1], r[2], t, r[4], r[5], r[6], r[7], r[8]];
    });
  }
  const td = tabData_();
  const tarikhSemua = senaraiTarikh_(bacaData_(td));
  return {
    email: a.emel,
    peranan: a.peranan,
    kemaskini: tarikhSemua[0] || null,
    tarikhSemua: tarikhSemua,
    rekod: susunSejarah_(baris, HAD_SEJARAH),
    jumlahRekod: baris.length,
  };
}
