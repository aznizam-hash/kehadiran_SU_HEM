/**
 * Data untuk web app dashboard (App.html).
 * Semua fungsi pulang objek ringkas (tiada Date) untuk google.script.run.
 */

const SASARAN_KPI = 0.95;

const NOMBOR_TINGKATAN_ = { SATU: '1', DUA: '2', TIGA: '3', EMPAT: '4', LIMA: '5', ENAM: '6' };

/** "TINGKATAN SATU" -> "T1", "TINGKATAN ENAM SEM 1" -> "T6 Sem 1", "KELAS KHAS MENENGAH" -> "KKM". */
function labelTingkatan_(t) {
  const s = String(t).toUpperCase().replace(/\s+/g, ' ').trim();
  if (s === 'KELAS KHAS MENENGAH') return 'KKM';
  const m = /^TINGKATAN (SATU|DUA|TIGA|EMPAT|LIMA|ENAM)(.*)$/.exec(s);
  if (!m) return String(t);
  const baki = m[2].replace(/\b([A-Z])([A-Z]+)\b/g, function (_, a, b) { return a + b.toLowerCase(); });
  return 'T' + NOMBOR_TINGKATAN_[m[1]] + baki;
}

/** Baca tab Data -> [{iso, tingkatan, kelas, hadir, jumlah}] mengikut susunan dalam Sheet. */
function bacaData_(td) {
  const sheet = td.sheet;
  const maxRows = sheet.getMaxRows();
  if (maxRows < 2) return [];
  const nilai = sheet.getRange(2, 1, maxRows - 1, 5).getValues();
  const rows = [];
  nilai.forEach(function (r) {
    const v = r[0];
    if (v === '' || v === null) return;
    rows.push({
      iso: v instanceof Date ? Utilities.formatDate(v, td.tz, 'yyyy-MM-dd') : String(v),
      tingkatan: String(r[1]),
      kelas: String(r[2]),
      hadir: Number(r[3]) || 0,
      jumlah: Number(r[4]) || 0,
    });
  });
  return rows;
}

/**
 * Ringkasan untuk satu tarikh. Tiada panggilan ke Sheet (boleh diuji dengan Node).
 * Jika tarikhIso kosong atau tiada dalam data, guna tarikh terkini.
 */
function ringkasDashboard_(rows, tarikhIso, kpi) {
  const set = {};
  rows.forEach(function (r) { set[r.iso] = true; });
  const tarikhSemua = Object.keys(set).sort().reverse();
  const iso = tarikhIso && set[tarikhIso] ? tarikhIso : (tarikhSemua[0] || null);

  const kelas = rows
    .filter(function (r) { return r.iso === iso && r.jumlah > 0; })
    .map(function (r) {
      return {
        tingkatan: r.tingkatan,
        label: labelTingkatan_(r.tingkatan),
        kelas: r.kelas,
        hadir: r.hadir,
        jumlah: r.jumlah,
        peratus: r.hadir / r.jumlah,
      };
    });

  // Kumpul per tingkatan, ikut susunan pertama muncul (susunan IDME: T1..T5, KKM, T6).
  const tingkatan = [];
  const indeks = {};
  kelas.forEach(function (k) {
    if (!(k.tingkatan in indeks)) {
      indeks[k.tingkatan] = tingkatan.length;
      tingkatan.push({ nama: k.tingkatan, label: k.label, hadir: 0, jumlah: 0, bilKelas: 0 });
    }
    const t = tingkatan[indeks[k.tingkatan]];
    t.hadir += k.hadir;
    t.jumlah += k.jumlah;
    t.bilKelas++;
  });
  tingkatan.forEach(function (t) { t.peratus = t.hadir / t.jumlah; });

  const hadir = kelas.reduce(function (s, k) { return s + k.hadir; }, 0);
  const jumlah = kelas.reduce(function (s, k) { return s + k.jumlah; }, 0);
  const capai = kelas.filter(function (k) { return k.peratus >= kpi; }).length;

  const perhatian = kelas
    .filter(function (k) { return k.peratus < kpi; })
    .sort(function (a, b) { return a.peratus - b.peratus; });

  return {
    kpi: kpi,
    tarikhSemua: tarikhSemua,
    tarikh: iso,
    kemaskini: tarikhSemua[0] || null,
    ringkasan: {
      hadir: hadir,
      jumlah: jumlah,
      tidakHadir: jumlah - hadir,
      peratus: jumlah ? hadir / jumlah : null,
      bilKelas: kelas.length,
      kelasCapai: capai,
      kelasBelum: kelas.length - capai,
      bilTingkatan: tingkatan.length,
    },
    tingkatan: tingkatan,
    perhatian: perhatian,
  };
}

/** Dipanggil dari App.html. */
function getDashboard(tarikhIso) {
  const td = tabData_();
  const d = ringkasDashboard_(bacaData_(td), tarikhIso, SASARAN_KPI);
  d.email = Session.getActiveUser().getEmail();
  return d;
}
