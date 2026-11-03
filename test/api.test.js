// Uji ringkasDashboard_ dan labelTingkatan_: node test/api.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Api.gs'), 'utf8') +
  '\nthis.ringkas = ringkasDashboard_; this.label = labelTingkatan_;', ctx);

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
console.log('api.test.js: semua lulus');
