/*
 * Beat tespitini test etmek icin SENTETIK MUZIK uretir (BPM'i kesin bilinir).
 * Suno gibi gercek muzik degil ama "dogru cevap" elimizde oldugu icin tespit
 * isabetini net olcebiliriz. Kick + snare + hi-hat + (opsiyonel) melodi.
 * Calistirma:  node tools\make-test-music.js
 * Cikti: D:\PremiereProExtension\test-music\*.wav
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SR = 48000;
let seed = 777;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

function writeWav(file, floatArr) {
    const n = floatArr.length;
    const data = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) {
        let v = Math.max(-1, Math.min(1, floatArr[i]));
        data.writeInt16LE(Math.round(v * 32767), i * 2);
    }
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
    h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(data.length, 40);
    fs.writeFileSync(file, Buffer.concat([h, data]));
}

function makeBeat(bpm, durSec, withMelody) {
    const N = Math.round(durSec * SR);
    const out = new Float64Array(N);
    const beat = 60 / bpm;                 // bir vurus suresi
    const eighth = beat / 2;

    function addKick(t0) {                  // 55Hz sinus, hizli sonum
        const start = Math.round(t0 * SR), len = Math.round(0.18 * SR);
        for (let k = 0; k < len && start + k < N; k++) {
            const env = Math.exp(-k / SR * 26);
            out[start + k] += Math.sin(2 * Math.PI * 55 * k / SR) * 0.95 * env;
        }
    }
    function addSnare(t0) {                  // orta-bantlı gürültü patlaması
        const start = Math.round(t0 * SR), len = Math.round(0.16 * SR);
        for (let k = 0; k < len && start + k < N; k++) {
            const env = Math.exp(-k / SR * 22);
            out[start + k] += (rand() * 2 - 1) * 0.5 * env;
        }
    }
    function addHat(t0) {                     // kısa, yüksek frekanslı tık
        const start = Math.round(t0 * SR), len = Math.round(0.04 * SR);
        for (let k = 0; k < len && start + k < N; k++) {
            const env = Math.exp(-k / SR * 90);
            out[start + k] += (rand() * 2 - 1) * 0.22 * env;
        }
    }

    let t = 0, b = 0;
    while (t < durSec) {
        addKick(t);                          // her vuruşta kick
        if (b % 2 === 1) addSnare(t);        // 2. ve 4. vuruşta snare
        addHat(t); addHat(t + eighth);       // 8'liklerde hi-hat
        t += beat; b++;
    }

    if (withMelody) {                        // sürekli melodi/akor (ritmi GIZLEMELI;
        const notes = [220, 277.18, 329.63]; // band-odak bunu yok saymalı)
        for (let i = 0; i < N; i++) {
            let m = 0;
            for (const f of notes) m += Math.sin(2 * Math.PI * f * i / SR);
            out[i] += (m / notes.length) * 0.18;
        }
    }

    // master gain + yumuşak clamp
    for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * 0.9);
    return out;
}

const dir = path.join('D:\\PremiereProExtension', 'test-music');
fs.mkdirSync(dir, { recursive: true });

const jobs = [
    ['beat_120bpm.wav', 120, 16, false],
    ['beat_120bpm_melodi.wav', 120, 16, true],
    ['beat_140bpm.wav', 140, 16, false],
    ['beat_90bpm.wav', 90, 16, false]
];
for (const [name, bpm, dur, mel] of jobs) {
    writeWav(path.join(dir, name), makeBeat(bpm, dur, mel));
    console.log('Uretildi: ' + name + '  (BPM=' + bpm + (mel ? ', + melodi' : '') + ', ' + dur + 'sn)');
}
console.log('\nKlasor: ' + dir);
