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

// ---- Beat tespiti: 120 BPM kick track (60Hz vuruş, band-odaklı müzik modu) ----
console.log('\n[6] Müzik beat tespiti (120 BPM, 60Hz kick)');
const BPM = 120;
const period = 60 / BPM; // 0.5 sn
const beatDur = 8;
const kickSegs = [];
let tcur = 0;
const kickLen = 0.06;
for (let bi = 0; tcur < beatDur; bi++) {
    kickSegs.push({ dur: kickLen, amp: 0.7, freq: 60 });   // kick (60Hz)
    kickSegs.push({ dur: period - kickLen, amp: 0.0 });     // arası sessiz
    tcur += period;
}
const tmpBeat = path.join(os.tmpdir(), 'acs_kick.wav');
fs.writeFileSync(tmpBeat, makeWav(kickSegs));

const rb = analyzer.detectBeatsFile(fs, tmpBeat, { sensitivity: 0.5, useGrid: false, minGapSec: 0.12 });
console.log('  onset=' + rb.onsetCount + ', BPM=' + rb.detectedBpm + ', beat=' + rb.beats.length);
check('~16 kick bulundu', Math.abs(rb.onsetCount - 16) <= 3, 'onset=' + rb.onsetCount);
check('BPM ~120 (otokorelasyon)', Math.abs(rb.detectedBpm - 120) <= 8, 'bpm=' + rb.detectedBpm);
if (rb.beats.length >= 3) {
    check('kick aralığı ~0.5', Math.abs((rb.beats[1] - rb.beats[0]) - 0.5) < 0.08,
        'd=' + (rb.beats[1] - rb.beats[0]).toFixed(3));
}

console.log('\n[7] Izgara modu + alt bölünme + manuel BPM');
const rGrid = analyzer.detectBeatsFile(fs, tmpBeat, { sensitivity: 0.5, useGrid: true });
check('ızgara ~17 beat', Math.abs(rGrid.beats.length - 17) <= 3, 'beats=' + rGrid.beats.length);
check('ızgara 1. beat ~0.0', rGrid.beats[0] < 0.12, 'b0=' + rGrid.beats[0]);
const rHalf = analyzer.detectBeatsFile(fs, tmpBeat, { sensitivity: 0.5, useGrid: true, subdivision: 0.5 });
check('1/2 bölünme daha çok beat', rHalf.beats.length > rGrid.beats.length,
    rHalf.beats.length + ' > ' + rGrid.beats.length);
const rManualBpm = analyzer.detectBeatsFile(fs, tmpBeat, { useGrid: true, manualBpm: 120 });
check('manuel BPM kullanıldı', rManualBpm.usedBpm === 120);

console.log('\n[8] Band-odak: sürekli melodi tonu ritim sanılmamalı');
// 3kHz sürekli ton (melodi gibi) — enerji sabit, flux ~0 → ritim yok
const toneWav = makeWav([{ dur: 4, amp: 0.5, freq: 3000 }]);
const tmpTone = path.join(os.tmpdir(), 'acs_tone.wav');
fs.writeFileSync(tmpTone, toneWav);
const rTone = analyzer.detectBeatsFile(fs, tmpTone, { sensitivity: 0.5, useGrid: false });
check('sürekli ton az onset üretir (<5)', rTone.onsetCount < 5, 'onset=' + rTone.onsetCount);
fs.unlinkSync(tmpTone);

console.log('\n[8b] Geniş-bant (transient) modu — oyun vuruşları');
// yüksek frekanslı kısa patlamalar (silah/click gibi); transient modu yakalamalı
const clickSegs = [];
tcur = 0;
for (let bi = 0; tcur < 6; bi++) {
    clickSegs.push({ dur: 0.03, amp: 0.6 });          // geniş-bant gürültü patlaması
    clickSegs.push({ dur: 0.6 - 0.03, amp: 0.002 });
    tcur += 0.6;
}
const tmpClick = path.join(os.tmpdir(), 'acs_click.wav');
fs.writeFileSync(tmpClick, makeWav(clickSegs));
const rTrans = analyzer.detectBeatsFile(fs, tmpClick, { sensitivity: 0.5, useGrid: false, mode: 'transient' });
check('transient modu vuruşları buldu (~10)', Math.abs(rTrans.onsetCount - 10) <= 3, 'onset=' + rTrans.onsetCount);
fs.unlinkSync(tmpClick);

fs.unlinkSync(tmpBeat);

console.log('\n[9] Beat hizalama planı (oyun vuruşu → beat)');
// beats her 1 sn; oyun vuruşları 0, 1.5, 2.2, 3.9
const planBeats = [0, 1, 2, 3, 4, 5];
const planHits = [0, 1.5, 2.2, 3.9];
const plan = analyzer.planBeatAlign(planHits, planBeats, { minRemoveSec: 0.04 });
console.log('  removeIntervals=' + JSON.stringify(plan.removeIntervals) +
    ' aligned=' + plan.aligned + ' skipped=' + plan.skipped + ' removedSec=' + plan.removedSec);
check('2 kırpma aralığı', plan.removeIntervals.length === 2, 'len=' + plan.removeIntervals.length);
if (plan.removeIntervals.length === 2) {
    check('1. kırpma [1.0,1.5]', Math.abs(plan.removeIntervals[0][0] - 1.0) < 0.01 &&
        Math.abs(plan.removeIntervals[0][1] - 1.5) < 0.01, JSON.stringify(plan.removeIntervals[0]));
    check('2. kırpma [3.5,3.9]', Math.abs(plan.removeIntervals[1][0] - 3.5) < 0.01 &&
        Math.abs(plan.removeIntervals[1][1] - 3.9) < 0.01, JSON.stringify(plan.removeIntervals[1]));
}
check('toplam kırpma 0.9 sn', Math.abs(plan.removedSec - 0.9) < 0.01, 'removedSec=' + plan.removedSec);
// kırpma aralıkları örtüşmemeli ve artan olmalı
let okOrder = true;
for (let i = 1; i < plan.removeIntervals.length; i++) {
    if (plan.removeIntervals[i][0] < plan.removeIntervals[i - 1][1] - 1e-6) okOrder = false;
}
check('kırpma aralıkları örtüşmüyor/artan', okOrder, JSON.stringify(plan.removeIntervals));

// condense-only: hiç vuruş olmayan girişte boş plan
const plan0 = analyzer.planBeatAlign([], planBeats, {});
check('vuruş yoksa boş plan', plan0.removeIntervals.length === 0 && plan0.removedSec === 0);

console.log('\n[10] BPM bilinince faz kilidi (alignGridToMusic)');
// 0.3 sn lead-in + 120 BPM kick → faz 0.3'e kilitlenmeli
const offSegs = [{ dur: 0.3, amp: 0.0 }];
let toff = 0.3;
while (toff < 8) { offSegs.push({ dur: 0.06, amp: 0.7, freq: 60 }); offSegs.push({ dur: 0.44, amp: 0.0 }); toff += 0.5; }
const tmpOff = path.join(os.tmpdir(), 'acs_off.wav');
fs.writeFileSync(tmpOff, makeWav(offSegs));
const rphase = analyzer.alignGridToMusic(fs, tmpOff, 120, {});
console.log('  faz=' + rphase.phaseSec + '  beat0=' + rphase.beats[0] + '  adet=' + rphase.beats.length);
check('faz ~0.3 bulundu (downbeat)', Math.abs(rphase.phaseSec - 0.3) < 0.06, 'faz=' + rphase.phaseSec);
check('beat aralığı ~0.5', rphase.beats.length >= 3 &&
    Math.abs((rphase.beats[2] - rphase.beats[1]) - 0.5) < 0.03, 'd=' + (rphase.beats[2] - rphase.beats[1]));
fs.unlinkSync(tmpOff);

console.log('\n[11] CSV BPM ayrıştırma (virgüllü şarkı adı dahil)');
const csvText =
    'Dosya,Sanatçı adı,İz adı,VURUŞ/DAKIKA,Ton,Camelot\n' +
    'Endless Blocks, Endless Sky.mp3,metalquality000,Endless Blocks, Endless Sky,113,B♭ major,6B\n' +
    'phonk_track.wav,artist,Phonk Track,140,A minor,8A\n';
const rows = analyzer.parseBpmCsv(csvText);
console.log('  satır=' + rows.length + ' → ' + rows.map(r => r.filename + ':' + r.bpm).join(' | '));
check('2 satır (başlık atlandı)', rows.length === 2, 'len=' + rows.length);
if (rows.length === 2) {
    check('virgüllü ad: BPM=113', rows[0].bpm === 113, 'bpm=' + rows[0].bpm);
    check('virgüllü ad: dosya doğru', rows[0].filename === 'Endless Blocks, Endless Sky.mp3', 'f=' + rows[0].filename);
    check('virgüllü ad: Camelot=6B', rows[0].camelot === '6B', 'c=' + rows[0].camelot);
    check('temiz satır: BPM=140', rows[1].bpm === 140, 'bpm=' + rows[1].bpm);
}
check('normalize eşleşmesi', analyzer.normalizeName('C:/x/Phonk_Track.WAV') === 'phonk_track',
    analyzer.normalizeName('C:/x/Phonk_Track.WAV'));

console.log('\nSonuc: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
