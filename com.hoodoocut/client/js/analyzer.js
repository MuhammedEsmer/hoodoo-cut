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
            if (!(fmt.sampleRate > 0) || !(fmt.numChannels > 0) ||
                (fmt.audioFormat !== 1 && fmt.audioFormat !== 3) ||
                (fmt.audioFormat === 3 && fmt.bitsPerSample !== 32) ||
                [8, 16, 24, 32].indexOf(fmt.bitsPerSample) < 0) {
                throw new Error('Desteklenmeyen WAV bicimi');
            }
            if (fmt.dataSize <= 0 || fmt.dataSize % frameBytes !== 0 ||
                fmt.dataOffset + fmt.dataSize > fs.fstatSync(fd).size) {
                throw new Error('WAV verisi eksik; disa aktarim tamamlanmamis olabilir');
            }
            var windowFrames = Math.max(1, Math.round(fmt.sampleRate * windowMs / 1000));
            var totalFrames = Math.floor(fmt.dataSize / frameBytes);

            var db = [];
            var acc = [], accCount = 0;
            var CHUNK_FRAMES = 65536;
            var buf = Buffer.alloc(CHUNK_FRAMES * frameBytes);
            var framesRead = 0;
            var filePos = fmt.dataOffset;

            var isFloat = (fmt.audioFormat === 3);
            var bits = fmt.bitsPerSample;

            var hp = [], lp = [];
            for (var channel = 0; channel < fmt.numChannels; channel++) {
                acc[channel] = 0;
                if (filt) {
                    hp[channel] = biquadHP(fmt.sampleRate, filt.hpHz || 120, 0.707);
                    lp[channel] = biquadLP(fmt.sampleRate, filt.lpHz || 5000, 0.707);
                }
            }

            while (framesRead < totalFrames) {
                var want = Math.min(CHUNK_FRAMES, totalFrames - framesRead);
                var bytes = fs.readSync(fd, buf, 0, want * frameBytes, filePos);
                if (bytes <= 0 || bytes % frameBytes !== 0) throw new Error('WAV verisi okunamadi');
                var frames = Math.floor(bytes / frameBytes);
                for (var f = 0; f < frames; f++) {
                    var base = f * frameBytes;
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
                        // PCM tamsayilari zaten sonludur; yalniz float WAV bunu gerektirir.
                        if (isFloat && !isFinite(v)) throw new Error('WAV gecersiz ses ornegi iceriyor');
                        if (filt) v = biquad(lp[ch], biquad(hp[ch], v));
                        acc[ch] += v * v;
                    }
                    accCount++;
                    if (accCount >= windowFrames) {
                        // Her kanal kendi filtresini ve enerjisini tutar. En yuksek
                        // kanal konusmayi korur; ters fazli stereo birbirini silmez.
                        var peakEnergy = 0;
                        for (var c = 0; c < acc.length; c++) {
                            peakEnergy = Math.max(peakEnergy, acc[c]);
                            acc[c] = 0;
                        }
                        db.push(10 * Math.log10(peakEnergy / accCount + 1e-12));
                        accCount = 0;
                    }
                }
                framesRead += frames;
                filePos += bytes;
            }
            if (accCount > windowFrames / 2) {
                var tailEnergy = 0;
                for (var tail = 0; tail < acc.length; tail++) tailEnergy = Math.max(tailEnergy, acc[tail]);
                db.push(10 * Math.log10(tailEnergy / accCount + 1e-12));
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

    /* Kesilecek bolgeyi iceri yuvarla: konusma tarafindaki kare korunur.
     * Razor, silme ve kompaksiyon ayni saniye degerlerini kullanir. */
    function alignCuts(cuts, fps) {
        if (!(fps > 0) || !isFinite(fps)) throw new Error('Gecersiz sequence kare hizi');
        var sorted = cuts.slice().sort(function (a, b) { return a.start - b.start; });
        var merged = [], aligned = [];
        for (var i = 0; i < sorted.length; i++) {
            var cut = sorted[i];
            if (!isFinite(cut.start) || !isFinite(cut.end) || cut.start < 0 || cut.end <= cut.start) {
                throw new Error('Gecersiz kesim araligi');
            }
            var last = merged.length ? merged[merged.length - 1] : null;
            if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
            else merged.push({ start: cut.start, end: cut.end });
        }
        for (var j = 0; j < merged.length; j++) {
            var start = Math.ceil(merged[j].start * fps - 1e-8) / fps;
            var end = Math.floor(merged[j].end * fps + 1e-8) / fps;
            if (end > start) aligned.push({ start: start, end: end });
        }
        return aligned;
    }

    /* Tık ritmi: ranges ([[bas, son], ...] sn) icindeki tiklarin zamanlari.
     * Premiere dalga formu gibi tam bant (60 Hz-15 kHz) 5 ms zarf; tik = iki yana da
     * >= 12 dB dusen belirgin tepe (yavas kabaran/suren ses tik sayilmaz). Zaman =
     * tepenin atak baslangici (tepe - 10 dB). Canli hata: "ani yukselis" yontemi
     * sessiz bolgede tikin hemen onceki kucuk sesi secip marker'i 12-62 ms erken koyuyordu.
     * opts: relDb (bolgedeki en guclu tikin kac dB altina kadar sayilir), minGap
     * (sn; daha yakin iki tikten guclu olan kalir), hpHz. */
    function detectOnsets(fs, filePath, ranges, opts) {
        opts = opts || {};
        var rel = opts.relDb || 12, minGap = opts.minGap || 0.2, PROM = 12, SIDE = 20;
        var analysis = computeWindowDb(fs, filePath, 5, { hpHz: opts.hpHz || 60, lpHz: 15000 });
        var db = analysis.db, win = analysis.windowMs / 1000;
        var nb = Math.max(1, Math.round(minGap / 2 / win));
        var peaks = [], strongest = -Infinity;
        for (var r = 0; r < ranges.length; r++) {
            var from = Math.max(SIDE, Math.ceil(ranges[r][0] / win));
            var to = Math.min(db.length - 1 - SIDE, Math.floor(ranges[r][1] / win));
            for (var i = from; i <= to; i++) {
                var isPeak = true, k;
                for (k = Math.max(0, i - nb); k <= Math.min(db.length - 1, i + nb) && isPeak; k++) {
                    if (k !== i && (db[k] > db[i] || (k < i && db[k] === db[i]))) isPeak = false;
                }
                if (!isPeak) continue;
                var leftMin = Infinity, rightMin = Infinity;
                for (k = i - SIDE; k < i; k++) if (db[k] < leftMin) leftMin = db[k];
                for (k = i + 1; k <= i + SIDE; k++) if (db[k] < rightMin) rightMin = db[k];
                if (db[i] - leftMin < PROM || db[i] - rightMin < PROM) continue;
                var s = i;
                while (s > i - SIDE && db[s - 1] > db[i] - 10) s--;
                if (s * win < ranges[r][0]) continue; // atak bolgeden once basliyor
                peaks.push({ t: s * win, db: db[i] });
                if (db[i] > strongest) strongest = db[i];
            }
        }
        var kept = [];
        for (var p = 0; p < peaks.length; p++) {
            if (peaks[p].db < strongest - rel) continue;
            var last = kept[kept.length - 1];
            if (last && peaks[p].t - last.t < minGap) {
                if (peaks[p].db > last.db) kept[kept.length - 1] = peaks[p];
                continue;
            }
            kept.push(peaks[p]);
        }
        return kept.map(function (x) { return x.t; });
    }

    /* Yerinde radix-2 FFT (re/im Float64Array, uzunluk 2'nin kuvveti). */
    function fftInPlace(re, im) {
        var n = re.length, i, j, k, len, t;
        for (i = 1, j = 0; i < n; i++) {
            var bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
        }
        for (len = 2; len <= n; len <<= 1) {
            var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
            for (i = 0; i < n; i += len) {
                var cr = 1, ci = 0;
                for (k = 0; k < half; k++) {
                    var a = i + k, b = a + half;
                    var br = re[b] * cr - im[b] * ci, bi = re[b] * ci + im[b] * cr;
                    re[b] = re[a] - br; im[b] = im[a] - bi; re[a] += br; im[a] += bi;
                    t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
                }
            }
        }
    }

    /* Muzik melodisi (riff): [bas, son] (sn) araligindaki melodi notalari.
     * 1) Tempo: orta bant (300-3000 Hz) onset gucunun otokorelasyonu (vurus 0.33-1.0 sn).
     *    Sekizlikler bu tempoyla dinamik programlamali takiple bulunur (yerel ataklara oturur).
     *    2) Her sekizlikte baskin perde (kromagram, 150-2500 Hz, FFT 4096, +40/+85/+130 ms).
     *    3) Baskin perde degisince yeni melodi notasi (yeni perde bir sonraki sekizlikte de surmeli
     *    ya da 1.5 kat baskin olmali); noktada atak yoksa nota o perdenin gercek atagina tasinir ya da
     *    (atak yoksa) atilir. Ayni perde guclu atak + o perdede yukselisle yeniden vurulursa o da nota;
     *    tutulan nota ve davul nota sayilmaz.
     * Neden: HPSS akis tespiti In the End piyano riff'inin yalniz %14'unu yakaliyordu (kromagramla
     * kontrol); bu yontem 104.94 BPM'i ve F#-D#-A#-F#-F riff'ini 2 olcude bir birebir buldu. Solo piyano
     * (In the End tutorial, 60 sn, 121 tus) ile ayarlandi: notalarin gercek tusa denk gelen orani
     * %74 -> %89, yakalanan tus %53 -> %72; In the End'de 2 olcu tekrar eden nota %47 -> %70. */
    function detectRiffNotes(fs, filePath, range, opts) {
        opts = opts || {};
        var a = computeWindowDb(fs, filePath, 5, { hpHz: 300, lpHz: 3000 }), db = a.db, w = a.windowMs / 1000;
        var i0 = Math.max(2, Math.floor(range[0] / w)), i1 = Math.min(db.length, Math.ceil(range[1] / w));
        var os = new Float64Array(Math.max(0, i1 - i0)), i, k;
        // dB tabani: medyanin 40 dB alti. Dijital sessizlikten (-120 dB) ilk giris tek basina dev bir
        // onset olup tempo aramasini bozuyordu (sentetik solo piyano: 100 BPM -> 66.7).
        var sdb = Array.prototype.slice.call(db, i0, i1).sort(function (x, y) { return x - y; });
        var floorDb = (sdb[sdb.length >> 1] || 0) - 40;
        for (i = i0; i < i1; i++) os[i - i0] = Math.max(0, Math.max(db[i], floorDb) - Math.max(db[i - 2], floorDb));
        function ac(lag) { var s = 0; for (var q = 0; q + lag < os.length; q++) s += os[q] * os[q + lag]; return s; }
        // Sekizlik periyodu dogrudan aranir: 1, 2 ve 4 katinda da guclu olmali. Vurus aramasi
        // (0.33-1.0 sn) duzgun sekizlik akista 3 sekizligi (nokta dortluk) secip tempoyu 2/3
        // kucuk bulabiliyordu (sentetik 100.4 BPM -> 66.9).
        function pulse(lag) { return ac(lag) + ac(2 * lag) + ac(4 * lag); }
        var best = -1, lag0 = 0;
        for (var lag = Math.round(0.15 / w); lag <= Math.round(0.5 / w); lag++) {
            var v = pulse(lag);
            if (v > best) { best = v; lag0 = lag; }
        }
        if (!(best > 0)) return { notes: [], names: [], bpm: null };
        var y0 = pulse(lag0 - 1), y1 = best, y2 = pulse(lag0 + 1), den = y0 - 2 * y1 + y2;
        var P8 = (lag0 + (den !== 0 ? 0.5 * (y0 - y2) / den : 0)) * w, beat = 2 * P8;
        // Sekizlik takibi (Ellis tarzi dinamik programlama): her nokta yerel ataga oturur, ardisik
        // aralik sekizlikten saptikca ceza. Sabit (tempo, faz) izgarasi kucuk tempo hatasinda 100 sn'de
        // 50+ ms kayiyordu ve sonuc analiz araligina gore degisiyordu (canli: ortak bolgede 0/52 eslesme).
        var L = os.length, env = new Float64Array(L), mean = 0, sd = 0;
        for (i = 0; i < L; i++) {
            var acc = 0, wsum = 0;
            for (k = -3; k <= 3; k++) {
                if (i + k < 0 || i + k >= L) continue;
                var wt = Math.exp(-k * k / 4);
                acc += os[i + k] * wt; wsum += wt;
            }
            env[i] = acc / wsum; mean += env[i];
        }
        mean /= Math.max(1, L);
        for (i = 0; i < L; i++) sd += (env[i] - mean) * (env[i] - mean);
        sd = Math.sqrt(sd / Math.max(1, L)) || 1;
        for (i = 0; i < L; i++) env[i] /= sd;
        var per = P8 / w, wLo = Math.max(1, Math.round(per * 0.5)), wHi = Math.round(per * 1.5), ALPHA = opts.tightness || 100;
        var score = new Float64Array(L), back = new Int32Array(L);
        for (i = 0; i < L; i++) {
            var bestS = 0, bestJ = -1;
            for (var j = i - wHi; j <= i - wLo; j++) {
                if (j < 0) continue;
                var rl = Math.log((i - j) / per), sc = score[j] - ALPHA * rl * rl;
                if (sc > bestS) { bestS = sc; bestJ = j; }
            }
            score[i] = env[i] + bestS; back[i] = bestJ;
        }
        var endI = L - 1;
        for (i = Math.max(0, L - Math.round(per)); i < L; i++) if (score[i] > score[endI]) endI = i;
        var grid = [];
        for (i = endI; i >= 0; i = back[i]) grid.unshift((i0 + i) * w);

        var fd = fs.openSync(filePath, 'r'), out = [], names = [];
        try {
            var fmt = readWavHeader(fs, fd), bps = fmt.bitsPerSample / 8, frameBytes = bps * fmt.numChannels;
            if (!((fmt.audioFormat === 1 && (bps === 2 || bps === 3)) || (fmt.audioFormat === 3 && bps === 4))) {
                throw new Error('Desteklenmeyen WAV bicimi (melodi analizi)');
            }
            var sr = fmt.sampleRate, total = Math.floor(fmt.dataSize / frameBytes), N = 4096;
            var raw = Buffer.alloc(N * frameBytes);
            // n ornekten (n <= 4096) pencereli FFT, 150-2500 Hz kromaya ekle; dosya disi atlanir
            var chromaInto = function (cv, start, n) {
                if (start < 0 || start + n > total) return false;
                fs.readSync(fd, raw, 0, n * frameBytes, fmt.dataOffset + start * frameBytes);
                var re = new Float64Array(n), im = new Float64Array(n), s, b;
                for (s = 0; s < n; s++) {
                    var sum = 0;
                    for (var c = 0; c < fmt.numChannels; c++) {
                        var p = s * frameBytes + c * bps;
                        sum += fmt.audioFormat === 3 ? raw.readFloatLE(p) : (bps === 2 ? raw.readInt16LE(p) / 32768 : raw.readIntLE(p, 3) / 8388608);
                    }
                    re[s] = sum / fmt.numChannels * (0.5 - 0.5 * Math.cos(2 * Math.PI * s / n));
                }
                fftInPlace(re, im);
                var lo = Math.floor(150 / sr * n), hi = Math.ceil(2500 / sr * n);
                for (b = lo; b < hi; b++) {
                    var midi = Math.round(69 + 12 * Math.log(b * sr / n / 440) / Math.LN2);
                    cv[((midi % 12) + 12) % 12] += re[b] * re[b] + im[b] * im[b];
                }
                return true;
            };
            var chromaAt = function (t) {
                var cv = new Float64Array(12), offs = [0.04, 0.085, 0.13];
                for (var o = 0; o < offs.length; o++) chromaInto(cv, Math.round((t + offs[o]) * sr) - N / 2, N);
                return cv;
            };
            // Perdeye ozgu atak gucu (5 ms, FFT 2048): bir perdenin enerjisinin onceki 20 ms'deki en
            // yuksegine gore log yukselisi, eksi 12 perdenin medyan yukselisi (davul ve genel ses artisi
            // butun perdeleri birlikte yukseltir). Solo piyanoda gercek tuslarda medyan 0.93, atak
            // olmayan anlarda 0.27.
            var HOP = 0.005, N2 = 2048, LAG = 4, rT0 = grid[0] - P8;
            var nR = Math.max(0, Math.ceil((grid[grid.length - 1] + 0.3 - rT0) / HOP)), rise = new Float32Array(nR * 12);
            var hist = [], d = new Float64Array(12), srt = new Float64Array(12);
            for (var f = 0; f < nR; f++) {
                var cf = new Float64Array(12), tot = 0;
                chromaInto(cf, Math.round((rT0 + f * HOP) * sr) - N2 / 2, N2);
                for (k = 0; k < 12; k++) tot += cf[k];
                if (hist.length === LAG) {
                    var eps = tot * 0.01 + 1e-12;
                    for (k = 0; k < 12; k++) {
                        var pm = 0;
                        for (var h = 0; h < LAG; h++) if (hist[h][k] > pm) pm = hist[h][k];
                        d[k] = Math.log((cf[k] + eps) / (pm + eps)); srt[k] = d[k];
                    }
                    Array.prototype.sort.call(srt, function (x, y) { return x - y; });
                    for (k = 0; k < 12; k++) rise[f * 12 + k] = d[k] - (srt[5] + srt[6]) / 2;
                    hist.shift();
                }
                hist.push(cf);
            }
            // [t0, t1] icinde k perdesinin en guclu atagi
            var bestRise = function (t0, t1, pc) {
                var f0 = Math.max(LAG, Math.ceil((t0 - rT0) / HOP)), f1 = Math.min(nR - 1, Math.floor((t1 - rT0) / HOP)), bt = null, bv = -Infinity;
                for (var q = f0; q <= f1; q++) if (rise[q * 12 + pc] > bv) { bv = rise[q * 12 + pc]; bt = rT0 + q * HOP; }
                return { t: bt, v: bv };
            };
            var slots = [], energies = [];
            for (var gi = 0; gi < grid.length; gi++) {
                var t = grid[gi], cv = chromaAt(t), top = 0, second = -1, e = 0;
                for (k = 0; k < 12; k++) {
                    e += cv[k];
                    if (cv[k] > cv[top]) top = k;
                }
                for (k = 0; k < 12; k++) if (k !== top && (second < 0 || cv[k] > cv[second])) second = k;
                // atak var mi: noktanin -40..+20 ms'sindeki en yuksek (sd ile olcekli) onset zarfi
                var ei = Math.round(t / w) - i0, on = 0;
                for (var z = Math.max(0, ei - 8); z <= Math.min(L - 1, ei + 4); z++) if (env[z] > on) on = env[z];
                slots.push({ t: t, top: top, margin: cv[top] / (cv[second] + 1e-20), e: e, on: on });
                energies.push(e);
            }
            var sortedE = energies.slice().sort(function (x, y) { return x - y; });
            var quiet = (sortedE[sortedE.length >> 1] || 0) * 0.01;
            // atak esikleri sarkiya gore: noktalarin medyan atak gucune oranla (sessizlikten ilk giris
            // gibi tek bir dev atak sd'yi sisirip digerlerini kucultmesin)
            var ons = slots.map(function (x) { return x.on; }).sort(function (x, y) { return x - y; });
            var medOn = ons[ons.length >> 1] || 1;
            var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], cur = -1, last = -Infinity, MINGAP = 0.09;
            for (k = 0; k < slots.length; k++) {
                var sl = slots[k], at = null;
                if (sl.e <= quiet) { cur = -1; continue; }
                var stable = (k + 1 < slots.length && slots[k + 1].top === sl.top) || sl.margin >= 1.5;
                if (sl.top !== cur && stable) {
                    cur = sl.top;
                    if (sl.on >= 0.6 * medOn) at = sl.t; // nokta bir atakta
                    else {
                        // Noktada atak yok (solo piyanoda ritim sekizlikten saptiginda takip atagin 0.2 sn
                        // sonrasina dusebiliyor): nota o perdenin en guclu atagina tasinir. Atak da yoksa
                        // perde degisimi sonumden (akorun bir sesi sonerken digeri one cikar), nota degil.
                        var b = bestRise(Math.max(sl.t - 0.75 * P8, last + MINGAP), sl.t + 0.15, cur);
                        if (b.v >= 0.45) at = b.t;
                    }
                } else if (sl.top === cur) {
                    // Ayni perdenin yeniden vurusu: guclu atak + o perdede yukselis ya da orta atak + belirgin
                    // perde yukselisi. Davul tum perdeleri birlikte yukseltir, tek basina nota olmaz.
                    var rv = bestRise(sl.t - 0.04, sl.t + 0.03, cur).v;
                    if ((sl.on >= 1.4 * medOn && rv >= 0.2) || (sl.on >= 0.8 * medOn && rv >= 0.6)) at = sl.t;
                }
                if (at === null || at < last + MINGAP) continue;
                out.push(at);
                names.push(NAMES[cur]);
                last = at;
            }
        } finally { fs.closeSync(fd); }
        return { notes: out, names: names, bpm: 60 / beat };
    }

    /* Dosyanın [bas, son] (sn) aralığını mono'ya indirip srOut Hz'e yeniden örnekler: Blackman pencereli
     * sinc (32 tap yarıçap), kesir konumu 512 adımlı tablodan. Basic Pitch 22050 Hz mono ister. */
    function readMonoResampled(fs, filePath, range, srOut) {
        var R = 32, W = 2 * R + 1, STEPS = 512, fd = fs.openSync(filePath, 'r'), x, s0, n, sr, i, j;
        try {
            var fmt = readWavHeader(fs, fd), bps = fmt.bitsPerSample / 8, fb = bps * fmt.numChannels;
            if (!((fmt.audioFormat === 1 && (bps === 2 || bps === 3)) || (fmt.audioFormat === 3 && bps === 4))) {
                throw new Error('Desteklenmeyen WAV bicimi (melodi analizi)');
            }
            sr = fmt.sampleRate;
            var total = Math.floor(fmt.dataSize / fb), CH = 65536, buf = Buffer.alloc(CH * fb);
            s0 = Math.max(0, Math.floor(range[0] * sr) - R - 1);
            n = Math.max(0, Math.min(total, Math.ceil(range[1] * sr) + R + 1) - s0);
            x = new Float32Array(n);
            for (i = 0; i < n; i += CH) {
                var m = Math.min(CH, n - i);
                fs.readSync(fd, buf, 0, m * fb, fmt.dataOffset + (s0 + i) * fb);
                for (var s = 0; s < m; s++) {
                    var sum = 0;
                    for (var c = 0; c < fmt.numChannels; c++) {
                        var p = s * fb + c * bps;
                        sum += fmt.audioFormat === 3 ? buf.readFloatLE(p) : (bps === 2 ? buf.readInt16LE(p) / 32768 : buf.readIntLE(p, 3) / 8388608);
                    }
                    x[i + s] = sum / fmt.numChannels;
                }
            }
        } finally { fs.closeSync(fd); }
        var fc = 0.45 * Math.min(1, srOut / sr), tab = new Float32Array((STEPS + 1) * W);
        for (var k = 0; k <= STEPS; k++) {
            var norm = 0;
            for (j = 0; j < W; j++) {
                var d = j - R - k / STEPS, a = d === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * d) / (Math.PI * d);
                var v = a * (0.42 + 0.5 * Math.cos(Math.PI * d / (R + 1)) + 0.08 * Math.cos(2 * Math.PI * d / (R + 1)));
                tab[k * W + j] = v; norm += v;
            }
            for (j = 0; j < W; j++) tab[k * W + j] /= norm;
        }
        var outN = Math.max(0, Math.floor((range[1] - range[0]) * srOut)), y = new Float32Array(outN);
        for (var o = 0; o < outN; o++) {
            var t = (range[0] + o / srOut) * sr - s0, ci = Math.floor(t), base = Math.round((t - ci) * STEPS) * W, acc = 0;
            for (j = 0; j < W; j++) {
                var idx = ci - R + j;
                if (idx >= 0 && idx < n) acc += x[idx] * tab[base + j];
            }
            y[o] = acc;
        }
        return y;
    }

    /* Basic Pitch nota olaylarından ([{ t, p, a }]) melodi nota zamanları: genlik >= 0.45, MIDI 40–88
     * (derin bas ve tiz synth dışarıda), 30 ms içindeki eş zamanlı notalar tek nota. Kong piyano
     * transkripsiyonu referansıyla solo piyanoda F1 0.97 (isabet %96, yakalama %99, zaman hatası medyan
     * 4.4 ms); In the End karışımında girişteki riff notalarının hepsi. Eski DSP yöntemi: F1 0.85, +10 ms. */
    function melodyFromNoteEvents(events, opts) {
        opts = opts || {};
        var minAmp = opts.minAmp || 0.45, lo = opts.minPitch || 40, hi = opts.maxPitch || 88;
        var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], notes = [], names = [], best = [];
        events.filter(function (e) { return e.a >= minAmp && e.p >= lo && e.p <= hi; })
            .sort(function (x, y) { return x.t - y.t; })
            .forEach(function (e) {
                var k = notes.length - 1;
                if (k >= 0 && e.t - notes[k] <= 0.03) {
                    if (e.a > best[k]) { best[k] = e.a; names[k] = NAMES[e.p % 12]; }
                    return;
                }
                notes.push(e.t); best.push(e.a); names.push(NAMES[e.p % 12]);
            });
        return { notes: notes, names: names };
    }

    return {
        MODES: MODES,
        detectOnsets: detectOnsets,
        detectRiffNotes: detectRiffNotes,
        readMonoResampled: readMonoResampled,
        melodyFromNoteEvents: melodyFromNoteEvents,
        alignCuts: alignCuts,
        computeWindowDb: computeWindowDb,
        autoThresholdDb: autoThresholdDb,
        detectSilences: detectSilences,
        analyzeFile: analyzeFile
    };
});
