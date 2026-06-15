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

console.log('\nSonuc: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
