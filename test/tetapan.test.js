// Uji fungsi pure Tetapan.gs: node test/tetapan.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Tetapan.gs'), 'utf8') +
  '\nthis.kpi = tafsirKpi_; this.tafsir = tafsirTetapan_; this.sahkan = sahkanTetapan_; this.beza = bezaTetapan_;', ctx);
const j = (x) => JSON.stringify(x);

// tafsirKpi_
assert.strictEqual(ctx.kpi(0.95), 0.95);
assert.strictEqual(ctx.kpi(95), 0.95);
assert.strictEqual(ctx.kpi('92.5%'), 0.925);
assert.strictEqual(ctx.kpi(1), 1);
assert.strictEqual(ctx.kpi(0.4), null);     // bawah had
assert.strictEqual(ctx.kpi(120), null);     // atas had
assert.strictEqual(ctx.kpi('abc'), null);
assert.strictEqual(ctx.kpi(''), null);

// tafsirTetapan_: lalai bila kosong / tidak sah
assert.strictEqual(j(ctx.tafsir([])), j({ kpi: 0.95, namaSekolah: '' }));
assert.strictEqual(j(ctx.tafsir([['kpi', 0.9], ['namaSekolah', ' SMK X ']])), j({ kpi: 0.9, namaSekolah: 'SMK X' }));
assert.strictEqual(ctx.tafsir([['kpi', 'rosak']]).kpi, 0.95);
assert.strictEqual(ctx.tafsir([['lain', 1]]).kpi, 0.95);

// sahkanTetapan_
assert.strictEqual(j(ctx.sahkan({ kpiPeratus: '90', namaSekolah: '  SMK   Mengkarak ' })), j({ tetapan: { kpi: 0.9, namaSekolah: 'SMK Mengkarak' } }));
assert.strictEqual(ctx.sahkan({ kpiPeratus: 92.5, namaSekolah: '' }).tetapan.kpi, 0.925);
assert.match(ctx.sahkan({ kpiPeratus: '', namaSekolah: '' }).ralat, /nombor/);
assert.match(ctx.sahkan({ kpiPeratus: 'x', namaSekolah: '' }).ralat, /nombor/);
assert.match(ctx.sahkan({ kpiPeratus: 49, namaSekolah: '' }).ralat, /antara 50% dan 100%/);
assert.match(ctx.sahkan({ kpiPeratus: 101, namaSekolah: '' }).ralat, /antara/);
assert.match(ctx.sahkan({ kpiPeratus: 95, namaSekolah: 'x'.repeat(81) }).ralat, /panjang/);

// bezaTetapan_
assert.strictEqual(ctx.beza({ kpi: 0.95, namaSekolah: '' }, { kpi: 0.95, namaSekolah: '' }), '');
assert.strictEqual(ctx.beza({ kpi: 0.95, namaSekolah: '' }, { kpi: 0.925, namaSekolah: 'SMK X' }), 'KPI 95% → 92.5%; Nama sekolah: "" → "SMK X"');
console.log('tetapan.test.js: semua lulus');
