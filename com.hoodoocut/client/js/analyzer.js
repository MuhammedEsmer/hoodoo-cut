/*
 * HooDoo Cut - ses analiz motoru
 * Hem CEP panelinde (window.ACSAnalyzer) hem sistem Node'unda (require) calisir.
 * WAV dosyasini stream ederek okur: 1 saatlik ses bile RAM sorunu cikarmaz,
 * cunku ham ornekler tutulmaz, sadece pencere basina dB degeri tutulur.
 */
(function (root, factory) {
    // CEP mixed-context'te hem module hem window ayni anda var olur;
    // bu yuzden "ya biri ya digeri" degil, IKISINE birden bagla.
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ACSAnalyzer = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Kesme modlari: minSilence = kesilecek en kisa sessizlik;
    // keepAfter = konusma bittikten sonra birakilacak pay (sessizligin basindan);
    // keepBefore = konusma baslamadan once birakilacak pay (sessizligin sonundan);
    // minSpeech = bundan kisa "ses patlamalari" (klavye/click) sessizlik sayilir.
    var MODES = {
        sakin:    { minSilenceSec: 0.80, keepBeforeSec: 0.40, keepAfterSec: 0.40, minSpeechSec: 0.20 },
        olculu:   { minSilenceSec: 0.60, keepBeforeSec: 0.30, keepAfterSec: 0.30, minSpeechSec: 0.18 },
        tempolu:  { minSilenceSec: 0.45, keepBeforeSec: 0.20, keepAfterSec: 0.20, minSpeechSec: 0.15 },
        enerjik:  { minSilenceSec: 0.30, keepBeforeSec: 0.12, keepAfterSec: 0.12, minSpeechSec: 0.12 },
        atlamali: { minSilenceSec: 0.20, keepBeforeSec: 0.05, keepAfterSec: 0.05, minSpeechSec: 0.10 }
    };

    /* WAV header'ini coz: fmt ve data chunk'larini bul. */
    function readWavHeader(fs, fd) {
        var head = Buffer.alloc(12);
        fs.readSync(fd, head, 0, 12, 0);
        if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') {
            throw new Error('Gecerli bir WAV dosyasi degil');
        }
        var pos = 12;
        var fmt = null, dataOffset = -1, dataSize = -1;
        var chunkHead = Buffer.alloc(8);
        while (true) {
            var n = fs.readSync(fd, chunkHead, 0, 8, pos);
            if (n < 8) break;
            var id = chunkHead.toString('ascii', 0, 4);
            var size = chunkHead.readUInt32LE(4);
            if (id === 'fmt ') {
                var fmtBuf = Buffer.alloc(Math.min(size, 40));
                fs.readSync(fd, fmtBuf, 0, fmtBuf.length, pos + 8);
                fmt = {
                    audioFormat: fmtBuf.readUInt16LE(0),
                    numChannels: fmtBuf.readUInt16LE(2),
                    sampleRate: fmtBuf.readUInt32LE(4),
                    bitsPerSample: fmtBuf.readUInt16LE(14)
                };
                // WAVE_FORMAT_EXTENSIBLE ise gercek format SubFormat'in ilk 2 byte'inda
                if (fmt.audioFormat === 0xFFFE && size >= 40) {
                    fmt.audioFormat = fmtBuf.readUInt16LE(24);
                }
            } else if (id === 'data') {
                dataOffset = pos + 8;
                dataSize = size;
                break;
            }
            pos += 8 + size + (size % 2); // chunk'lar 2-byte hizali
        }
        if (!fmt || dataOffset < 0) throw new Error('WAV fmt/data chunk bulunamadi');
        fmt.dataOffset = dataOffset;
        fmt.dataSize = dataSize;
        return fmt;
    }

    /* RBJ cookbook biquad: high-pass / low-pass. Konusma bandina (≈hpHz–lpHz)
     * filtre uygulayip dusuk-frekans ugultu/hum'u eler -> sessizlik tespiti
     * cok daha dogru olur. Q=0.707 (Butterworth). */
    function biquadHP(sr, f0, Q) {
        var w0 = 2 * Math.PI * f0 / sr, c = Math.cos(w0), s = Math.sin(w0), al = s / (2 * Q), a0 = 1 + al;
        return { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0,
                 a1: (-2 * c) / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
    }
    function biquadLP(sr, f0, Q) {
        var w0 = 2 * Math.PI * f0 / sr, c = Math.cos(w0), s = Math.sin(w0), al = s / (2 * Q), a0 = 1 + al;
        return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0,
                 a1: (-2 * c) / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
    }
    function biquad(f, x) {
        var y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
        f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
        return y;
    }

    /* Dosyayi stream ederek pencere basina RMS dB dizisi cikar.
     * filt: { hpHz, lpHz } verilirse konusma bandina band-pass uygulanir.
     * Donus: { db: [..], windowMs, sampleRate, durationSec } */
    function computeWindowDb(fs, filePath, windowMs, filt) {
        windowMs = windowMs || 20;
        var fd = fs.openSync(filePath, 'r');
        try {
            var fmt = readWavHeader(fs, fd);
            var bytesPerSample = fmt.bitsPerSample / 8;
            var frameBytes = bytesPerSample * fmt.numChannels;
            var windowFrames = Math.max(1, Math.round(fmt.sampleRate * windowMs / 1000));
            var totalFrames = Math.floor(fmt.dataSize / frameBytes);

            var db = [];
            var acc = 0, accCount = 0;
            var CHUNK_FRAMES = 65536;
            var buf = Buffer.alloc(CHUNK_FRAMES * frameBytes);
            var framesRead = 0;
            var filePos = fmt.dataOffset;

            var isFloat = (fmt.audioFormat === 3);
            var bits = fmt.bitsPerSample;

            var hp = null, lp = null;
            if (filt) {
                hp = biquadHP(fmt.sampleRate, filt.hpHz || 120, 0.707);
                lp = biquadLP(fmt.sampleRate, filt.lpHz || 5000, 0.707);
            }

            while (framesRead < totalFrames) {
                var want = Math.min(CHUNK_FRAMES, totalFrames - framesRead);
                var bytes = fs.readSync(fd, buf, 0, want * frameBytes, filePos);
                if (bytes <= 0) break;
                var frames = Math.floor(bytes / frameBytes);
                for (var f = 0; f < frames; f++) {
                    var base = f * frameBytes;
                    var mono = 0;
                    for (var ch = 0; ch < fmt.numChannels; ch++) {
                        var off = base + ch * bytesPerSample;
                        var v;
                        if (isFloat && bits === 32) v = buf.readFloatLE(off);
                        else if (bits === 16) v = buf.readInt16LE(off) / 32768;
                        else if (bits === 24) {
                            var b0 = buf[off], b1 = buf[off + 1], b2 = buf[off + 2];
                            var iv = b0 | (b1 << 8) | (b2 << 16);
                            if (iv & 0x800000) iv |= ~0xFFFFFF;
                            v = iv / 8388608;
                        } else if (bits === 32) v = buf.readInt32LE(off) / 2147483648;
                        else if (bits === 8) v = (buf[off] - 128) / 128;
                        else throw new Error('Desteklenmeyen bit derinligi: ' + bits);
                        mono += v;
                    }
                    mono /= fmt.numChannels;
                    if (hp) mono = biquad(lp, biquad(hp, mono)); // konuşma bandı
                    acc += mono * mono;
                    accCount++;
                    if (accCount >= windowFrames) {
                        db.push(10 * Math.log10(acc / accCount + 1e-12));
                        acc = 0;
                        accCount = 0;
                    }
                }
                framesRead += frames;
                filePos += bytes;
            }
            if (accCount > windowFrames / 2) {
                db.push(10 * Math.log10(acc / accCount + 1e-12));
            }
            return {
                db: db,
                windowMs: windowMs,
                sampleRate: fmt.sampleRate,
                durationSec: totalFrames / fmt.sampleRate
            };
        } finally {
            fs.closeSync(fd);
        }
    }

    function percentile(sortedArr, p) {
        if (sortedArr.length === 0) return -60;
        var idx = Math.min(sortedArr.length - 1, Math.max(0, Math.round((sortedArr.length - 1) * p)));
        return sortedArr[idx];
    }

    /* Otomatik esik: gurultu tabani (p15) ile konusma seviyesi (p85) arasina koy.
     * Dip sesler/klavye gurultu tabanina yakin kalir, konusma cok ustte olur. */
    function autoThresholdDb(dbArr) {
        var sorted = dbArr.slice(0).sort(function (a, b) { return a - b; });
        var noise = percentile(sorted, 0.15);
        var speech = percentile(sorted, 0.85);
        var spread = speech - noise;
        var threshold;
        var confident = true;
        if (spread < 8) {
            // Dinamik aralik dar: ya hep ses var ya hep sessiz. Temkinli davran.
            threshold = -40;
            confident = false;
        } else {
            threshold = noise + Math.max(6, spread * 0.35);
        }
        if (threshold > -15) threshold = -15;
        if (threshold < -65) threshold = -65;
        return { thresholdDb: threshold, noiseDb: noise, speechDb: speech, confident: confident };
    }

    /* Sessiz araliklari bul.
     * opts: { thresholdDb, minSilenceSec, keepBeforeSec, keepAfterSec, minSpeechSec } */
    function detectSilences(analysis, opts) {
        var db = analysis.db;
        var winSec = analysis.windowMs / 1000;
        // Histerezis (Schmitt tetikleyici): konuşmaya GİRMEK için yüksek eşik,
        // sessizliğe GEÇMEK için düşük eşik. Eşik etrafında gezinen seviyelerde
        // titreyen/kelime ortasından kesen davranışı engeller.
        var quiet = new Array(db.length);
        var i;
        var hyst = (typeof opts.hysteresisDb === 'number') ? opts.hysteresisDb : 0;
        var lowThr = opts.thresholdDb - hyst / 2;
        var highThr = opts.thresholdDb + hyst / 2;
        var loud = (db.length > 0 && db[0] >= opts.thresholdDb);
        for (i = 0; i < db.length; i++) {
            if (db[i] > highThr) loud = true;
            else if (db[i] < lowThr) loud = false;
            quiet[i] = !loud;
        }

        // Kisa "ses patlamalarini" (klavye, click) sessizlige yedir:
        // iki sessiz blok arasindaki minSpeech'ten kisa sesli kosulari sustur.
        var minSpeechWin = Math.max(1, Math.round(opts.minSpeechSec / winSec));
        i = 0;
        while (i < db.length) {
            if (!quiet[i]) {
                var runStart = i;
                while (i < db.length && !quiet[i]) i++;
                var runLen = i - runStart;
                var prevQuiet = runStart > 0;
                var nextQuiet = i < db.length;
                if (runLen < minSpeechWin && prevQuiet && nextQuiet) {
                    for (var k = runStart; k < i; k++) quiet[k] = true;
                }
            } else {
                i++;
            }
        }

        // Sessiz kosulari aralige cevir
        var minSilenceWin = Math.max(1, Math.round(opts.minSilenceSec / winSec));
        var rawSilences = [];
        i = 0;
        while (i < db.length) {
            if (quiet[i]) {
                var s = i;
                while (i < db.length && quiet[i]) i++;
                if (i - s >= minSilenceWin) {
                    rawSilences.push({ start: s * winSec, end: i * winSec });
                }
            } else {
                i++;
            }
        }

        // Padding uygula: konusmaya yaklasan kisimlari koru
        var cuts = [];
        var totalCut = 0;
        for (i = 0; i < rawSilences.length; i++) {
            var cs = rawSilences[i].start + opts.keepAfterSec;
            var ce = rawSilences[i].end - opts.keepBeforeSec;
            if (ce - cs >= 0.05) {
                cuts.push({ start: Math.round(cs * 1000) / 1000, end: Math.round(ce * 1000) / 1000 });
                totalCut += ce - cs;
            }
        }
        return {
            cuts: cuts,
            totalCutSec: Math.round(totalCut * 100) / 100,
            rawSilenceCount: rawSilences.length
        };
    }

    /* Tek cagrilik kolay API: dosyadan analiz + esik + tespit. */
    function analyzeFile(fs, filePath, modeName, overrides) {
        var mode = MODES[modeName] || MODES.olculu;
        // Konuşma bandına band-pass (uğultu/hum elenir) — doğru tespit için
        var analysis = computeWindowDb(fs, filePath, 20, { hpHz: 120, lpHz: 5000 });
        var auto = autoThresholdDb(analysis.db);
        function pick(key) {
            return (overrides && typeof overrides[key] === 'number')
                ? overrides[key] : mode[key];
        }
        var opts = {
            thresholdDb: (overrides && typeof overrides.thresholdDb === 'number')
                ? overrides.thresholdDb : auto.thresholdDb,
            minSilenceSec: pick('minSilenceSec'),
            keepBeforeSec: pick('keepBeforeSec'),
            keepAfterSec: pick('keepAfterSec'),
            minSpeechSec: pick('minSpeechSec'),
            hysteresisDb: (overrides && typeof overrides.hysteresisDb === 'number')
                ? overrides.hysteresisDb : 3
        };
        var result = detectSilences(analysis, opts);
        return {
            cuts: result.cuts,
            totalCutSec: result.totalCutSec,
            durationSec: Math.round(analysis.durationSec * 100) / 100,
            auto: auto,
            usedOpts: opts,
            windowCount: analysis.db.length
        };
    }

    return {
        MODES: MODES,
        computeWindowDb: computeWindowDb,
        autoThresholdDb: autoThresholdDb,
        detectSilences: detectSilences,
        analyzeFile: analyzeFile
    };
});
