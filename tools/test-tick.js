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
// Piyano benzeri ses: strikes = [{ at, tones: [{ hz, amp, decay }] }], drums = [zaman]. Her vuruşta kısa
// çekiç sesi; aynı tel yeniden vurulunca önceki titreşim biter (üst üste eklenen aynı frekanslı
// sinüsler birbirini söndürürdü).
function synthMusic(dur, strikes, drums) {
    const n = Math.round(dur * SR), s = new Float64Array(n);
    for (const st of strikes) {
        for (let i = Math.round(st.at * SR); i < Math.round((st.at + 0.008) * SR); i++) s[i] += (rand() * 2 - 1) * 1500;
        for (const tn of st.tones) {
            const next = strikes.find(o => o.at > st.at && o.tones.some(x => x.hz === tn.hz));
            const stop = next ? next.at + 0.005 : Infinity;
            for (let i = Math.round(st.at * SR); i < Math.min(n, Math.round(Math.min(st.at + 6 * tn.decay, stop) * SR)); i++) {
                const t = i / SR - st.at;
                let v = 0;
                for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * tn.hz * h * t) / h;
                s[i] += tn.amp * Math.min(1, t / 0.004, (stop - i / SR) / 0.005) * Math.exp(-t / tn.decay) * v;
            }
        }
    }
    for (const at of drums) {
        for (let i = Math.round(at * SR); i < Math.round((at + 0.04) * SR); i++) s[i] += (rand() * 2 - 1) * 9000 * Math.exp(-(i / SR - at) / 0.01);
    }
    return writeWav(s);
}
const HZ = { 'C#': 277.18, 'D#': 311.13, 'F': 349.23, 'F#': 369.99, 'G': 392.0, 'A#': 466.16 };
test('riff notes: pitch changes and re-struck notes on the eighth grid; held notes are not notes', () => {
    // 100 BPM solo piyano: sekizlik 0.3 sn; '-' = önceki nota tutuluyor (vuruş yok). Yeniden vuruşlar bir
    // tutulan sekizlikten sonra (hemen ardışık aynı nota tekrarı sesten her zaman ayrılamıyor).
    const pattern = ['D#', '-', 'D#', 'A#', '-', 'F#', '-', 'F#', 'F', '-', 'F', '-', 'A#', '-', 'A#', 'F#'];
    const t0 = 0.3, e8 = 0.3, dur = 10, strikes = [];
    for (let k = 0; t0 + k * e8 < dur - 0.5; k++) {
        const name = pattern[k % pattern.length];
        if (name !== '-') strikes.push({ at: t0 + k * e8, tones: [{ hz: HZ[name], amp: 4000, decay: 0.8 }] });
    }
    const file = synthMusic(dur, strikes, []);
    try {
        const res = analyzer.detectRiffNotes(fs, file, [0, dur]);
        assert(Math.abs(res.bpm - 100) <= 1, 'tempo ' + res.bpm);
        const want = strikes.map(x => x.at);
        assert.strictEqual(res.notes.length, want.length, JSON.stringify(res.notes) + ' vs ' + JSON.stringify(want));
        res.notes.forEach((t, i) => assert(Math.abs(t - want[i]) <= 0.03, t + ' vs ' + want[i]));
    } finally { fs.unlinkSync(file); }
});
test('a drum hit during a held note is not a note', () => {
    // Kullanıcı: riff takip edilsin, davul değil. Davul yalnız tutulan sekizliklerde.
    const pattern = ['D#', 'A#', 'F#', 'F', '-', '-', 'F#', 'A#'];
    const e8 = 0.3, dur = 10, strikes = [], drums = [];
    for (let k = 0; 0.3 + k * e8 < dur - 0.5; k++) {
        const name = pattern[k % pattern.length], at = 0.3 + k * e8;
        if (name === '-') drums.push(at);
        else strikes.push({ at: at, tones: [{ hz: HZ[name], amp: 4000, decay: 0.8 }] });
    }
    const file = synthMusic(dur, strikes, drums);
    try {
        const res = analyzer.detectRiffNotes(fs, file, [0, dur]);
        res.notes.forEach(t => assert(!drums.some(d => Math.abs(d - t) <= 0.03), 'davul nota sayildi: ' + t.toFixed(3)));
        assert(res.notes.length >= strikes.length - 2, res.notes.length + ' / ' + strikes.length);
    } finally { fs.unlinkSync(file); }
});
test('a note played off the eighth grid is placed on its own attack', () => {
    // Solo piyanoda canlı: tuş 3.17'de (iki sekizlik arası), sonraki takip noktası 3.37'de ve nota orada
    // tutuluyor → nota 0.2 sn geç kalıyordu. Her 8 sekizlikte biri yarım sekizlik gecikir, ardından tutulur.
    const names = ['D#', 'A#', 'F#', 'F'], e8 = 0.3, dur = 10, strikes = [];
    for (let k = 0; 0.3 + k * e8 < dur - 0.5; k++) {
        if (k % 8 === 6) continue;
        const at = 0.3 + k * e8 + (k % 8 === 5 ? 0.15 : 0);
        strikes.push({ at: at, tones: [{ hz: HZ[names[k % 4]], amp: 4000, decay: 0.5 }] });
    }
    const file = synthMusic(dur, strikes, []);
    try {
        const res = analyzer.detectRiffNotes(fs, file, [0, dur]);
        strikes.filter(x => x.at > 1 && x.at < dur - 1).forEach(x =>
            assert(res.notes.some(t => Math.abs(t - x.at) <= 0.03), 'tus ' + x.at.toFixed(2) + ' yok: ' + JSON.stringify(res.notes.map(t => +t.toFixed(3)))));
        res.notes.filter(t => t > 1 && t < dur - 1).forEach(t =>
            assert(strikes.some(x => Math.abs(t - x.at) <= 0.03), 'fazla nota ' + t.toFixed(3)));
    } finally { fs.unlinkSync(file); }
});
test('a pitch that takes over only while a chord decays is not a new note', () => {
    // Canlı (solo piyano 6.65): G tuşu sönerken akordaki sessiz C# baskın perde oldu, nota sanıldı.
    const e8 = 0.3, dur = 10, strikes = [];
    const pattern = ['D#', 'A#', 'chord', '-', '-', '-', 'F#', 'F'];
    for (let k = 0; 0.3 + k * e8 < dur - 0.5; k++) {
        const at = 0.3 + k * e8, name = pattern[k % pattern.length];
        if (name === '-') continue;
        strikes.push({ at: at, tones: name === 'chord' ?
            [{ hz: HZ.G, amp: 4000, decay: 0.12 }, { hz: HZ['C#'], amp: 1500, decay: 1.2 }] :
            [{ hz: HZ[name], amp: 4000, decay: 0.25 }] });
    }
    const file = synthMusic(dur, strikes, []);
    try {
        const res = analyzer.detectRiffNotes(fs, file, [0, dur]);
        res.notes.filter(t => t > 1 && t < dur - 1).forEach(t =>
            assert(strikes.some(x => Math.abs(t - x.at) <= 0.03), 'sonumden nota ' + t.toFixed(3) + ' ' + JSON.stringify(res.names)));
        assert(res.names.indexOf('C#') < 0, 'C# nota sayildi: ' + JSON.stringify(res.names));
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
const gapRows = p => p.gaps.map(x => [+x.start.toFixed(4), +x.end.toFixed(4), +x.target.toFixed(4), +x.speed.toFixed(4)]);
// Planın çıktısı: kaynak zamanı x'in timeline'daki yeri (x hiçbir aranın içinde değilken)
const outAt = (p, x) => p.gaps.filter(g => g.end <= x + 1e-9).reduce((s, g) => s - (g.end - g.start - g.target), x);
// Eşleşen ilk ve son tık arasındaki fazla tıkların hepsi silinen bir parçada olmalı (görünür fazla blok yok)
const hiddenExtras = (p, clicks) => clicks.filter(c => p.clicks.indexOf(c) < 0 && c > p.clicks[0] && c < p.clicks[p.clicks.length - 1])
    .forEach(c => assert(p.gaps.some(g => g.target === 0 && g.start <= c + 1e-9 && c < g.end), 'fazla tik gorunuyor: ' + c));
test('option (b): every melody note gets a click, extra clicks are cut, kept footage plays at most normal speed', () => {
    // Tık aralığı 0.4 sn; nota aralıkları kesmeye izin verecek kadar kısa ya da yavaşlatmaya uygun.
    const clicks = [1.0, 1.4, 1.8, 2.2, 2.6, 3.0];
    const notes = [1.0, 1.35, 1.7, 2.4, 2.75];
    const p = plan.alignToNotes(clicks, notes, cutOpts);
    assert(p.clicks.length >= 3, JSON.stringify(p));
    for (let i = 1; i < p.targets.length; i++) assert(p.targets[i] > p.targets[i - 1]);
    p.targets.forEach(t => assert(notes.some(nt => near(Math.round(nt * 30) / 30, t, 1e-9)), 'hedef nota degil: ' + t));
    assert(p.gaps.some(g => g.target === 0), 'fazla tiklar kesilmeli');
    p.gaps.forEach(g => assert(g.target === 0 ? g.speed === 0 : g.freeze || (g.speed >= 0.5 - 1e-9 && g.speed <= 1 + 1e-9), JSON.stringify(g)));
    hiddenExtras(p, clicks);
    p.clicks.forEach((c, k) => assert(near(outAt(p, c), p.targets[k], 1e-9), c + ' -> ' + outAt(p, c)));
});
test('option (b): a dropped click inside the kept window is cut out; footage after the click and before the next stay natural', () => {
    // a=1.0 → b=2.0, nota arası 0.8: tık parçasından sonra doğal, fazla tık (1.3) ve 150 ms'lik sesi
    // (30 fps'te 5 kare) kesilir, b'ye kadar doğal.
    const p = plan.alignToNotes([1.0, 1.3, 2.0], [1.0, 1.8], cutOpts);
    assert.deepStrictEqual(gapRows(p), [[1.2667, 1.4667, 0, 0]]);
    assert(near(outAt(p, 2.0), 1.8, 1e-9));
});
test('option (b): when only a short clean approach exists it is slowed down (no freeze for a small stretch)', () => {
    const p = plan.alignToNotes([1.0, 1.1, 2.0], [1.0, 2.0], cutOpts);
    const last = p.gaps[p.gaps.length - 1];
    assert(near(last.end, 2.0, 1e-9) && last.speed >= 0.5 && last.speed < 1, JSON.stringify(p.gaps));
    assert.strictEqual(p.freezes, 0);
    p.clicks.forEach((c, k) => assert(near(outAt(p, c), p.targets[k], 1e-9), c + ' -> ' + outAt(p, c)));
});
test('option (c): a long note gap uses the clean stretches between extra blocks with light slow motion, no freeze', () => {
    // Tıklar 0.4 sn arayla, notalar 1.0 / 2.6 / 3.0 …: 1.0 → 3.0 tıkı, 1.6 sn'lik arada baş + 3 ara + yaklaşma.
    const clicks = [1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.2];
    const p = plan.alignToNotes(clicks, [1.0, 2.6, 3.0, 3.4, 3.8, 4.2], cutOpts);
    assert.deepStrictEqual(p.clicks, [1.0, 3.0, 3.4, 3.8, 4.2]);
    assert.strictEqual(p.freezes, 0);
    assert.strictEqual(p.visible, 0);
    assert.strictEqual(p.gaps.filter(g => g.target === 0).length, 4, JSON.stringify(gapRows(p)));
    p.clicks.forEach((c, k) => assert(near(outAt(p, c), p.targets[k], 1e-9), c + ' -> ' + outAt(p, c)));
    hiddenExtras(p, clicks);
    // %70 sınırı; kare yuvarlaması bir kare kadar altına indirebilir
    p.gaps.filter(g => g.target > 0).forEach(g => assert(g.speed >= 0.65 && g.speed < 1, 'agir cekim: ' + JSON.stringify(g)));
});
test('option (c): when the clean stretches are not enough, a short freeze sits just before the extra block', () => {
    const clicks = [1.0, 1.4, 1.8, 2.2, 2.6];
    const p = plan.alignToNotes(clicks, [1.0, 1.8333, 2.2333, 2.6333], cutOpts);
    assert.deepStrictEqual(p.clicks, [1.0, 1.8, 2.2, 2.6]);
    // baş %75, son 2 karesi (fazla tıktan 1 kare önce biter) donar, fazla tık kesilir, yaklaşma %70
    assert.deepStrictEqual(gapRows(p), [[1.1, 1.3, 0.2667, 0.75], [1.3, 1.3667, 0.1333, 0.5], [1.3667, 1.5667, 0, 0], [1.5667, 1.8, 0.3333, 0.7]]);
    assert(p.gaps[1].freeze && p.freezes === 1);
    p.clicks.forEach((c, k) => assert(near(outAt(p, c), p.targets[k], 1e-9), c + ' -> ' + outAt(p, c)));
    hiddenExtras(p, clicks);
});
test('option (c): clean stretches between extra blocks are used (jump cuts) before slowing', () => {
    // a=1.0 → b=2.2, nota arası 0.8333: baş + ara + yaklaşma; eksik 1 kare en uzun bölüme (baş, %89),
    // iki fazla tık ve sesleri kesilir.
    const p = plan.alignToNotes([1.0, 1.4, 1.8, 2.2], [1.0, 1.8333], cutOpts);
    assert.deepStrictEqual(p.clicks, [1.0, 2.2]);
    assert.deepStrictEqual(gapRows(p), [[1.1, 1.3667, 0.3, 0.8889], [1.3667, 1.5667, 0, 0], [1.7667, 1.9667, 0, 0]]);
    assert(near(outAt(p, 2.2), 1.8333, 0.02));
});
test('option (c): a note gap longer than all remaining footage is slowed lightly, then frozen once the click sound is over', () => {
    // a=1.0 → b=1.5 arası fazla tık yok, kaynak hedefin yarısından kısa: tıkın sesi bitince (150 ms = 5 kare)
    // 2 kare donar, kalan %70'te oynar.
    const clicks = [1.0, 1.5, 2.0, 2.4, 2.8];
    const p = plan.alignToNotes(clicks, [1.0, 2.5, 3.0, 3.4, 3.8], cutOpts);
    assert.deepStrictEqual(p.clicks, clicks);
    assert.deepStrictEqual(gapRows(p), [[1.1667, 1.2333, 0.9667, +(2 / 29).toFixed(4)], [1.2333, 1.5, 0.3667, +(8 / 11).toFixed(4)]]);
    assert(p.gaps[0].freeze);
    p.clicks.forEach((c, k) => assert(near(outAt(p, c), p.targets[k], 1e-9), c + ' -> ' + outAt(p, c)));
});
test('option (c): a long freeze is avoided by dropping one more click and cutting', () => {
    // Tıklar 0.4, notalar 0.6 sn arayla: ardışık tıkları eşlemek her arada donma isterdi.
    const clicks = [1.0, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8];
    const p = plan.alignToNotes(clicks, [1.0, 1.6, 2.2, 2.8, 3.4], cutOpts);
    assert(p.frozenSec < 0.25, 'donma ' + p.frozenSec);
    assert(p.clicks.length < clicks.length && p.clicks.length >= 4, JSON.stringify(p.clicks));
    p.clicks.forEach((c, k) => assert(near(outAt(p, c), p.targets[k], 1e-9), c + ' -> ' + outAt(p, c)));
    hiddenExtras(p, clicks);
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
