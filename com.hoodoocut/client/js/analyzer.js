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

    /* Dosyayi stream ederek pencere basina RMS dB dizisi cikar.
     * Donus: { db: [..], windowMs, sampleRate, durationSec } */
    function computeWindowDb(fs, filePath, windowMs) {
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
        var quiet = new Array(db.length);
        var i;
        for (i = 0; i < db.length; i++) quiet[i] = db[i] < opts.thresholdDb;

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
        var analysis = computeWindowDb(fs, filePath, 20);
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
            minSpeechSec: pick('minSpeechSec')
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

    /* ============================================================
     * BEAT / ONSET TESPITI (2. ozellik: muzige gore kesim)
     * Sessizlikte "esik alti" ariyorduk; burada tersine ANI ENERJI
     * SICRAMALARI (kick/snare vurusu) ariyoruz: enerji akisinda (flux)
     * adaptif tepe bulma. computeWindowDb altyapisini yeniden kullanir.
     * ============================================================ */

    /* dB dizisinden enerji-akisi (flux) cikar: pozitif enerji artislari. */
    function computeFlux(dbArr) {
        var n = dbArr.length;
        var energy = new Array(n);
        var i;
        for (i = 0; i < n; i++) energy[i] = Math.pow(10, dbArr[i] / 10); // dB -> lineer guc
        var flux = new Array(n);
        flux[0] = 0;
        for (i = 1; i < n; i++) {
            var d = energy[i] - energy[i - 1];
            flux[i] = d > 0 ? d : 0;
        }
        // normalize (en yuksek %99'luk degere gore; aykiri tepe tek basina baskin olmasin)
        var sorted = flux.slice(0).sort(function (a, b) { return a - b; });
        var norm = sorted[Math.min(n - 1, Math.floor(n * 0.99))] || 1e-9;
        for (i = 0; i < n; i++) flux[i] = flux[i] / norm;
        return flux;
    }

    /* Adaptif tepe bulma: yerel ortalamanin ustundeki yerel maksimumlar.
     * sensitivity 0..1 (yuksek = daha cok vurus). minGapSec ile cift tetik onlenir. */
    function pickOnsets(flux, winSec, sensitivity, minGapSec) {
        var n = flux.length;
        var onsets = [];
        // yerel ortalama penceresi ~0.2 sn
        var W = Math.max(3, Math.round(0.2 / winSec));
        // sensitivity -> esik carpani: dusuk sensitivity yuksek esik
        var factor = 2.2 - 1.7 * sensitivity; // sens 0 -> 2.2 , sens 1 -> 0.5
        var minGapWin = Math.max(1, Math.round(minGapSec / winSec));
        var lastIdx = -minGapWin * 2;
        for (var i = 1; i < n - 1; i++) {
            // yerel ortalama
            var s = 0, c = 0;
            for (var k = i - W; k <= i + W; k++) {
                if (k >= 0 && k < n) { s += flux[k]; c++; }
            }
            var thr = (s / c) * factor + 0.02;
            if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) {
                if (i - lastIdx >= minGapWin) {
                    onsets.push(i * winSec);
                    lastIdx = i;
                }
            }
        }
        return onsets;
    }

    /* Onset araliklarindan BPM tahmini: ardisik araliklarin medyani -> period. */
    function estimateBpm(onsets) {
        if (onsets.length < 4) return 0;
        var diffs = [];
        for (var i = 1; i < onsets.length; i++) diffs.push(onsets[i] - onsets[i - 1]);
        diffs.sort(function (a, b) { return a - b; });
        var med = diffs[Math.floor(diffs.length / 2)];
        if (med <= 0) return 0;
        var bpm = 60 / med;
        // muzik araligina katla (60-200 BPM)
        while (bpm < 60) bpm *= 2;
        while (bpm > 200) bpm /= 2;
        return Math.round(bpm * 10) / 10;
    }

    /* BPM ve onset'lerden duzenli izgara kur; faz, onset'lere en cok denk gelecek
     * sekilde secilir. subdivision: beat'in carpani (1=her beat, 0.5=1/2, 2=2 beat). */
    function buildGrid(onsets, bpm, durationSec, subdivision, minGapSec) {
        var period = (60 / bpm) * subdivision;
        if (period <= 0) return onsets;
        // en iyi faz: onset'leri periyoda gore katla, medyan kalan
        var phases = [];
        for (var i = 0; i < onsets.length; i++) phases.push(onsets[i] % period);
        phases.sort(function (a, b) { return a - b; });
        var phase = phases.length ? phases[Math.floor(phases.length / 2)] : 0;
        var beats = [];
        for (var t = phase; t <= durationSec + 1e-6; t += period) {
            if (t >= 0) beats.push(Math.round(t * 1000) / 1000);
        }
        return beats;
    }

    /* Ana beat tespiti.
     * opts: { sensitivity 0..1, minGapSec, useGrid, manualBpm, subdivision } */
    function detectBeatsFromDb(analysis, opts) {
        opts = opts || {};
        var winSec = analysis.windowMs / 1000;
        var flux = computeFlux(analysis.db);
        var sensitivity = (typeof opts.sensitivity === 'number') ? opts.sensitivity : 0.5;
        var minGap = opts.minGapSec || 0.12;
        var onsets = pickOnsets(flux, winSec, sensitivity, minGap);
        var detectedBpm = estimateBpm(onsets);
        var bpm = (opts.manualBpm && opts.manualBpm > 0) ? opts.manualBpm : detectedBpm;
        var subdivision = opts.subdivision || 1;

        var beats;
        if (opts.useGrid && bpm > 0) {
            beats = buildGrid(onsets, bpm, analysis.durationSec, subdivision, minGap);
        } else {
            // ham vurus modu: subdivision>=2 ise her N onset'i al
            if (subdivision >= 2) {
                var step = Math.round(subdivision);
                var thinned = [];
                for (var i = 0; i < onsets.length; i += step) thinned.push(onsets[i]);
                beats = thinned;
            } else {
                beats = onsets;
            }
        }
        return {
            beats: beats,
            onsetCount: onsets.length,
            detectedBpm: detectedBpm,
            usedBpm: bpm,
            durationSec: analysis.durationSec
        };
    }

    function detectBeatsFile(fs, filePath, opts) {
        var analysis = computeWindowDb(fs, filePath, 10); // 10ms pencere: beat icin yeterli cozunurluk
        return detectBeatsFromDb(analysis, opts);
    }

    /* ---- HIZALAMA PLANI: oyun vuruslarini muzik beat'lerine oturt ----
     * Yaklasim: CONDENSE-ONLY. Bir oyun vurusu, beat'inin ILERISINDEYSE
     * (cur > beat), aradaki fazlalik silinir -> vurus beat'e geri ceker.
     * Vurus beat'in GERISINDEyse zaman EKLENEMEZ (donmus kare olusturmamak
     * icin) -> o vurus atlanir ve raporlanir.
     * Donus: { removeIntervals: [[s,e]...] (ORIJINAL koord, silinecek fazla
     * parcalar), aligned, skipped, removedSec }. Bu araliklar dogrudan
     * track-ozel razor+sil+kompaksiyon hattina verilir.
     *
     * Saf fonksiyon -> Premiere'siz unit test edilebilir. */
    function planBeatAlign(gameHits, beats, opts) {
        opts = opts || {};
        var minRem = opts.minRemoveSec || 0.04; // bundan kucuk kirpma anlamsiz
        var EPS = 1e-6;
        var hits = gameHits.slice(0).sort(function (a, b) { return a - b; });
        var bts = beats.slice(0).sort(function (a, b) { return a - b; });

        var removeIntervals = [];
        var removedTotal = 0;
        var lastTarget = -1e9;
        var lastHitOrig = 0;
        var aligned = 0, skipped = 0;

        for (var i = 0; i < hits.length; i++) {
            var g = hits[i];
            var cur = g - removedTotal; // onceki silmelerden sonraki guncel konum
            // cur'dan kucuk-esit ve lastTarget'tan buyuk en buyuk beat'i bul
            var target = null;
            for (var k = 0; k < bts.length; k++) {
                if (bts[k] > cur + EPS) break;
                if (bts[k] > lastTarget + EPS) target = bts[k];
            }
            if (target === null) { skipped++; lastHitOrig = g; continue; }

            var delta = cur - target;          // >= 0 (target <= cur)
            var available = g - lastHitOrig;   // bu vurustan onceki (orijinal) bosluk
            var rem = Math.min(delta, available);
            if (rem >= minRem) {
                removeIntervals.push([Math.round((g - rem) * 1000) / 1000,
                                      Math.round(g * 1000) / 1000]);
                removedTotal += rem;
                aligned++;
                lastTarget = target;
            } else {
                // zaten beat'e cok yakin ya da kirpilacak yer yok
                if (delta <= minRem) aligned++; else skipped++;
                lastTarget = target;
            }
            lastHitOrig = g;
        }
        return {
            removeIntervals: removeIntervals,
            aligned: aligned,
            skipped: skipped,
            removedSec: Math.round(removedTotal * 1000) / 1000
        };
    }

    return {
        MODES: MODES,
        computeWindowDb: computeWindowDb,
        autoThresholdDb: autoThresholdDb,
        detectSilences: detectSilences,
        analyzeFile: analyzeFile,
        computeFlux: computeFlux,
        pickOnsets: pickOnsets,
        estimateBpm: estimateBpm,
        detectBeatsFromDb: detectBeatsFromDb,
        detectBeatsFile: detectBeatsFile,
        planBeatAlign: planBeatAlign
    };
});
