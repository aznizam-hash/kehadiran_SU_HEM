/**
 * Tetapan sistem yang boleh diubah oleh admin dari web app.
 * Disimpan dalam tab "Tetapan": A Kunci | B Nilai | C Keterangan.
 * Jika tab tiada atau nilai tidak sah, nilai lalai digunakan.
 */

const TAB_TETAPAN = 'Tetapan';
const TETAPAN_LALAI = { kpi: 0.95, namaSekolah: '' };
const KPI_MIN = 0.5;
const KPI_MAKS = 1;
const NAMA_SEKOLAH_MAKS = 80;

/** Tukar nilai KPI dalam pelbagai bentuk (0.95, 95, "95%") kepada pecahan. Pulang null jika tidak sah. */
function tafsirKpi_(v) {
  if (v === '' || v == null) return null;
  let n = typeof v === 'number' ? v : Number(String(v).replace('%', '').trim());
  if (!isFinite(n)) return null;
  if (n > 1) n = n / 100;               // 95 -> 0.95
  n = Math.round(n * 10000) / 10000;    // elak 0.9500000001
  return n >= KPI_MIN && n <= KPI_MAKS ? n : null;
}

/**
 * Baris tab Tetapan -> objek tetapan lengkap dengan nilai lalai. Tiada panggilan ke Sheet.
 * @param {Array<Array>} baris [[kunci, nilai, ...], ...] tanpa header
 */
function tafsirTetapan_(baris) {
  const t = { kpi: TETAPAN_LALAI.kpi, namaSekolah: TETAPAN_LALAI.namaSekolah };
  (baris || []).forEach(function (r) {
    const k = String(r[0] || '').trim();
    if (k === 'kpi') {
      const n = tafsirKpi_(r[1]);
      if (n != null) t.kpi = n;
    } else if (k === 'namaSekolah') {
      t.namaSekolah = String(r[1] == null ? '' : r[1]).trim().slice(0, NAMA_SEKOLAH_MAKS);
    }
  });
  return t;
}

/**
 * Sahkan input dari borang. Pulang {tetapan} atau {ralat}. Tiada panggilan ke Sheet.
 * @param {{kpiPeratus:*, namaSekolah:*}} input kpiPeratus dalam peratus (contoh 95)
 */
function sahkanTetapan_(input) {
  const i = input || {};
  const p = Number(i.kpiPeratus);
  if (!isFinite(p) || String(i.kpiPeratus).trim() === '') return { ralat: 'Sasaran KPI mesti nombor.' };
  if (p < KPI_MIN * 100 || p > KPI_MAKS * 100) {
    return { ralat: 'Sasaran KPI mesti antara ' + KPI_MIN * 100 + '% dan ' + KPI_MAKS * 100 + '%.' };
  }
  const nama = String(i.namaSekolah == null ? '' : i.namaSekolah).replace(/\s+/g, ' ').trim();
  if (nama.length > NAMA_SEKOLAH_MAKS) return { ralat: 'Nama sekolah terlalu panjang (had ' + NAMA_SEKOLAH_MAKS + ' aksara).' };
  return { tetapan: { kpi: Math.round(p * 100) / 10000, namaSekolah: nama } };
}

/** Teks ringkas perubahan untuk log, contoh: 'KPI 95% → 90%; Nama sekolah: "" → "SMK X"'. Kosong jika tiada perubahan. */
function bezaTetapan_(lama, baru) {
  const out = [];
  const pk = function (k) { return +(k * 100).toFixed(2) + '%'; };
  if (lama.kpi !== baru.kpi) out.push('KPI ' + pk(lama.kpi) + ' → ' + pk(baru.kpi));
  if (lama.namaSekolah !== baru.namaSekolah) out.push('Nama sekolah: "' + lama.namaSekolah + '" → "' + baru.namaSekolah + '"');
  return out.join('; ');
}

/** Baca tetapan semasa dari tab Tetapan (atau nilai lalai). */
function bacaTetapan_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_TETAPAN);
  if (!sh || sh.getLastRow() < 2) return tafsirTetapan_([]);
  return tafsirTetapan_(sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues());
}

function tulisTetapan_(t) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB_TETAPAN);
  if (!sh) {
    sh = ss.insertSheet(TAB_TETAPAN);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 140);
    sh.setColumnWidth(2, 260);
    sh.setColumnWidth(3, 360);
  }
  sh.clearContents();
  sh.getRange(1, 1, 3, 3).setValues([
    ['Kunci', 'Nilai', 'Keterangan'],
    ['kpi', t.kpi, 'Sasaran kehadiran (pecahan, 0.95 = 95%). Ubah melalui web app: Tetapan Sistem.'],
    ['namaSekolah', teksSelamat_(t.namaSekolah), 'Nama sekolah untuk paparan header dan laporan.'],
  ]);
  sh.getRange('A1:C1').setFontWeight('bold');
  sh.getRange('B2').setNumberFormat('0.00%');
}

/* ---------------- Web app (admin sahaja) ---------------- */

function getTetapan() {
  const a = semakAkses_(true);
  const td = tabData_();
  const tarikhSemua = senaraiTarikh_(bacaData_(td));
  const t = bacaTetapan_();
  return {
    email: a.emel, peranan: a.peranan, kemaskini: tarikhSemua[0] || null, tarikhSemua: tarikhSemua,
    kpi: t.kpi, namaSekolah: t.namaSekolah, tetapan: t,
    had: { kpiMin: KPI_MIN * 100, kpiMaks: KPI_MAKS * 100, namaMaks: NAMA_SEKOLAH_MAKS },
  };
}

/** @param {{kpiPeratus:number, namaSekolah:string}} input */
function simpanTetapan(input) {
  try {
    semakAkses_(true);
    const s = sahkanTetapan_(input);
    if (s.ralat) return { ok: false, mesej: s.ralat };
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const lama = bacaTetapan_();
      const beza = bezaTetapan_(lama, s.tetapan);
      if (!beza) return { ok: true, mesej: 'Tiada perubahan.', tetapan: lama };
      tulisTetapan_(s.tetapan);
      tulisLog_({ tindakan: 'Tetapan', catatan: beza });
      return { ok: true, mesej: 'Tetapan disimpan. ' + beza, tetapan: s.tetapan };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { ok: false, mesej: String(e && e.message ? e.message : e) };
  }
}
