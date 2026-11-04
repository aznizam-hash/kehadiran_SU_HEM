// Uji ringkasDashboard_ dan labelTingkatan_: node test/api.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Api.gs'), 'utf8') +
  '\nthis.ringkas = ringkasDashboard_; this.label = labelTingkatan_; this.analisis = ringkasAnalisis_; this.trend = ringkasTrend_; this.laporan = ringkasLaporan_;', ctx);

assert.strictEqual(ctx.label('TINGKATAN SATU'), 'T1');
assert.strictEqual(ctx.label('TINGKATAN ENAM SEM 1'), 'T6 Sem 1');
assert.strictEqual(ctx.label('KELAS KHAS MENENGAH'), 'KKM');
assert.strictEqual(ctx.label('PERALIHAN'), 'PERALIHAN');

const r = (iso, t, k, h, j) => ({ iso, tingkatan: t, kelas: k, hadir: h, jumlah: j });
const rows = [
  r('2026-10-29', 'TINGKATAN SATU', 'A', 10, 10),
  r('2026-10-30', 'TINGKATAN SATU', 'A', 19, 20),   // 95% tepat -> capai
  r('2026-10-30', 'TINGKATAN SATU', 'B', 12, 18),
  r('2026-10-30', 'TINGKATAN DUA', 'A', 9, 10),
];
let d = ctx.ringkas(rows, null, 0.95);
assert.strictEqual(d.tarikh, '2026-10-30');
assert.strictEqual(JSON.stringify(d.tarikhSemua), JSON.stringify(['2026-10-30', '2026-10-29']));
assert.strictEqual(d.ringkasan.hadir, 40);
assert.strictEqual(d.ringkasan.jumlah, 48);
assert.strictEqual(d.ringkasan.tidakHadir, 8);
assert.strictEqual(d.ringkasan.kelasCapai, 1);
assert.strictEqual(d.ringkasan.kelasBelum, 2);
assert.strictEqual(d.ringkasan.bilTingkatan, 2);
assert.strictEqual(d.tingkatan.map((t) => t.label).join(','), 'T1,T2');
assert.strictEqual(d.perhatian.map((k) => k.kelas).join(','), 'B,A');

d = ctx.ringkas(rows, '2026-10-29', 0.95);
assert.strictEqual(d.ringkasan.peratus, 1);
d = ctx.ringkas(rows, '2020-01-01', 0.95);   // tarikh tiada -> terkini
assert.strictEqual(d.tarikh, '2026-10-30');
d = ctx.ringkas([], null, 0.95);
assert.strictEqual(d.tarikh, null);
assert.strictEqual(d.ringkasan.peratus, null);

// Analisis: semua tarikh = purata berwajaran merentas hari
let a = ctx.analisis(rows, 'semua', 0.95);
assert.strictEqual(a.tempoh, 'semua');
assert.strictEqual(a.ringkasan.bilHari, 2);
assert.strictEqual(a.ringkasan.dari, '2026-10-29');
assert.strictEqual(a.ringkasan.hingga, '2026-10-30');
const t1a = a.kelas.find((k) => k.tingkatan === 'TINGKATAN SATU' && k.kelas === 'A');
assert.strictEqual(`${t1a.hadir}/${t1a.jumlah}/${t1a.bilHari}`, '29/30/2');   // 10/10 + 19/20
assert.strictEqual(a.kelas.length, 3);
const t1 = a.tingkatan[0];
assert.strictEqual(`${t1.label} ${t1.hadir}/${t1.jumlah} kelas=${t1.bilKelas} bawah=${t1.bilBawah}`, 'T1 41/48 kelas=2 bawah=1');
assert.strictEqual(a.ringkasan.bilBawah, 2);   // T1 B (66.7%), T2 A (90%)

a = ctx.analisis(rows, '2026-10-29', 0.95);
assert.strictEqual(a.tempoh, '2026-10-29');
assert.strictEqual(a.kelas.length, 1);
a = ctx.analisis(rows, '1999-01-01', 0.95);   // tiada -> semua
assert.strictEqual(a.tempoh, 'semua');
a = ctx.analisis([], 'semua', 0.95);
assert.strictEqual(a.ringkasan.peratus, null);
assert.strictEqual(a.kelas.length, 0);


// Trend
const tr = [];
['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'].forEach((iso, i) => {
  tr.push(r(iso, 'TINGKATAN SATU', 'A', 15 + i, 20));
  tr.push(r(iso, 'TINGKATAN DUA', 'A', 20, 20));
});
let t = ctx.trend(tr, 'semua', '', 0.95);
assert.strictEqual(t.siri.length, 5);
assert.strictEqual(t.siri[0].iso, '2026-10-26');            // menaik
assert.strictEqual(t.siri[0].sekolah.peratus, 35 / 40);
assert.strictEqual(t.siri[0].pilihan, null);
assert.strictEqual(t.ringkasan.purataSekolah, (35 + 36 + 37 + 38 + 39) / 200);
assert.strictEqual(t.ringkasan.tertinggi.iso, '2026-10-30');
assert.strictEqual(t.ringkasan.terendah.iso, '2026-10-26');
assert.strictEqual(t.senaraiPilihan.tingkatan.length, 2);
assert.strictEqual(t.senaraiPilihan.kelas.length, 2);

t = ctx.trend(tr, '7', 'K:TINGKATAN SATU|A', 0.95);
assert.strictEqual(t.pilih, 'K:TINGKATAN SATU|A');
assert.strictEqual(t.labelPilihan, 'A (T1)');
assert.strictEqual(t.siri[4].pilihan.peratus, 19 / 20);
assert.strictEqual(t.ringkasan.purataPilihan, 85 / 100);

t = ctx.trend(tr, '30', 'T:TINGKATAN DUA', 0.95);
assert.strictEqual(t.labelPilihan, 'T2');
assert.strictEqual(t.ringkasan.purataPilihan, 1);
assert.strictEqual(t.ringkasan.hariCapai, 2);   // 38/40 (tepat 95%) dan 39/40

// julat 7 ambil 7 hari DATA terakhir
const banyak = [];
for (let i = 1; i <= 10; i++) banyak.push(r('2026-10-' + String(i).padStart(2, '0'), 'TINGKATAN SATU', 'A', 19, 20));
t = ctx.trend(banyak, '7', 'K:TIADA|X', 0.95);
assert.strictEqual(t.siri.length, 7);
assert.strictEqual(t.siri[0].iso, '2026-10-04');
assert.strictEqual(t.pilih, '');                          // pilihan tak sah diabaikan
t = ctx.trend([], 'semua', '', 0.95);
assert.strictEqual(t.siri.length, 0);
assert.strictEqual(t.ringkasan.purataSekolah, null);


// Laporan
let L = ctx.laporan(tr, '2026-10-27', '2026-10-29', 0.95);
assert.strictEqual(L.ringkasan.bilHari, 3);
assert.strictEqual(`${L.ringkasan.hadir}/${L.ringkasan.jumlah}`, `${(16 + 17 + 18) + 60}/120`);
assert.strictEqual(L.harian.map((h) => h.iso).join(','), '2026-10-27,2026-10-28,2026-10-29');
assert.strictEqual(L.ringkasan.hariCapai, 1);                 // hanya 29/10 = 38/40 = 95%
assert.strictEqual(L.bawahKpi.map((k) => k.kelas + '/' + k.tingkatan).join(','), 'A/TINGKATAN SATU');
assert.strictEqual(L.kelas.map((k) => k.tingkatan).join(','), 'TINGKATAN SATU,TINGKATAN DUA');   // semua kelas, susunan asal
L = ctx.laporan(tr, null, null, 0.95);                         // lalai: tarikh terkini sahaja
assert.strictEqual(L.dari + '|' + L.hingga, '2026-10-30|2026-10-30');
L = ctx.laporan(tr, '2026-10-30', '2026-10-26', 0.95);         // terbalik -> ditukar
assert.strictEqual(L.dari + '|' + L.ringkasan.bilHari, '2026-10-26|5');
L = ctx.laporan([], null, null, 0.95);
assert.strictEqual(L.ringkasan.peratus, null);
console.log('api.test.js: semua lulus');
