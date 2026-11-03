// Uji susunSejarah_: node test/log.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Log.gs'), 'utf8') +
  '\nthis.susun = susunSejarah_;', ctx);

const baris = [
  ['2026-11-03 09:00', 'a@x', 'Import', '30/10/2026', 39, 707, 805, 9, 'Fail: k.csv'],
  ['2026-11-03 10:15', 'b@x', 'Padam', '29/10/2026', 39, 707, 805, '', 'Melalui web app'],
  ['', '', '', '', '', '', '', '', ''],                                  // baris kosong diabaikan
  ['2026-11-02 08:00', 'a@x', 'Import', '28/10/2026', 39, 700, 805, 0, ''],
];
const r = ctx.susun(baris, 500);
assert.strictEqual(r.length, 3);
assert.strictEqual(r.map((x) => x.masa).join(','), '2026-11-03 10:15,2026-11-03 09:00,2026-11-02 08:00');
assert.strictEqual(r[0].dibetulkan, null);
assert.strictEqual(r[1].dibetulkan, 9);
assert.strictEqual(r[2].dibetulkan, 0);
assert.strictEqual(r[1].hadir + '/' + r[1].jumlah, '707/805');
assert.strictEqual(ctx.susun(baris, 2).length, 2);
assert.strictEqual(ctx.susun([], 10).length, 0);
// minit sama: baris kemudian di atas
const sama = ctx.susun([
  ['2026-11-03 09:00', 'a', 'Import', '30/10/2026', 1, 1, 1, 0, ''],
  ['2026-11-03 09:00', 'a', 'Padam', '30/10/2026', 1, 1, 1, '', ''],
], 10);
assert.strictEqual(sama.map((x) => x.tindakan).join(','), 'Padam,Import');
assert.strictEqual('_i' in sama[0], false);
console.log('log.test.js: semua lulus');
