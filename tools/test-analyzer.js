/*
 * Analiz motorunu Premiere olmadan test eder: sentetik WAV uretir,
 * otomatik esik + sessizlik tespitini dogrular.
 * Calistirma: node tools\test-analyzer.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const analyzer = require('../com.hoodoocut/client/js/analyzer.js');

// Deterministik gurultu icin basit LCG
let seed = 12345;
function rand() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
}

const SR = 48000;

function makeWav(segments) {
    // segments: [{dur, amp, freq?}] -> 16-bit mono WAV. freq verilirse sinüs
    // tonu, yoksa beyaz gürültü üretir.
    let total = 0;
    for (const s of segments) total += Math.round(s.dur * SR);
    const data = Buffer.alloc(total * 2);
    let i = 0;
    for (const s of segments) {
        const n = Math.round(s.dur * SR);
        for (let k = 0; k < n; k++) {
            const v = s.freq
                ? Math.sin(2 * Math.PI * s.freq * i / SR) * s.amp
                : (rand() * 2 - 1) * s.amp;
            data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2);
            i++;
        }
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);      // PCM
    header.writeUInt16LE(1, 22);      // mono
    header.writeUInt32LE(SR, 24);
    header.writeUInt32LE(SR * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  PASS: ' + name); }
    else { fail++; console.log('  FAIL: ' + name + (detail ? ' -> ' + detail : '')); }
}

// Senaryo: konusma(2s) + sessizlik(1.5s) + konusma(2s) +
//          sessizlik(3s, ortasinda 60ms klavye click'i) + konusma(1s)
const SPEECH = 0.3;   // ~ -13 dB
const NOISE = 0.004;  // ~ -50 dB (dip ses)
const wav = makeWav([
    { dur: 2.0, amp: SPEECH },
    { dur: 1.5, amp: NOISE },
    { dur: 2.0, amp: SPEECH },
    { dur: 1.47, amp: NOISE },
    { dur: 0.06, amp: 0.4 },   // klavye/click sesi
    { dur: 1.47, amp: NOISE },
    { dur: 1.0, amp: SPEECH }
]);

const tmpWav = path.join(os.tmpdir(), 'acs_test.wav');
fs.writeFileSync(tmpWav, wav);
console.log('Test WAV: ' + tmpWav + ' (' + Math.round(wav.length / 1024) + ' KB)');

console.log('\n[1] WAV okuma + pencere dB');
const analysis = analyzer.computeWindowDb(fs, tmpWav, 20);
check('sure ~9.5s', Math.abs(analysis.durationSec - 9.5) < 0.1, 'durationSec=' + analysis.durationSec);
check('pencere sayisi ~475', Math.abs(analysis.db.length - 475) <= 2, 'len=' + analysis.db.length);

console.log('\n[2] Otomatik esik');
const auto = analyzer.autoThresholdDb(analysis.db);
console.log('  gurultu=' + auto.noiseDb.toFixed(1) + ' dB, konusma=' + auto.speechDb.toFixed(1) +
    ' dB, esik=' + auto.thresholdDb.toFixed(1) + ' dB');
check('esik gurultunun ustunde', auto.thresholdDb > auto.noiseDb + 3);
check('esik konusmanin altinda', auto.thresholdDb < auto.speechDb - 3);
check('emin', auto.confident === true);

console.log('\n[3] Sessizlik tespiti (olculu mod) + click bagisikligi');
const r = analyzer.analyzeFile(fs, tmpWav, 'olculu', {});
console.log('  bulunan kesimler: ' + JSON.stringify(r.cuts));
check('2 kesim bulundu (click sessizligi bolmedi)', r.cuts.length === 2, 'adet=' + r.cuts.length);
if (r.cuts.length === 2) {
    // 1. sessizlik: 2.0-3.5; olculu: keepAfter 0.3 / keepBefore 0.3 -> kesim ~[2.3, 3.2]
    check('1. kesim baslangici ~2.3', Math.abs(r.cuts[0].start - 2.3) < 0.15, 'start=' + r.cuts[0].start);
    check('1. kesim sonu ~3.2', Math.abs(r.cuts[0].end - 3.2) < 0.15, 'end=' + r.cuts[0].end);
    // 2. sessizlik: 5.5-8.5 -> kesim ~[5.8, 8.2]
    check('2. kesim baslangici ~5.8', Math.abs(r.cuts[1].start - 5.8) < 0.15, 'start=' + r.cuts[1].start);
    check('2. kesim sonu ~8.2', Math.abs(r.cuts[1].end - 8.2) < 0.15, 'end=' + r.cuts[1].end);
}

console.log('\n[4] Mod farklari');
const rEnerjik = analyzer.analyzeFile(fs, tmpWav, 'enerjik', {});
const rSakin = analyzer.analyzeFile(fs, tmpWav, 'sakin', {});
check('enerjik mod daha cok keser', rEnerjik.totalCutSec > r.totalCutSec,
    rEnerjik.totalCutSec + ' > ' + r.totalCutSec);
check('sakin mod daha az keser', rSakin.totalCutSec < r.totalCutSec,
    rSakin.totalCutSec + ' < ' + r.totalCutSec);

console.log('\n[5] Manuel esik override');
const rManual = analyzer.analyzeFile(fs, tmpWav, 'olculu', { thresholdDb: -30 });
check('manuel esik kullanildi', rManual.usedOpts.thresholdDb === -30);

fs.unlinkSync(tmpWav);

console.log('\n[6] Band-pass: sessizlikteki düşük-frekans hum yok sayılmalı');
// konuşma | 50Hz hum'lu "sessizlik" | konuşma — band-pass 50Hz'i elemeli,
// yoksa hum yüzünden orta bölge "sesli" sanılır ve sessizlik bulunmaz.
const bpWav = makeWav([
    { dur: 2, amp: 0.6 },             // konuşma (geniş-bant, gür)
    { dur: 2, amp: 0.3, freq: 50 },  // 50Hz hum (filtresiz "sesli" görünür; band-pass elemeli)
    { dur: 2, amp: 0.6 }             // konuşma
]);
const tmpBp = path.join(os.tmpdir(), 'acs_bp.wav');
fs.writeFileSync(tmpBp, bpWav);
const rbp = analyzer.analyzeFile(fs, tmpBp, 'olculu', {});
console.log('  bulunan kesim: ' + JSON.stringify(rbp.cuts));
check('50Hz hum bölgesi sessizlik sayıldı', rbp.cuts.length === 1, 'adet=' + rbp.cuts.length);
if (rbp.cuts.length === 1) {
    check('kesim ortada (~2.3–3.7)', rbp.cuts[0].start > 2.0 && rbp.cuts[0].end < 4.0,
        JSON.stringify(rbp.cuts[0]));
}
fs.unlinkSync(tmpBp);

console.log('\n[7] Nefes modeli girdisi (Respiro-en: 16 kHz, n_fft 400, hop 160, 128 Slaney mel)');
// 1 kHz sinüs: en güçlü mel bandı 1 kHz'i kapsar, sıfır geçiş oranı 2*1000/16000 = 0.125.
const sine = new Float32Array(16000);
for (let k = 0; k < sine.length; k++) sine[k] = 0.5 * Math.sin(2 * Math.PI * 1000 * k / 16000);
const feat = analyzer.respiroFeatures(sine), T = feat.T;
check('kare sayısı 1 + N/160 (ortalı)', T === 101 && feat.data.length === 3 * 128 * T, 'T=' + T);
const mid = 50, col = c => Array.from({ length: 128 }, (_, m) => feat.data[c * 128 * T + m * T + mid]);
const melCol = col(0), peak = melCol.indexOf(Math.max(...melCol));
// Slaney mel: 1000 Hz = 15 mel; 8 kHz = 45.25 mel; 128 bant -> 1 kHz bandı ~ 15 / (45.25 / 129) - 1 = 41.8
check('en güçlü mel bandı 1 kHz (41-43)', peak >= 41 && peak <= 43, 'bant=' + peak);
check('dB: en büyük 0, taban -80', Math.max(...feat.data.subarray(0, 128 * T)) === 0 &&
    Math.min(...feat.data.subarray(0, 128 * T)) >= -80);
const zc = col(2)[0];
check('sıfır geçiş oranı ~0.125', Math.abs(zc - 0.125) < 0.005, 'zcr=' + zc);
const mean = melCol.reduce((a, b) => a + b, 0) / 128;
const vr = melCol.reduce((a, b) => a + (b - mean) * (b - mean), 0) / 127;
check('kanal 1 = karedeki mel varyansı (n-1)', Math.abs(col(1)[0] - vr) < 1e-3 * vr, col(1)[0] + ' / ' + vr);

console.log('\n[8] Olasılık -> nefes (eşik 0.064, en az 21 kare)');
const prob = new Float32Array(300);
prob.fill(0.9, 10, 31);   // 21 kare -> nefes
prob.fill(0.9, 100, 120); // 20 kare -> kısa, sayılmaz
prob.fill(0.05, 200, 260); // eşik altı
check('21 karelik koşu nefes, 20 karelik ve eşik altı değil',
    JSON.stringify(analyzer.breathSegments(prob)) === JSON.stringify([{ start: 0.1, end: 0.3 }]),
    JSON.stringify(analyzer.breathSegments(prob)));

console.log('\n[9] Nefes tespiti: 25 sn parçalar + 2.5 sn bağlam, parça sınırında kayıp yok, sessiz parça atlanır');
// Dijital sessizlik üzerinde 1 kHz tonlar; sahte model sıfır geçiş oranı yüksek karelere 1 verir.
const BUR = [[10.0, 10.5], [24.8, 25.3], [60.0, 60.4]];
const long = makeWav([{ dur: 10.0, amp: 0 }, { dur: 0.5, amp: 0.3, freq: 1000 }, { dur: 14.3, amp: 0 },
    { dur: 0.5, amp: 0.3, freq: 1000 }, { dur: 34.7, amp: 0 }, { dur: 0.4, amp: 0.3, freq: 1000 }, { dur: 19.6, amp: 0 }]);
const tmpLong = path.join(os.tmpdir(), 'acs_breath_long.wav');
fs.writeFileSync(tmpLong, long);
let calls = 0, shapeOk = true;
const fake = (data, n) => {
    calls++;
    if (data.length !== 3 * 128 * n) shapeOk = false;
    const p = new Float32Array(n);
    for (let t = 0; t < n; t++) p[t] = data[2 * 128 * n + t] > 0.05 ? 1 : 0;
    return Promise.resolve(p);
};
(async () => {
    const segs = await analyzer.detectBreaths(fs, tmpLong, fake);
    fs.unlinkSync(tmpLong);
    console.log('  bulunan: ' + JSON.stringify(segs));
    check('üç ton bulundu, sınırdaki dahil', segs.length === 3 &&
        segs.every((s, i) => Math.abs(s.start - BUR[i][0]) <= 0.03 && Math.abs(s.end - BUR[i][1]) <= 0.03),
        JSON.stringify(segs));
    check('model 3 kez çağrıldı (son parça tamamen sessiz)', calls === 3, 'cagri=' + calls);
    check('girdi boyu 3 x 128 x T', shapeOk);

    // Panel paketi (client/lib/respiro): gerçek ONNX Runtime Web + Respiro-en, bellekten yüklenir.
    const dir = path.join(__dirname, '..', 'com.hoodoocut', 'client', 'lib', 'respiro');
    const ort = require(path.join(dir, 'ort.js'));
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmBinary = fs.readFileSync(path.join(dir, 'ort-wasm-simd-threaded.wasm'));
    const sess = await ort.InferenceSession.create(new Uint8Array(fs.readFileSync(path.join(dir, 'respiro-en.onnx'))),
        { executionProviders: ['wasm'] });
    const out = await sess.run({ feat: new ort.Tensor('float32', feat.data, [1, 3, 128, T]) });
    const p = out[sess.outputNames[0]].data;
    check('gerçek paket: kare başına olasılık (T adet, 0-1)', p.length === T && Array.from(p).every(v => v >= 0 && v <= 1),
        'uzunluk=' + p.length);

    console.log('\nSonuc: ' + pass + ' PASS, ' + fail + ' FAIL');
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.log('  FAIL: ' + (e && e.stack || e)); process.exit(1); });
