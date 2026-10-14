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
// --- Müzik melodisi hedefi ---
function writeWav(samples) {
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), i * 2));
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
    h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36);
    h.writeUInt32LE(data.length, 40);
    const file = path.join(os.tmpdir(), 'hoodoo-notes-' + process.pid + '-' + Math.round(rand() * 1e9) + '.wav');
    fs.writeFileSync(file, Buffer.concat([h, data]));
    return file;
}
test('melody notes are found and drum-like noise bursts are ignored', () => {
    const n = 4 * SR, s = new Float64Array(n);
    const tones = [[0.5, 440], [1.3, 660], [2.1, 550], [2.9, 495]];
    // Piyano gibi: armonikli nota, keskin atak, doğal sönüm (sert kesilme yok); davul vuruşları
    // nota çalarken düşer.
    for (const [at, hz] of tones) {
        for (let i = Math.round(at * SR); i < n; i++) {
            const t = i / SR - at;
            let v = 0;
            for (let k = 1; k <= 6; k++) v += Math.sin(2 * Math.PI * hz * k * t) / k;
            s[i] += 5000 * Math.min(1, t / 0.005) * Math.exp(-t / 0.25) * v;
        }
    }
    for (const at of [1.0, 1.9, 2.6, 3.5]) { // davul benzeri kısa gürültü
        for (let i = Math.round(at * SR); i < Math.round((at + 0.03) * SR); i++) s[i] += (rand() * 2 - 1) * 12000 * Math.exp(-(i / SR - at) / 0.008);
    }
    const file = writeWav(s);
    try {
        const notes = analyzer.detectNotes(fs, file, [0, 4]);
        assert.strictEqual(notes.length, tones.length, JSON.stringify(notes));
        notes.forEach((t, i) => assert(Math.abs(t - tones[i][0]) <= 0.03, t + ' vs ' + tones[i][0]));
    } finally { fs.unlinkSync(file); }
});
test('clicks are matched to notes monotonically with speeds inside the limits', () => {
    const clicks = [1.0, 1.4, 1.8, 2.2, 2.6];
    const notes = [0.5, 1.1, 1.5, 1.6, 2.0, 2.45, 2.9, 3.4];
    const opts = { fps: 30, holdFrames: 3, minSpeed: 0.5, maxSpeed: 2.5, regionStart: 0 };
    const p = plan.alignToNotes(clicks, notes, opts);
    assert(p.clicks.length >= 4, JSON.stringify(p));
    for (let i = 1; i < p.targets.length; i++) assert(p.targets[i] > p.targets[i - 1]);
    // Hedefler kare ızgarasına oturtulmuş notalardır.
    p.targets.forEach(t => assert(notes.some(nt => Math.abs(Math.round(nt * 30) / 30 - t) < 1e-9), 'hedef nota degil: ' + t));
    p.gaps.forEach(g => assert(g.speed >= 0.5 - 1e-9 && g.speed <= 2.5 + 1e-9, JSON.stringify(g)));
    // Her ara: hedef süre = sonraki nota - nota - tık parçası (kare)
    const between = p.gaps.filter(g => g.start > 0);
    between.forEach((g, i) => assert(near(g.target, p.targets[i + 1] - p.targets[i] - 3 / 30, 1e-9), JSON.stringify(g)));
});
test('the region start is retimed so the first click lands on its note', () => {
    const p = plan.alignToNotes([1.0, 1.4, 1.8], [1.2, 1.6, 2.0], { fps: 30, holdFrames: 3, minSpeed: 0.5, maxSpeed: 2.5, regionStart: 0.2 });
    const prefix = p.gaps[0];
    assert(near(prefix.start, 0.2) && near(prefix.end, 1.0) && near(prefix.target, 1.0), JSON.stringify(prefix));
    assert(near(prefix.speed, 0.8));
    assert(near(p.targets[0], 1.2));
});
test('repetition filter finds the riff period and drops one-off notes', () => {
    const riff = [0, 0.3, 0.9, 1.2, 1.5], period = 2.4, notes = [];
    for (let r = 0; r < 5; r++) riff.forEach(t => notes.push(1 + r * period + t));
    const extras = [1.65, 4.15, 6.9, 9.6, 11.05]; // birbirine ve riff'e periyot uzaklığında değil
    const res = plan.keepRepeating(notes.concat(extras).sort((a, b) => a - b));
    assert(Math.abs(res.period - period) <= 0.02, 'periyot ' + res.period);
    assert.deepStrictEqual(res.notes.map(t => +t.toFixed(3)), notes.map(t => +t.toFixed(3)));
});
test('repetition filter keeps original notes where the riff is absent for a while', () => {
    const notes = [];
    for (let r = 0; r < 4; r++) [0, 0.4, 0.8].forEach(t => notes.push(r * 2.4 + t));
    const solo = [12, 12.5, 13.3, 14.1]; // riff yok, 2 sn'den uzun boşluk olurdu
    const res = plan.keepRepeating(notes.concat(solo), { fillGap: 1.5 });
    solo.forEach(t => assert(res.notes.includes(t), 'boslukta nota kalmali: ' + t));
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
