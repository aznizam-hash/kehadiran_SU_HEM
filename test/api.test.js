// Uji ringkasDashboard_ dan labelTingkatan_: node test/api.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Api.gs'), 'utf8') +
  '\nthis.ringkas = ringkasDashboard_; this.label = labelTingkatan_; this.analisis = ringkasAnalisis_;', ctx);

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

console.log('api.test.js: semua lulus');
