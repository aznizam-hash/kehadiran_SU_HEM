/**
 * Data untuk web app dashboard (App.html).
 * Semua fungsi pulang objek ringkas (tiada Date) untuk google.script.run.
 */

// Sasaran KPI kini dibaca dari tab Tetapan (lihat Tetapan.gs, bacaTetapan_).

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
 * Kumpul baris kepada kelas (tingkatan + kelas), jumlahkan hadir/jumlah
 * merentas tarikh. Susunan ikut kali pertama muncul (susunan IDME).
 */
function kumpulKelas_(rows) {
  const kelas = [];
  const indeks = {};
  rows.forEach(function (r) {
    if (!(r.jumlah > 0)) return;
    const kunci = r.tingkatan + '|' + r.kelas;
    if (!(kunci in indeks)) {
      indeks[kunci] = kelas.length;
      kelas.push({ tingkatan: r.tingkatan, label: labelTingkatan_(r.tingkatan), kelas: r.kelas,
        hadir: 0, jumlah: 0, bilHari: 0 });
    }
    const k = kelas[indeks[kunci]];
    k.hadir += r.hadir;
    k.jumlah += r.jumlah;
    k.bilHari++;
  });
  kelas.forEach(function (k) { k.peratus = k.hadir / k.jumlah; });
  return kelas;
}

/** Kumpul kelas kepada tingkatan (purata berwajaran), ikut susunan pertama muncul. */
function kumpulTingkatan_(kelas, kpi) {
  const tingkatan = [];
  const indeks = {};
  kelas.forEach(function (k) {
    if (!(k.tingkatan in indeks)) {
      indeks[k.tingkatan] = tingkatan.length;
      tingkatan.push({ nama: k.tingkatan, label: k.label, hadir: 0, jumlah: 0, bilKelas: 0, bilBawah: 0 });
    }
    const t = tingkatan[indeks[k.tingkatan]];
    t.hadir += k.hadir;
    t.jumlah += k.jumlah;
    t.bilKelas++;
    if (k.peratus < kpi) t.bilBawah++;
  });
  tingkatan.forEach(function (t) { t.peratus = t.hadir / t.jumlah; });
  return tingkatan;
}

function senaraiTarikh_(rows) {
  const set = {};
  rows.forEach(function (r) { set[r.iso] = true; });
  return Object.keys(set).sort().reverse();
}

/**
 * Ringkasan untuk satu tarikh. Tiada panggilan ke Sheet (boleh diuji dengan Node).
 * Jika tarikhIso kosong atau tiada dalam data, guna tarikh terkini.
 */
function ringkasDashboard_(rows, tarikhIso, kpi) {
  const tarikhSemua = senaraiTarikh_(rows);
  const iso = tarikhIso && tarikhSemua.indexOf(tarikhIso) >= 0 ? tarikhIso : (tarikhSemua[0] || null);

  const kelas = kumpulKelas_(rows.filter(function (r) { return r.iso === iso; }));
  const tingkatan = kumpulTingkatan_(kelas, kpi);

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
  const a = semakAkses_(false);
  const td = tabData_();
  const t = bacaTetapan_();
  const d = ringkasDashboard_(bacaData_(td), tarikhIso, t.kpi);
  d.email = a.emel;
  d.peranan = a.peranan;
  d.namaSekolah = t.namaSekolah;
  return d;
}

/**
 * Analisis kelas untuk satu tempoh: 'semua' (semua tarikh) atau satu tarikh (yyyy-mm-dd).
 * Tempoh yang tiada dalam data dianggap 'semua'.
 */
function ringkasAnalisis_(rows, tempoh, kpi) {
  const tarikhSemua = senaraiTarikh_(rows);
  const t = tempoh && tempoh !== 'semua' && tarikhSemua.indexOf(tempoh) >= 0 ? tempoh : 'semua';
  const dipilih = t === 'semua' ? rows : rows.filter(function (r) { return r.iso === t; });
  const kelas = kumpulKelas_(dipilih);
  const tingkatan = kumpulTingkatan_(kelas, kpi);
  const hadir = kelas.reduce(function (s, k) { return s + k.hadir; }, 0);
  const jumlah = kelas.reduce(function (s, k) { return s + k.jumlah; }, 0);
  const hari = senaraiTarikh_(dipilih);
  return {
    kpi: kpi,
    tarikhSemua: tarikhSemua,
    kemaskini: tarikhSemua[0] || null,
    tempoh: t,
    ringkasan: {
      hadir: hadir,
      jumlah: jumlah,
      peratus: jumlah ? hadir / jumlah : null,
      bilHari: hari.length,
      dari: hari[hari.length - 1] || null,
      hingga: hari[0] || null,
      bilKelas: kelas.length,
      bilBawah: kelas.filter(function (k) { return k.peratus < kpi; }).length,
    },
    tingkatan: tingkatan,
    kelas: kelas,
  };
}

/** Dipanggil dari App.html. */
function getAnalisis(tempoh) {
  const a = semakAkses_(false);
  const td = tabData_();
  const t = bacaTetapan_();
  const d = ringkasAnalisis_(bacaData_(td), tempoh, t.kpi);
  d.email = a.emel;
  d.peranan = a.peranan;
  d.namaSekolah = t.namaSekolah;
  return d;
}

/**
 * Trend kehadiran mengikut tarikh.
 * julat : '7' | '30' | 'semua'  -> bilangan HARI DATA terakhir (bukan hari kalendar).
 * pilih : ''                      -> sekolah sahaja
 *         'T:<tingkatan>'         -> satu tingkatan
 *         'K:<tingkatan>|<kelas>' -> satu kelas
 * Pilihan yang tiada dalam data diabaikan ('').
 */
function ringkasTrend_(rows, julat, pilih, kpi) {
  const tarikhSemua = senaraiTarikh_(rows);
  const j = julat === '7' || julat === '30' ? julat : 'semua';
  const tarikhJulat = (j === 'semua' ? tarikhSemua : tarikhSemua.slice(0, Number(j))).slice().reverse();

  // Senarai pilihan dari semua data (susunan IDME).
  const semuaKelas = kumpulKelas_(rows);
  const tingkatan = kumpulTingkatan_(semuaKelas, kpi).map(function (t) { return { nilai: 'T:' + t.nama, label: t.label, nama: t.nama }; });
  const kelas = semuaKelas.map(function (k) {
    return { nilai: 'K:' + k.tingkatan + '|' + k.kelas, label: k.label, kelas: k.kelas, tingkatan: k.tingkatan };
  });
  const sah = {};
  tingkatan.concat(kelas).forEach(function (x) { sah[x.nilai] = true; });
  const p = pilih && sah[pilih] ? pilih : '';

  const padan = function (r) {
    if (!p) return false;
    if (p.indexOf('T:') === 0) return r.tingkatan === p.slice(2);
    return r.tingkatan + '|' + r.kelas === p.slice(2);
  };

  const ikutTarikh = {};
  tarikhJulat.forEach(function (iso) { ikutTarikh[iso] = { iso: iso, sh: 0, sj: 0, ph: 0, pj: 0 }; });
  rows.forEach(function (r) {
    const t = ikutTarikh[r.iso];
    if (!t || !(r.jumlah > 0)) return;
    t.sh += r.hadir; t.sj += r.jumlah;
    if (padan(r)) { t.ph += r.hadir; t.pj += r.jumlah; }
  });

  const siri = tarikhJulat.map(function (iso) {
    const t = ikutTarikh[iso];
    return {
      iso: iso,
      sekolah: { hadir: t.sh, jumlah: t.sj, peratus: t.sj ? t.sh / t.sj : null },
      pilihan: p && t.pj ? { hadir: t.ph, jumlah: t.pj, peratus: t.ph / t.pj } : null,
    };
  });

  const purata = function (kunci) {
    let h = 0, n = 0;
    siri.forEach(function (s) { if (s[kunci]) { h += s[kunci].hadir; n += s[kunci].jumlah; } });
    return n ? h / n : null;
  };
  const adaSekolah = siri.filter(function (s) { return s.sekolah.peratus != null; });
  const tinggi = adaSekolah.reduce(function (a, s) { return !a || s.sekolah.peratus > a.sekolah.peratus ? s : a; }, null);
  const rendah = adaSekolah.reduce(function (a, s) { return !a || s.sekolah.peratus < a.sekolah.peratus ? s : a; }, null);

  let labelPilihan = '';
  if (p.indexOf('T:') === 0) labelPilihan = labelTingkatan_(p.slice(2));
  else if (p) { const k = p.slice(2).split('|'); labelPilihan = k[1] + ' (' + labelTingkatan_(k[0]) + ')'; }

  return {
    kpi: kpi,
    tarikhSemua: tarikhSemua,
    kemaskini: tarikhSemua[0] || null,
    julat: j,
    pilih: p,
    labelPilihan: labelPilihan,
    senaraiPilihan: { tingkatan: tingkatan, kelas: kelas },
    siri: siri,
    ringkasan: {
      bilHari: siri.length,
      purataSekolah: purata('sekolah'),
      purataPilihan: p ? purata('pilihan') : null,
      tertinggi: tinggi ? { iso: tinggi.iso, peratus: tinggi.sekolah.peratus } : null,
      terendah: rendah ? { iso: rendah.iso, peratus: rendah.sekolah.peratus } : null,
      hariCapai: adaSekolah.filter(function (s) { return s.sekolah.peratus >= kpi; }).length,
    },
  };
}

/** Dipanggil dari App.html. */
function getTrend(julat, pilih) {
  const a = semakAkses_(false);
  const td = tabData_();
  const t = bacaTetapan_();
  const d = ringkasTrend_(bacaData_(td), julat, pilih, t.kpi);
  d.email = a.emel;
  d.peranan = a.peranan;
  d.namaSekolah = t.namaSekolah;
  return d;
}
