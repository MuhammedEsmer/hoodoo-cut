/*
 * Tık ritmi: plan hesabı (tickplan.js) ve tık tespiti (analyzer.detectOnsets).
 * Premiere gerekmez. Çalıştırma: node tools\test-tick.js
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const plan = require('../com.hoodoocut/client/js/tickplan.js');
const analyzer = require('../com.hoodoocut/client/js/analyzer.js');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// 30 fps; T = 0.5 sn = 15 kare; tık parçası 3 kare -> ara hedefi 12 kare.
const base = { fps: 30, interval: 0.5, holdFrames: 3, minSpeed: 0.5, maxSpeed: 4 };

test('each gap is retimed so the next click lands one interval later', () => {
    // Tıklar 1.0, 1.8 (24 kare sonra), 2.2 (12 kare sonra) sn.
    const p = plan.planTicks([1.0, 1.8, 2.2], base);
    assert.strictEqual(p.gaps.length, 2);
    const g0 = p.gaps[0], g1 = p.gaps[1];
    // Ara 0: 33..54 kare (21 kare kaynak) -> 12 kare, hız 21/12.
    assert(near(g0.start, 33 / 30) && near(g0.end, 54 / 30) && near(g0.target, 12 / 30));
    assert(near(g0.speed, 21 / 12));
    // Ara 1: 57..66 kare (9 kare kaynak) -> 12 kare, hız 0.75 (yavaşlar).
    assert(near(g1.start, 57 / 30) && near(g1.end, 66 / 30) && near(g1.speed, 9 / 12));
    assert(near(p.deltaSec, ((12 - 21) + (12 - 9)) / 30));
    assert.deepStrictEqual(p.boundaries.map(b => Math.round(b * 30)), [33, 54, 57, 66]);
});
test('clicks too close for the minimum speed are merged into the previous click', () => {
    // 1.0 ve 1.2 sn: ara 6 - 3 = 3 kare < 0.5 * 12 -> birleşir.
    const p = plan.planTicks([1.0, 1.2, 2.0], base);
    assert.strictEqual(p.merged, 1);
    assert.deepStrictEqual(p.clicks.map(c => Math.round(c * 30)), [30, 60]);
    assert.strictEqual(p.gaps.length, 1);
});
test('very long gaps are clamped to the maximum speed (excess source is dropped)', () => {
    const p = plan.planTicks([1.0, 4.0], base);
    assert.strictEqual(p.limited, 1);
    assert.strictEqual(p.gaps[0].speed, 4);
    assert(near(p.gaps[0].target, 12 / 30));
});
test('interval from BPM: 120 BPM half beat = 0.25 s', () => {
    assert(near(plan.intervalFromBpm(120, 0.5), 0.25));
});
test('interval not longer than the click hold is rejected', () => {
    assert.throws(() => plan.planTicks([1, 2], Object.assign({}, base, { interval: 0.1 })), /araligi/i);
});
test('fewer than two clicks yields an empty plan', () => {
    const p = plan.planTicks([1.0], base);
    assert.strictEqual(p.gaps.length, 0);
});

// --- Tık tespiti: sentetik WAV (sessizlik + kısa gürültü patlamaları) ---
const SR = 48000;
let seed = 7;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function wavWithClicks(durSec, clicks) {
    const n = Math.round(durSec * SR), data = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) {
        const t = i / SR;
        let v = (rand() * 2 - 1) * 30; // taban gürültü
        for (const c of clicks) {
            if (t >= c.at && t < c.at + 0.03) v += (rand() * 2 - 1) * c.amp * Math.exp(-(t - c.at) / 0.01);
        }
        data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), i * 2);
    }
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
    h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36);
    h.writeUInt32LE(data.length, 40);
    const file = path.join(os.tmpdir(), 'hoodoo-tick-' + process.pid + '-' + Math.round(rand() * 1e9) + '.wav');
    fs.writeFileSync(file, Buffer.concat([h, data]));
    return file;
}
test('detects strong clicks inside the region and ignores weak ones and the outside', () => {
    const strong = [1.0, 1.6, 2.1, 2.9];
    const file = wavWithClicks(5, [
        ...strong.map(at => ({ at, amp: 20000 })),
        { at: 2.5, amp: 600 },   // zayıf (hassasiyet dışında)
        { at: 4.5, amp: 20000 }  // bölge dışı
    ]);
    try {
        const on = analyzer.detectOnsets(fs, file, [[0.5, 4.0]], { relDb: 12, minGap: 0.2 });
        assert.strictEqual(on.length, strong.length, JSON.stringify(on));
        on.forEach((t, i) => assert(Math.abs(t - strong[i]) <= 0.01, t + ' vs ' + strong[i]));
    } finally { fs.unlinkSync(file); }
});
test('minimum gap keeps the stronger of two close clicks', () => {
    const file = wavWithClicks(3, [{ at: 1.0, amp: 8000 }, { at: 1.1, amp: 20000 }, { at: 2.0, amp: 20000 }]);
    try {
        const on = analyzer.detectOnsets(fs, file, [[0, 3]], { relDb: 12, minGap: 0.2 });
        assert.strictEqual(on.length, 2, JSON.stringify(on));
        assert(Math.abs(on[0] - 1.1) <= 0.01 && Math.abs(on[1] - 2.0) <= 0.01, JSON.stringify(on));
    } finally { fs.unlinkSync(file); }
});
test('a faint sound just before a click does not steal its marker', () => {
    // Canlı hata: sessiz bölgede tıkın 50 ms öncesindeki küçük ses marker'ı erkene çekiyordu.
    const file = wavWithClicks(3, [{ at: 0.95, amp: 2000 }, { at: 1.0, amp: 20000 }, { at: 2.0, amp: 20000 }]);
    try {
        const on = analyzer.detectOnsets(fs, file, [[0.5, 2.5]], { relDb: 12, minGap: 0.2 });
        assert.strictEqual(on.length, 2, JSON.stringify(on));
        assert(Math.abs(on[0] - 1.0) <= 0.01 && Math.abs(on[1] - 2.0) <= 0.01, JSON.stringify(on));
    } finally { fs.unlinkSync(file); }
});
test('natural click interval is the median spacing', () => {
    assert(near(plan.medianInterval([1, 1.4, 1.8, 2.6, 3.0]), 0.4));
    assert.strictEqual(plan.medianInterval([1]), null);
});
test('a slow swell crossing the region start is not taken as a click', () => {
    // 0.9-1.1 sn: genlik 30 -> 20000, dB'de düzgün yükseliş (~14 dB / 50 ms), keskin tık yok.
    const n = Math.round(2 * SR), data = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) {
        const t = i / SR, k = Math.min(1, Math.max(0, (t - 0.9) / 0.2));
        const amp = t < 0.9 ? 30 : 30 * Math.pow(20000 / 30, k);
        data.writeInt16LE(Math.round((rand() * 2 - 1) * amp), i * 2);
    }
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
    h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36);
    h.writeUInt32LE(data.length, 40);
    const file = path.join(os.tmpdir(), 'hoodoo-swell-' + process.pid + '.wav');
    fs.writeFileSync(file, Buffer.concat([h, data]));
    try {
        const on = analyzer.detectOnsets(fs, file, [[1.0, 2.0]], { relDb: 12, minGap: 0.2 });
        assert.deepStrictEqual(on, []);
    } finally { fs.unlinkSync(file); }
});
if (failed) process.exitCode = 1;
