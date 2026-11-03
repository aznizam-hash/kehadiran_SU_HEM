// Uji parseKehadiran() di luar Apps Script: node test/parse.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const kod = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const ctx = { Logger: { log: () => {} } };
vm.createContext(ctx);
vm.runInContext(kod + '\nthis.parseKehadiran = parseKehadiran; this.testParse = testParse; this.pratonton = ringkasPratonton_;', ctx);
const { parseKehadiran } = ctx;

const HEADER = '\uFEFFBil.,Tahun/Tingkatan,Kelas,Kehadiran,Jumlah Pelajar';
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

uji('nilai ditukar Excel jadi tarikh dibetulkan', () => {
  const h = parseKehadiran([
    'Bil.,Tahun/Tingkatan,Kelas,Kehadiran,Jumlah Pelajar',
    '1,TINGKATAN TIGA,EHSAN,KEHADIRAN TELAH DIKEMASKINI,18-Dec',
    ',,,,',
    '2,TINGKATAN LIMA,PRODUKTIF,KEHADIRAN TELAH DIKEMASKINI,15-Nov',
    ',,,,',
    '3,KELAS KHAS MENENGAH,DEDIKASI,KEHADIRAN TELAH DIKEMASKINI,5-May',
    ',,,,',
    '4,TINGKATAN ENAM SEM 1,6B1,KEHADIRAN TELAH DIKEMASKINI,2-feb',
    ',,,,',
    '5,TINGKATAN ENAM SEM 1,6B2,KEHADIRAN TELAH DIKEMASKINI,13-Dis',
    ',,,,',
    '6,TINGKATAN ENAM SEM 1,6B3,KEHADIRAN TELAH DIKEMASKINI,21/24',
  ].join('\n') + '\n');
  assert.strictEqual(h.gagal.length, 0, JSON.stringify(h.gagal));
  assert.deepStrictEqual(h.rows.map((r) => `${r.hadir}/${r.jumlah}`).join(','), '12/18,11/15,5/5,2/2,12/13,21/24');
  assert.deepStrictEqual(h.pembetulan.map((p) => `${p.baris}:${p.asal}>${p.baru}`).join(','),
    '2:18-Dec>12/18,4:15-Nov>11/15,6:5-May>5/5,8:2-feb>2/2,10:13-Dis>12/13');
});

uji('tarikh yang tak masuk akal tetap ditolak', () => {
  const h = parseKehadiran(csv([
    '1,TINGKATAN SATU,AMANAH,Kehadiran,3-Dec',   // 12/3: hadir > jumlah
    '2,TINGKATAN SATU,BESTARI,Kehadiran,18-Xyz', // bulan tak dikenali
    '3,TINGKATAN SATU,CEKAL,Kehadiran,18/12/2026',
  ]));
  assert.strictEqual(h.rows.length, 0);
  assert.strictEqual(h.gagal.length, 3);
  assert.strictEqual(h.pembetulan.length, 0);
});

uji('ringkasPratonton_ tanda baris dibetulkan dan kira jumlah', () => {
  const h = ctx.pratonton(parseKehadiran(csv([
    '1,TINGKATAN TIGA,EHSAN,Kehadiran,18-Dec',
    '2,TINGKATAN TIGA,AMANAH,Kehadiran,24/28',
  ])));
  assert.strictEqual(h.rows.length, 2);
  assert.strictEqual(h.rows[0].asal, '18-Dec');
  assert.strictEqual(h.rows[1].asal, null);
  assert.strictEqual(`${h.ringkasan.hadir}/${h.ringkasan.jumlah}/${h.ringkasan.bilKelas}`, '36/46/2');
});

// Fail sebenar tak disimpan dalam repo (repo public). Uji jika diberi:
//   CSV_SEBENAR=/path/kehadiran.csv node test/parse.test.js
if (process.env.CSV_SEBENAR) {
  uji('fail sebenar: ' + path.basename(process.env.CSV_SEBENAR), () => {
    const h = parseKehadiran(fs.readFileSync(process.env.CSV_SEBENAR, 'utf8'));
    assert.strictEqual(h.gagal.length, 0, JSON.stringify(h.gagal));
    console.log(`  ${h.rows.length} kelas, ${h.pembetulan.length} dibetulkan:`);
    h.pembetulan.forEach((p) => console.log(`  baris ${p.baris} ${p.tingkatan} ${p.kelas}: ${p.asal} -> ${p.baru}`));
  });
}

console.log(`\n${lulus} ujian lulus.`);
