/**
 * Dashboard Kehadiran Murid (SEMARAK HEM)
 * Upload CSV kehadiran harian dari IDME ke tab Data.
 *
 * Script ini mesti container-bound (Extensions > Apps Script dari dalam
 * fail Google Sheet "Dashboard Kehadiran").
 */

const TAB_DATA = 'Data';
const TAB_DASHBOARD = 'Dashboard';
const HEADER_CSV = ['Bil.', 'Tahun/Tingkatan', 'Kelas', 'Kehadiran', 'Jumlah Pelajar'];
const HEADER_DATA = ['Tarikh', 'Tingkatan', 'Kelas', 'Hadir', 'Jumlah', 'Peratus'];
const FORMULA_PERATUS = '=ARRAYFORMULA(IF(E2:E="","",D2:D/E2:E))';
const SAIZ_CSV_MAKS = 1024 * 1024; // 1 MB, jauh melebihi saiz fail sebenar (~3 KB)

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

/**
 * Sediakan tab Data dan Dashboard. Berhenti jika tab Data sudah ada data.
 * Selamat dijalankan lebih dari sekali, tapi tak perlu selepas data masuk.
 */
function setupSistem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let data = ss.getSheetByName(TAB_DATA);

  if (data && data.getMaxRows() > 1 &&
      data.getRange(2, 1, data.getMaxRows() - 1, 1).getValues().some(function (r) { return r[0] !== ''; })) {
    throw new Error('Tab Data sudah ada data. setupSistem() dihentikan supaya tiada data terjejas.');
  }

  if (!data) data = ss.insertSheet(TAB_DATA);
  data.clear();
  data.getRange(1, 1, 1, HEADER_DATA.length).setValues([HEADER_DATA]).setFontWeight('bold');
  data.getRange('F2').setFormula(FORMULA_PERATUS);
  data.getRange('A2:A').setNumberFormat('dd/mm/yyyy');
  data.getRange('D2:E').setNumberFormat('0');
  data.getRange('F2:F').setNumberFormat('0.00%');
  data.setFrozenRows(1);

  if (!ss.getSheetByName(TAB_DASHBOARD)) {
    const dash = ss.insertSheet(TAB_DASHBOARD);
    dash.getRange('A1').setValue('Dashboard akan dibina kemudian.');
  }

  Logger.log('Setup selesai. Zon masa Sheet: ' + ss.getSpreadsheetTimeZone());
}

/* ------------------------------------------------------------------ */
/* Parser (tiada panggilan ke Sheet, boleh diuji di luar Apps Script) */
/* ------------------------------------------------------------------ */

/** Pecahkan satu baris CSV. Sokong medan dalam tanda petik. */
function pecahBarisCsv_(baris) {
  const medan = [];
  let semasa = '';
  let dalamPetik = false;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (dalamPetik) {
      if (c === '"' && baris[i + 1] === '"') { semasa += '"'; i++; }
      else if (c === '"') dalamPetik = false;
      else semasa += c;
    } else if (c === '"') {
      dalamPetik = true;
    } else if (c === ',') {
      medan.push(semasa);
      semasa = '';
    } else {
      semasa += c;
    }
  }
  medan.push(semasa);
  return medan.map(function (m) { return m.trim(); });
}

/** Elak formula injection bila teks ditulis ke Sheet. */
function teksSelamat_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/**
 * Parse teks CSV dari IDME.
 * @return {{rows: Array<{tingkatan:string,kelas:string,hadir:number,jumlah:number}>,
 *           gagal: Array<{baris:number,kandungan:string,sebab:string}>}}
 *         Jika header tak sepadan, rows kosong dan gagal mengandungi satu entri.
 */
function parseKehadiran(csvText) {
  const rows = [];
  const gagal = [];

  if (typeof csvText !== 'string' || csvText.length === 0) {
    gagal.push({ baris: 0, kandungan: '', sebab: 'Fail kosong.' });
    return { rows: rows, gagal: gagal };
  }

  const teks = csvText.replace(/^﻿/, '');
  const baris = teks.split(/\r\n|\n|\r/);

  // Cari baris header (baris pertama yang tak kosong).
  let iHeader = 0;
  while (iHeader < baris.length && baris[iHeader].trim() === '') iHeader++;
  const header = iHeader < baris.length ? pecahBarisCsv_(baris[iHeader]) : [];
  const headerSama = header.length === HEADER_CSV.length &&
    HEADER_CSV.every(function (h, i) { return header[i] === h; });
  if (!headerSama) {
    gagal.push({
      baris: iHeader + 1,
      kandungan: (baris[iHeader] || '').slice(0, 200),
      sebab: 'Header tidak sepadan. Dijangka: ' + HEADER_CSV.join(','),
    });
    return { rows: rows, gagal: gagal };
  }

  const kunciDilihat = {};
  for (let i = iHeader + 1; i < baris.length; i++) {
    const asal = baris[i];
    const medan = pecahBarisCsv_(asal);
    if (medan.every(function (m) { return m === ''; })) continue; // baris kosong / ",,,,"

    const noBaris = i + 1;
    const kandungan = asal.slice(0, 200);
    const tolak = function (sebab) { gagal.push({ baris: noBaris, kandungan: kandungan, sebab: sebab }); };

    if (medan.length !== HEADER_CSV.length) { tolak('Bilangan lajur ' + medan.length + ', dijangka 5.'); continue; }

    const tingkatan = medan[1].replace(/\s+/g, ' ').toUpperCase();
    const kelas = medan[2].replace(/\s+/g, ' ').toUpperCase();
    if (!tingkatan) { tolak('Tahun/Tingkatan kosong.'); continue; }
    if (!kelas) { tolak('Kelas kosong.'); continue; }

    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(medan[4]);
    if (!m) { tolak('Jumlah Pelajar bukan format hadir/jumlah: "' + medan[4] + '".'); continue; }
    const hadir = parseInt(m[1], 10);
    const jumlah = parseInt(m[2], 10);
    if (jumlah === 0) { tolak('Jumlah pelajar 0.'); continue; }
    if (hadir > jumlah) { tolak('Hadir (' + hadir + ') melebihi jumlah (' + jumlah + ').'); continue; }

    const kunci = tingkatan + '|' + kelas;
    if (kunciDilihat[kunci]) { tolak('Kelas berulang dalam fail (pertama di baris ' + kunciDilihat[kunci] + ').'); continue; }
    kunciDilihat[kunci] = noBaris;

    rows.push({ tingkatan: tingkatan, kelas: kelas, hadir: hadir, jumlah: jumlah });
  }

  if (rows.length === 0 && gagal.length === 0) {
    gagal.push({ baris: 0, kandungan: '', sebab: 'Tiada baris data dalam fail.' });
  }
  return { rows: rows, gagal: gagal };
}

/* ------------------------------------------------------------------ */
/* Simpan ke Sheet                                                     */
/* ------------------------------------------------------------------ */

/** Semak tarikhIso (yyyy-mm-dd) wujud dan bukan tarikh akan datang. */
function semakTarikh_(tarikhIso, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tarikhIso))) throw new Error('Format tarikh tidak sah.');
  const t = Utilities.parseDate(tarikhIso, tz, 'yyyy-MM-dd');
  if (Utilities.formatDate(t, tz, 'yyyy-MM-dd') !== tarikhIso) throw new Error('Tarikh tidak wujud: ' + tarikhIso);
  const hariIni = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  if (tarikhIso > hariIni) throw new Error('Tarikh ' + tarikhIso + ' belum tiba.');
  return t;
}

/**
 * Tulis semua baris sekali gus. Tolak jika tarikh sudah ada dalam tab Data.
 * Lajur F tidak ditulis (diisi oleh ARRAYFORMULA di F2).
 * @return {number} bilangan baris ditulis
 */
function simpanKehadiran(tarikhIso, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TAB_DATA);
  if (!sheet) throw new Error('Tab Data tiada. Jalankan setupSistem() dahulu.');
  if (!rows || rows.length === 0) throw new Error('Tiada baris untuk disimpan.');

  const tz = ss.getSpreadsheetTimeZone();
  const tarikh = semakTarikh_(tarikhIso, tz);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Baca lajur A untuk cari baris terakhir dan semak tarikh berulang.
    // (getLastRow() tak digunakan kerana ARRAYFORMULA di F boleh mengelirukan.)
    const maxRows = sheet.getMaxRows();
    const lajurA = maxRows > 1 ? sheet.getRange(2, 1, maxRows - 1, 1).getValues() : [];
    let barisAkhir = 1;
    for (let i = 0; i < lajurA.length; i++) {
      const v = lajurA[i][0];
      if (v === '' || v === null) continue;
      barisAkhir = i + 2;
      const iso = v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v);
      if (iso === tarikhIso) {
        throw new Error('Data untuk ' + Utilities.formatDate(tarikh, tz, 'dd/MM/yyyy') +
          ' sudah ada (baris ' + (i + 2) + '). Upload ditolak, tiada data ditimpa.');
      }
    }

    const nilai = rows.map(function (r) {
      return [tarikh, teksSelamat_(r.tingkatan), teksSelamat_(r.kelas), r.hadir, r.jumlah];
    });

    const perlu = barisAkhir + nilai.length;
    if (perlu > maxRows) sheet.insertRowsAfter(maxRows, perlu - maxRows);

    const julat = sheet.getRange(barisAkhir + 1, 1, nilai.length, 5);
    julat.setValues(nilai);
    sheet.getRange(barisAkhir + 1, 1, nilai.length, 1).setNumberFormat('dd/mm/yyyy');
    SpreadsheetApp.flush();
    return nilai.length;
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

/** Dipanggil dari Index.html. Pulang objek ringkas (tiada Date). */
function prosesUpload(tarikhIso, csvText) {
  try {
    if (typeof csvText !== 'string') throw new Error('Kandungan fail tidak diterima.');
    if (csvText.length > SAIZ_CSV_MAKS) throw new Error('Fail terlalu besar (had 1 MB).');

    const hasil = parseKehadiran(csvText);
    if (hasil.gagal.length > 0) {
      return {
        ok: false,
        mesej: 'Upload dibatalkan. ' + hasil.gagal.length + ' baris bermasalah. Tiada data disimpan.',
        gagal: hasil.gagal,
      };
    }

    const n = simpanKehadiran(tarikhIso, hasil.rows);
    const jumHadir = hasil.rows.reduce(function (s, r) { return s + r.hadir; }, 0);
    const jumMurid = hasil.rows.reduce(function (s, r) { return s + r.jumlah; }, 0);
    const [y, m, d] = tarikhIso.split('-');
    return {
      ok: true,
      mesej: 'Berjaya: ' + n + ' kelas disimpan untuk ' + d + '/' + m + '/' + y +
        '. Kehadiran keseluruhan ' + jumHadir + '/' + jumMurid +
        ' (' + (100 * jumHadir / jumMurid).toFixed(2) + '%).',
      gagal: [],
    };
  } catch (e) {
    return { ok: false, mesej: String(e && e.message ? e.message : e), gagal: [] };
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Upload Kehadiran')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ------------------------------------------------------------------ */
/* Ujian                                                               */
/* ------------------------------------------------------------------ */

/** Uji parser dengan contoh kecil. Tidak menulis ke Sheet. */
function testParse() {
  const contoh = '﻿Bil.,Tahun/Tingkatan,Kelas,Kehadiran,Jumlah Pelajar\r\n' +
    ',,,,\r\n' +
    '1,TINGKATAN SATU,AMANAH,Kehadiran,22/23\r\n' +
    ',,,,\r\n' +
    '2,TINGKATAN SATU,BESTARI,Kehadiran,20/24\r\n';
  const hasil = parseKehadiran(contoh);
  Logger.log(JSON.stringify(hasil, null, 2));
  if (hasil.rows.length !== 2 || hasil.gagal.length !== 0) throw new Error('testParse GAGAL');
  Logger.log('testParse LULUS');
}
