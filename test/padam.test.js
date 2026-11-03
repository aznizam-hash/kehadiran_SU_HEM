// Uji fungsi bantu Padam.gs: node test/padam.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Padam.gs'), 'utf8') +
  '\nthis.iso = ddmmyyyyKeIso_; this.blok = kumpulBlok_;', ctx);

const j = (x) => JSON.stringify(x);
assert.strictEqual(ctx.iso('30/10/2026'), '2026-10-30');
assert.strictEqual(ctx.iso(' 1/2/2026 '), '2026-02-01');
assert.strictEqual(ctx.iso('31/02/2026'), null);
assert.strictEqual(ctx.iso('2026-10-30'), null);
assert.strictEqual(ctx.iso('30/13/2026'), null);
assert.strictEqual(j(ctx.blok([2, 3, 4, 10, 11])), j([[10, 2], [2, 3]]));
assert.strictEqual(j(ctx.blok([41])), j([[41, 1]]));
assert.strictEqual(j(ctx.blok([2, 4, 6])), j([[6, 1], [4, 1], [2, 1]]));
console.log('padam.test.js: semua lulus');
