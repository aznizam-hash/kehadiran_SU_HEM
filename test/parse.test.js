// Uji parseKehadiran() di luar Apps Script: node test/parse.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const kod = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const ctx = { Logger: { log: () => {} } };
vm.createContext(ctx);
vm.runInContext(kod + '\nthis.parseKehadiran = parseKehadiran; this.testParse = testParse;', ctx);
const { parseKehadiran } = ctx;

const HEADER = '﻿Bil.,Tahun/Tingkatan,Kelas,Kehadiran,Jumlah Pelajar';
const csv = (baris) => [HEADER, ...baris].join('\r\n') + '\r\n';
let lulus = 0;
const uji = (nama, fn) => { fn(); lulus++; console.log('LULUS', nama); };

uji('testParse() bawaan', () => ctx.testParse());

uji('39 kelas, 79 baris dengan baris kosong selang-seli', () => {
  const ting = ['SATU', 'DUA', 'TIGA', 'EMPAT', 'LIMA'];
  const baris = [];
  for (let i = 0; i < 39; i++) {
    baris.push(',,,,');
    baris.push(`${i + 1},TINGKATAN ${ting[i % 5]},KELAS${i},Kehadiran,${20 + (i % 3)}/23`);
  }
  const teks = csv(baris);
  assert.strictEqual(teks.split('\r\n').length - 1, 79);
  const h = parseKehadiran(teks);
  assert.strictEqual(h.gagal.length, 0, JSON.stringify(h.gagal));
  assert.strictEqual(h.rows.length, 39);
  assert.deepStrictEqual({ ...h.rows[0] }, { tingkatan: 'TINGKATAN SATU', kelas: 'KELAS0', hadir: 20, jumlah: 23 });
});

uji('header salah ditolak', () => {
  const h = parseKehadiran('Bil,Tingkatan,Kelas,Kehadiran,Jumlah\r\n1,T1,A,Kehadiran,1/2\r\n');
  assert.strictEqual(h.rows.length, 0);
  assert.match(h.gagal[0].sebab, /Header/);
});

uji('baris rosak dikumpul, semua dilaporkan', () => {
  const h = parseKehadiran(csv([
    '1,TINGKATAN SATU,AMANAH,Kehadiran,22/23',
    '2,TINGKATAN SATU,BESTARI,Kehadiran,22',
    '3,TINGKATAN SATU,CEKAL,Kehadiran,25/23',
    '4,TINGKATAN SATU,DINAMIK,Kehadiran,0/0',
    '5,TINGKATAN SATU,,Kehadiran,1/2',
    '6,TINGKATAN SATU,AMANAH,Kehadiran,20/23',
    '7,TINGKATAN SATU,EFEKTIF,Kehadiran',
  ]));
  assert.strictEqual(h.rows.length, 1);
  assert.deepStrictEqual([...h.gagal.map((g) => g.baris)], [3, 4, 5, 6, 7, 8]);
});

uji('LF sahaja dan tanpa BOM diterima', () => {
  const h = parseKehadiran('Bil.,Tahun/Tingkatan,Kelas,Kehadiran,Jumlah Pelajar\n1,TINGKATAN DUA,AMANAH,Kehadiran,10/12\n');
  assert.strictEqual(h.rows.length, 1);
});

uji('nama kelas sama, tingkatan berbeza dibenarkan', () => {
  const h = parseKehadiran(csv([
    '1,TINGKATAN SATU,AMANAH,Kehadiran,22/23',
    '2,TINGKATAN DUA,AMANAH,Kehadiran,21/23',
  ]));
  assert.strictEqual(h.rows.length, 2);
  assert.strictEqual(h.gagal.length, 0);
});

uji('fail kosong / header sahaja', () => {
  assert.strictEqual(parseKehadiran('').gagal.length, 1);
  assert.match(parseKehadiran(csv([',,,,'])).gagal[0].sebab, /Tiada baris data/);
});

console.log(`\n${lulus} ujian lulus.`);
