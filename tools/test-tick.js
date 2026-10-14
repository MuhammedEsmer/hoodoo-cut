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
test('riff notes are the pitch changes on the detected eighth-note grid (not repeats or drums)', () => {
    // 100 BPM: sekizlik 0.3 sn. Her sekizlik çalınır (aynı perde tekrarları dahil), her vuruşta davul.
    const hz = { 'D#': 311.13, 'A#': 466.16, 'F#': 369.99, 'F': 349.23 };
    const pattern = ['D#', 'D#', 'D#', 'A#', 'A#', 'F#', 'F#', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F#'];
    const t0 = 0.3, e8 = 0.3, dur = 10, n = Math.round(dur * SR), s = new Float64Array(n), changes = [];
    let prev = null;
    for (let k = 0; t0 + k * e8 < dur - 0.5; k++) {
        const at = t0 + k * e8, name = pattern[k % pattern.length];
        if (name !== prev) changes.push(at);
        prev = name;
        for (let i = Math.round(at * SR); i < Math.min(n, Math.round((at + 1.2) * SR)); i++) {
            const t = i / SR - at;
            let v = 0;
            for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * hz[name] * h * t) / h;
            s[i] += 4000 * Math.min(1, t / 0.004) * Math.exp(-t / 0.2) * v;
        }
    }
    for (let at = t0; at < dur - 0.5; at += 2 * e8) { // her vuruşta davul
        for (let i = Math.round(at * SR); i < Math.round((at + 0.04) * SR); i++) s[i] += (rand() * 2 - 1) * 9000 * Math.exp(-(i / SR - at) / 0.01);
    }
    const file = writeWav(s);
    try {
        const res = analyzer.detectRiffNotes(fs, file, [0, dur]);
        assert(Math.abs(res.bpm - 100) <= 1, 'tempo ' + res.bpm);
        assert.strictEqual(res.notes.length, changes.length, JSON.stringify(res.notes) + ' vs ' + JSON.stringify(changes));
        res.notes.forEach((t, i) => assert(Math.abs(t - changes[i]) <= 0.03, t + ' vs ' + changes[i]));
    } finally { fs.unlinkSync(file); }
});
test('riff notes do not depend on the analysed range (beat tracking, no global grid drift)', () => {
    // 100.4 BPM: sabit 100 BPM ızgarası 20 sn'de ~50 ms kayardı; takip yerel kalmalı.
    const hz = { 'D#': 311.13, 'A#': 466.16, 'F#': 369.99, 'F': 349.23 };
    const pattern = ['D#', 'D#', 'D#', 'A#', 'A#', 'F#', 'F#', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F#'];
    const e8 = 60 / 100.4 / 2, dur = 24, n = Math.round(dur * SR), s = new Float64Array(n);
    for (let k = 0; 0.25 + k * e8 < dur - 0.5; k++) {
        const at = 0.25 + k * e8, f = hz[pattern[k % pattern.length]];
        for (let i = Math.round(at * SR); i < Math.min(n, Math.round((at + 1.0) * SR)); i++) {
            const t = i / SR - at;
            let v = 0;
            for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f * h * t) / h;
            s[i] += 4000 * Math.min(1, t / 0.004) * Math.exp(-t / 0.2) * v;
        }
    }
    const file = writeWav(s);
    try {
        const whole = analyzer.detectRiffNotes(fs, file, [0, dur]).notes;
        const part = analyzer.detectRiffNotes(fs, file, [9, dur]).notes.filter(t => t > 11 && t < dur - 2);
        assert(part.length >= 8, JSON.stringify(part));
        part.forEach(t => assert(whole.some(q => Math.abs(q - t) <= 0.012), 'tutarsiz nota ' + t + ' / ' + JSON.stringify(whole)));
    } finally { fs.unlinkSync(file); }
});
const cutOpts = { fps: 30, holdFrames: 3, minSpeed: 0.5, maxSpeed: 4, regionStart: 0 };
test('option (b): every melody note gets a click, extra clicks are cut, kept footage plays at most normal speed', () => {
    // Tık aralığı 0.4 sn; nota aralıkları kesmeye izin verecek kadar kısa ya da yavaşlatmaya uygun.
    const clicks = [1.0, 1.4, 1.8, 2.2, 2.6, 3.0];
    const notes = [1.0, 1.35, 1.7, 2.4, 2.75];
    const p = plan.alignToNotes(clicks, notes, cutOpts);
    assert(p.clicks.length >= 3, JSON.stringify(p));
    for (let i = 1; i < p.targets.length; i++) assert(p.targets[i] > p.targets[i - 1]);
    p.targets.forEach(t => assert(notes.some(nt => near(Math.round(nt * 30) / 30, t, 1e-9)), 'hedef nota degil: ' + t));
    assert(p.gaps.some(g => g.target === 0), 'fazla tiklar kesilmeli');
    p.gaps.forEach(g => assert(g.target === 0 ? g.speed === 0 : g.speed >= 0.5 - 1e-9 && g.speed <= 1 + 1e-9, JSON.stringify(g)));
    p.gaps.filter(g => g.target > 0).forEach(g => assert(p.clicks.some(c => near(c, g.end, 1e-9)), 'kalan parca bir tikta bitmeli'));
});
test('option (b): a dropped click inside the kept window is avoided by starting after it', () => {
    const p = plan.alignToNotes([1.0, 1.3, 2.0], [1.0, 1.8], cutOpts);
    const g = p.gaps.map(x => [+x.start.toFixed(4), +x.end.toFixed(4), +x.target.toFixed(4), +x.speed.toFixed(4)]);
    assert.deepStrictEqual(g, [[1.1, 1.4, 0, 0], [1.4, 2.0, 0.7, +(0.6 / 0.7).toFixed(4)]]);
});
test('option (b): the region start is cut so the first click lands on its note', () => {
    const p = plan.alignToNotes([1.0, 1.8], [0.7, 1.5], Object.assign({}, cutOpts, { regionStart: 0.2 }));
    const g = p.gaps.map(x => [+x.start.toFixed(4), +x.end.toFixed(4), x.target, x.speed]);
    assert.deepStrictEqual(g, [[0.2, 0.5, 0, 0]]);
    assert.deepStrictEqual(p.targets.map(t => +t.toFixed(4)), [0.7, 1.5]);
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
