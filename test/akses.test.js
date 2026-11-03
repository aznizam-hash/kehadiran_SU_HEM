// Uji tentukanPeranan_: node test/akses.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Akses.gs'), 'utf8') +
  '\nthis.peranan = tentukanPeranan_;', ctx);
const p = ctx.peranan;
const pemilik = 'suhem@moe-dl.edu.my';
const senarai = [
  ['pkhem@moe-dl.edu.my', 'lihat'],
  [' Pengetua@MOE-DL.edu.my ', 'LIHAT'],
  ['guru@moe-dl.edu.my', 'admin'],
  ['guru@moe-dl.edu.my', 'lihat'],        // berulang: admin menang
  ['salah@moe-dl.edu.my', 'superuser'],    // peranan tak sah
  ['', 'admin'],
];
assert.strictEqual(p(pemilik, pemilik, []), 'admin');                       // pemilik sentiasa admin
assert.strictEqual(p('SUHEM@moe-dl.edu.my', pemilik, []), 'admin');         // tak sensitif huruf
assert.strictEqual(p('pkhem@moe-dl.edu.my', pemilik, senarai), 'lihat');
assert.strictEqual(p('pengetua@moe-dl.edu.my', pemilik, senarai), 'lihat');
assert.strictEqual(p('guru@moe-dl.edu.my', pemilik, senarai), 'admin');
assert.strictEqual(p('salah@moe-dl.edu.my', pemilik, senarai), null);
assert.strictEqual(p('orangluar@gmail.com', pemilik, senarai), null);
assert.strictEqual(p('', pemilik, senarai), null);                          // emel kosong ditolak
assert.strictEqual(p(null, pemilik, senarai), null);
assert.strictEqual(p('', '', [['', 'admin']]), null);                       // kosong tak padan kosong
console.log('akses.test.js: semua lulus');
