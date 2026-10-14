/*
 * HooDoo Cut - ExtendScript host (Premiere Pro icinde calisir)
 * NOT: Bu dosya ES3 ExtendScript'tir; JSON, let/const, arrow fn YOK.
 * Tum fonksiyonlar panel'e "OK|..." veya "ERR|..." formatinda string doner.
 * Turkce ozel karakter kullanma (encoding sorunu cikarir).
 *
 * Kesim akisi PARCALI calisir (uzun videolarda donmayi onlemek icin);
 * panel su fonksiyonlari kucuk partiler halinde arka arkaya cagirir:
 *   0) ACS_backupSequence (istege bagli yedek)
 *   1) ACS_razorBatch   - razor (hicbir sey kaymaz, sira serbest)
 *   2) ACS_removeBatch  - ripple'siz silme / ACS_muteBatch - susturma
 *   3) ACS_unlinkAll + ACS_compactBatch - bosluklari kapatma (resmi API,
 *      klipler sola kaydirilir; soldan saga islenir)
 *   4) ACS_relinkBatch  - video/ses parcalarini yeniden linkle
 * NOT: ACS_closeGapsBatch (QE Empty.remove) KULLANIMDAN KALKTI - kullanicinin
 * sequence'inde "Unknown error" veriyordu; referans icin duruyor.
 */

var ACS_TICKS_PER_SECOND = 254016000000; // Premiere'in sabit tick cozunurlugu

function ACS_ping() {
    try {
        return 'OK|pong|' + app.version;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

function ACS_getEnv() {
    try {
        if (!app.project) return 'ERR|Acik proje yok';
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok. Timeline acin.';
        var durSec = 0;
        try { durSec = parseFloat(seq.end) / ACS_TICKS_PER_SECOND; } catch (e1) {}
        // Track basina clip sayisi (panel ses/video secim listelerini kurar)
        var aCounts = [];
        for (var i = 0; i < seq.audioTracks.numTracks; i++) {
            var c = 0;
            try { c = seq.audioTracks[i].clips.numItems; } catch (eC) {}
            aCounts.push(c);
        }
        var vCounts = [];
        for (var j = 0; j < seq.videoTracks.numTracks; j++) {
            var cv = 0;
            try { cv = seq.videoTracks[j].clips.numItems; } catch (eV) {}
            vCounts.push(cv);
        }
        return 'OK|' + app.project.name +
               '|' + seq.name +
               '|' + seq.videoTracks.numTracks +
               '|' + seq.audioTracks.numTracks +
               '|' + durSec +
               '|' + aCounts.join(',') +
               '|' + vCounts.join(',');
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* Timeline'da secili cliplerin zaman araliklarini doner: "s1,e1;s2,e2" (saniye).
 * Bolge bolge farkli mod uygulamak icin kullanilir. */
function ACS_getSelection() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var sel = seq.getSelection();
        if (!sel || sel.length === 0) return 'ERR|Secili clip yok';
        var parts = [];
        for (var i = 0; i < sel.length; i++) {
            try {
                var it = sel[i];
                if (it.mediaType === 'Empty') continue;
                parts.push(it.start.seconds + ',' + it.end.seconds);
            } catch (e1) { throw e1; }
        }
        if (parts.length === 0) return 'ERR|Secili clip yok';
        var context = ACS_getAnalysisContext();
        if (context.split('|')[0] !== 'OK') return context;
        return 'OK|' + parts.join(';') + '|' + context.split('|')[1];
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Analiz icin track secimi (gecici mute) ----
 * Secilmeyen ses track'leri mute edilir -> export mix'ine girmezler.
 * Analiz bitince ACS_restoreMutes ile eski durum geri yuklenir. */

var ACS_savedMutes = null;

/* setMute API'si surume gore parametre alabilir ya da toggle olabilir;
 * her durumda isMuted() ile DOGRULAYARAK ayarla. */
function ACS_setTrackMute(tr, wantMuted) {
    try {
        var cur = tr.isMuted();
        if (cur === wantMuted) return true;
        try { tr.setMute(wantMuted ? 1 : 0); } catch (e1) {}
        try { if (tr.isMuted() === wantMuted) return true; } catch (e2) {}
        try { tr.setMute(); } catch (e3) {} // belki parametresiz toggle
        try { return tr.isMuted() === wantMuted; } catch (e4) {}
    } catch (e) {}
    return false;
}

function ACS_muteForAnalysis(includeStr) {
    try {
        if (ACS_savedMutes) {
            var restored = ACS_restoreMutes();
            if (restored.split('|')[0] !== 'OK') return restored;
        }
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var include = {};
        var parts = ('' + includeStr).split(',');
        for (var i = 0; i < parts.length; i++) {
            var n = parseInt(parts[i], 10);
            if (!isNaN(n)) include[n] = true;
        }
        ACS_savedMutes = [];
        var changed = 0, failed = 0;
        for (var t = 0; t < seq.audioTracks.numTracks; t++) {
            var tr = seq.audioTracks[t];
            var was = tr.isMuted();
            ACS_savedMutes.push({ ref: tr, muted: was });
        }
        for (var j = 0; j < ACS_savedMutes.length; j++) {
            var saved = ACS_savedMutes[j];
            var was = saved.muted;
            var want = include[j] ? false : true;
            if (was !== want) {
                if (ACS_setTrackMute(saved.ref, want)) changed++;
                else failed++;
            }
        }
        return 'OK|' + changed + '|' + failed;
    } catch (e) {
        var recovery = ACS_restoreMutes();
        return 'ERR|' + e.toString() + (recovery.split('|')[0] === 'OK' ? '' : '; ' + recovery);
    }
}

function ACS_restoreMutes() {
    try {
        if (!ACS_savedMutes) return 'OK|0';
        var n = 0, pending = [];
        for (var t = 0; t < ACS_savedMutes.length; t++) {
            var saved = ACS_savedMutes[t];
            if (ACS_setTrackMute(saved.ref, saved.muted)) n++;
            else pending.push(saved);
        }
        if (pending.length) {
            ACS_savedMutes = pending;
            return 'ERR|' + pending.length + ' track mute geri yuklenemedi';
        }
        ACS_savedMutes = null;
        return 'OK|' + n;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Export ---- */

/* Coklu preset deneyen export: presetsStr "yol1||yol2||..." formatinda.
 * Ilk calisani kullanir, hicbiri olmazsa tum denemelerin hatasini doner. */
function ACS_exportAudio2(outPath, presetsStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';

        var old = new File(outPath);
        if (old.exists) { try { old.remove(); } catch (e0) {} }

        var presets = ('' + presetsStr).split('||');
        var attempts = [];
        for (var i = 0; i < presets.length; i++) {
            var pf = new File(presets[i]);
            if (!pf.exists) { attempts.push('p' + i + ':dosya yok'); continue; }
            var res = '';
            try {
                res = seq.exportAsMediaDirect(outPath, pf.fsName, 0); // 0 = tum sequence
            } catch (e1) {
                res = 'exception: ' + e1.toString();
            }
            var f = new File(outPath);
            if (f.exists && f.length > 1000) {
                return 'OK|' + outPath + '|' + f.length + '|preset' + i;
            }
            attempts.push('p' + i + ':' + res);
        }
        return 'ERR|' + attempts.join(' ~ ');
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* Yedek plan: Adobe Media Encoder kuyruguyla export. Asenkron calisir;
 * panel dosyanin olusmasini bekler (poll). */
function ACS_exportAudioAME(outPath, presetPath) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var pf = new File(presetPath);
        if (!pf.exists) return 'ERR|Preset yok: ' + presetPath;

        var old = new File(outPath);
        if (old.exists) { try { old.remove(); } catch (e0) {} }

        app.encoder.launchEncoder();
        // (sequence, cikti, preset, workArea=0 tum sequence, bitince kuyruktan sil=1)
        var jobId = app.encoder.encodeSequence(seq, outPath, pf.fsName, 0, 1);
        app.encoder.startBatch();
        return 'OK|' + jobId;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Ortak yardimcilar ---- */

function ACS_parseSilences(silStr) {
    var out = [];
    var parts = ('' + silStr).split(';');
    for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        var se = parts[i].split(',');
        if (se.length !== 2) continue;
        var s = parseFloat(se[0]);
        var e = parseFloat(se[1]);
        if (!isNaN(s) && !isNaN(e) && e > s) out.push({ start: s, end: e });
    }
    return out;
}

/* Icinde clip olan track indekslerini bul (bos track'lere razor atmak israf) */
function ACS_getContentTrackIndices(seq) {
    var v = [], a = [], i;
    for (i = 0; i < seq.videoTracks.numTracks; i++) {
        if (seq.videoTracks[i].clips.numItems > 0) v.push(i);
    }
    for (i = 0; i < seq.audioTracks.numTracks; i++) {
        if (seq.audioTracks[i].clips.numItems > 0) a.push(i);
    }
    return { v: v, a: a };
}

function ACS_razorAllTracksAt(seq, qeSeq, seconds, tracks) {
    // Player'i tasiyip CTI timecode'unu oku: timecode formati/drop-frame otomatik dogru olur
    var t = new Time();
    t.seconds = seconds;
    seq.setPlayerPosition(t.ticks);
    ACS_razorTracksAtTimecode(qeSeq, qeSeq.CTI.timecode, tracks);
}

/* QE item zamanlari surume gore .secs ya da .seconds olabiliyor */
function ACS_qeItemSec(timeObj) {
    try {
        if (timeObj.secs !== undefined) return timeObj.secs;
        if (timeObj.seconds !== undefined) return timeObj.seconds;
    } catch (e) {}
    return null;
}

function ACS_pad2(n) { return (n < 10 ? '0' : '') + n; }

/* Kare numarasini timecode stringine cevir (drop-frame destekli, standart
 * SMPTE algoritmasi). fps: gercek fps (29.97 gibi), fpsR: yuvarlanmis. */
function ACS_frameToTimecode(frameNumber, fps, dropFrame) {
    var fpsR = Math.round(fps);
    var fn = frameNumber;
    if (dropFrame && (fpsR === 30 || fpsR === 60)) {
        var dropPer = (fpsR === 30) ? 2 : 4;
        var per10Min = Math.round(fps * 600);          // 30DF: 17982
        var perMin = fpsR * 60 - dropPer;              // 30DF: 1798
        var d = Math.floor(fn / per10Min);
        var m = fn % per10Min;
        if (m > dropPer) {
            fn += (dropPer * 9 * d) + dropPer * Math.floor((m - dropPer) / perMin);
        } else {
            fn += dropPer * 9 * d;
        }
    }
    var ff = fn % fpsR;
    var totalSec = Math.floor(fn / fpsR);
    var ss = totalSec % 60;
    var mm = Math.floor(totalSec / 60) % 60;
    var hh = Math.floor(totalSec / 3600);
    var sep = dropFrame ? ';' : ':';
    return ACS_pad2(hh) + sep + ACS_pad2(mm) + sep + ACS_pad2(ss) + sep + ACS_pad2(ff);
}

/* ---- Faz 1: Razor (parcali) ----
 * boundariesStr: "b1;b2;b3" (saniye). Hicbir sey kaymadigi icin sira serbest.
 *
 * Hiz: player'i her sinira tasiyip CTI okumak cok pahali (uzun videolarda
 * dakikalar). Bunun yerine parti basina BIR kalibrasyon seek'i yapilir:
 * hesapladigimiz timecode CTI ile birebir tutuyorsa partinin kalani saf
 * matematikle uretilir (fast mode). Tutmazsa eski guvenli yontem kullanilir. */
function ACS_razorBatch(boundariesStr, tracksMode) {
    try {
        ACS_checkEditSequence();
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        app.enableQE();
        var qeSeq = qe.project.getActiveSequence();
        if (!qeSeq) return 'ERR|QE sequence alinamadi';

        var seqDur = parseFloat(seq.end) / ACS_TICKS_PER_SECOND;
        var parts = ('' + boundariesStr).split(';');
        var bs = [];
        var skipped = 0;
        for (var i = 0; i < parts.length; i++) {
            var b = parseFloat(parts[i]);
            if (isNaN(b)) continue;
            if (b <= 0.01 || b >= seqDur - 0.01) { skipped++; continue; }
            bs.push(b);
        }
        if (bs.length === 0) return 'OK|0|' + skipped + '|0||seek';

        // Kalibrasyon: ilk sinira seek yap, CTI'yi hesabimizla karsilastir
        var fps = ACS_TICKS_PER_SECOND / parseFloat(seq.timebase);
        var t = new Time();
        t.seconds = bs[0];
        seq.setPlayerPosition(t.ticks);
        var cti = qeSeq.CTI.timecode;
        var dropFrame = cti.indexOf(';') >= 0;
        var mode = 'seek';
        if (cti === ACS_frameToTimecode(Math.floor(bs[0] * fps + 1e-6), fps, dropFrame)) {
            mode = 'floor';
        } else if (cti === ACS_frameToTimecode(Math.round(bs[0] * fps), fps, dropFrame)) {
            mode = 'round';
        }

        var tracks = ACS_getContentTrackIndices(seq);
        // Sustur modu yalniz ses kliplerini etkiler; videoyu kesmeye gerek yok
        if (tracksMode === 'audio') tracks = { v: [], a: tracks.a };

        // PERFORMANS: qeSeq.razor(tc) TUM track'leri TEK cagrida boler ve
        // linkleri korur (native cut davranisi). Track basina ayri razor'a
        // gore ~3x az cagri. Sustur modunda (sadece ses) per-track kalir.
        var useSeqRazor = (tracksMode !== 'audio');
        if (useSeqRazor) {
            try { useSeqRazor = (typeof qeSeq.razor === 'function'); }
            catch (eC) { useSeqRazor = false; }
        }

        var done = 0, errors = 0, firstErr = '';
        for (var k = 0; k < bs.length; k++) {
            try {
                var tc2;
                if (mode === 'seek') {
                    var tk = new Time();
                    tk.seconds = bs[k];
                    seq.setPlayerPosition(tk.ticks);
                    tc2 = qeSeq.CTI.timecode;
                } else {
                    var frame = (mode === 'floor')
                        ? Math.floor(bs[k] * fps + 1e-6)
                        : Math.round(bs[k] * fps);
                    tc2 = ACS_frameToTimecode(frame, fps, dropFrame);
                }
                if (useSeqRazor) qeSeq.razor(tc2);
                else ACS_razorTracksAtTimecode(qeSeq, tc2, tracks);
                done++;
            } catch (e1) {
                return 'ERR|Razor durduruldu (' + done + ' sinir tamamlandi): ' + e1.toString();
            }
        }
        return 'OK|' + done + '|' + skipped + '|' + errors + '|' + firstErr + '|' + mode +
               ' ' + (useSeqRazor ? 'seqrazor' : ('pertrack V' + tracks.v.length + '+A' + tracks.a.length));
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

function ACS_razorTracksAtTimecode(qeSeq, tc, tracks) {
    var i, tr;
    for (i = 0; i < tracks.v.length; i++) {
        tr = qeSeq.getVideoTrackAt(tracks.v[i]);
        if (!tr) throw new Error('QE video track alinamadi');
        tr.razor(tc);
    }
    for (i = 0; i < tracks.a.length; i++) {
        tr = qeSeq.getAudioTrackAt(tracks.a[i]);
        if (!tr) throw new Error('QE ses track alinamadi');
        tr.razor(tc);
    }
}

/* ---- Faz 3 (v0.7): Link-guvenli kompaksiyon ----
 * Eski yaklasim unlink -> move -> relink yapiyordu; relink yavas ve buglu.
 * Yeni: HIC unlink YOK. Iki adim:
 *   ACS_compactPrepare: her klibin HEDEF pozisyonunu (orijinal - onceki
 *     kesimlerin toplami) bir kez hesaplar, global listede tutar.
 *   ACS_compactApply: her klibi MEVCUT pozisyonuna gore goreli tasir
 *     (delta = hedef - mevcut). Idempotent: linkli partner zaten tasidiysa
 *     delta~0 cikar, no-op olur; tasimadiysa biz tasiriz. Boylece linkin
 *     klipleri birlikte tasiyip tasimadigini BILMEK ZORUNDA degiliz ve cift
 *     tasima imkansiz. Linkler hic bozulmadigi icin relink de gereksiz.
 * Kesimler razor ile AYNI kare gridine snap'lenir ki bosluklar tam kapansin. */

var ACS_moveTargets = null;
var ACS_moveEps = 0.02;

function ACS_compactPrepare(cutsStr, tcMode) {
    try {
        ACS_checkEditSequence();
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var cuts = ACS_parseSilences(cutsStr);
        ACS_moveTargets = [];
        if (cuts.length === 0) return 'OK|0|0';

        var fps = ACS_TICKS_PER_SECOND / parseFloat(seq.timebase);
        ACS_moveEps = 0.5 / fps; // yarim kare toleransi
        var i;
        // Panel kesimleri onceden kareye hizalar; tekrar yuvarlama kayma uretir.
        cuts.sort(function (a, b) { return a.start - b.start; });

        var prefixEnd = [], prefixTot = [];
        var acc = 0;
        for (i = 0; i < cuts.length; i++) {
            acc += cuts[i].end - cuts[i].start;
            prefixEnd.push(cuts[i].end);
            prefixTot.push(acc);
        }
        var EPS = 0.000001;
        function offsetFor(s) {
            var lo = 0, hi = prefixEnd.length - 1, ans = 0;
            while (lo <= hi) {
                var mid = (lo + hi) >> 1;
                if (prefixEnd[mid] <= s + EPS) { ans = prefixTot[mid]; lo = mid + 1; }
                else hi = mid - 1;
            }
            return ans;
        }

        var tracks = ACS_getContentTrackIndices(seq);
        var lists = [], t;
        for (t = 0; t < tracks.v.length; t++) lists.push(seq.videoTracks[tracks.v[t]]);
        for (t = 0; t < tracks.a.length; t++) lists.push(seq.audioTracks[tracks.a[t]]);

        var total = 0;
        for (t = 0; t < lists.length; t++) {
            var track = lists[t];
            var cnt = track.clips.numItems;
            for (var c = 0; c < cnt; c++) {
                total++;
                try {
                    var item = track.clips[c];
                    var s = item.start.seconds;
                    var off = offsetFor(s);
                    if (off > 0.0005) {
                        ACS_moveTargets.push({ ref: item, target: s - off });
                    }
                } catch (eI) { throw eI; }
            }
        }
        return 'OK|' + ACS_moveTargets.length + '|' + total;
    } catch (e) {
        ACS_moveTargets = null;
        return 'ERR|' + e.toString();
    }
}

function ACS_compactApply(from, count) {
    try {
        ACS_checkEditSequence();
        if (!ACS_moveTargets) return 'ERR|compactPrepare cagrilmadi (global bos)';
        var f = parseInt(from, 10) || 0;
        var n = parseInt(count, 10) || 60;
        var to = Math.min(f + n, ACS_moveTargets.length);
        var moved = 0, errors = 0, firstErr = '';
        for (var i = f; i < to; i++) {
            var mt = ACS_moveTargets[i];
            try {
                var cur = mt.ref.start.seconds;       // partner zaten tasimis olabilir
                var delta = mt.target - cur;
                if (delta < -ACS_moveEps || delta > ACS_moveEps) {
                    mt.ref.move(delta);
                    if (Math.abs(mt.ref.start.seconds - mt.target) > ACS_moveEps) {
                        throw new Error('Klip hedef konuma tasinamadi');
                    }
                    moved++;
                }
            } catch (eM) {
                return 'ERR|' + eM.toString();
            }
        }
        return 'OK|' + (to - f) + '|' + moved + '|' + ACS_moveTargets.length +
               '|' + errors + '|' + firstErr;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Faz 2: Ripple'siz silme (parcali) ----
 * Track basina clip listesi BIR KEZ okunur (snapshot), eslestirme bellekte
 * merge-scan ile yapilir. Eski O(aralik x clip) DOM taramasi uzun videolarda
 * donduruyordu; bu surum O(aralik + clip). Ripple olmadigi icin hicbir sey
 * kaymaz, partiler arasi tutarlilik garantili. */
var ACS_editSequenceID = null;
var ACS_clipAction = null;

/* Premiere'in resmi Track DOM'u kilit bilgisini sunmayabilir; QE'ye dus.
 * Bilinmeyen durum kilitsiz varsayilmaz. */
function ACS_trackLocked(track, group, index) {
    if (typeof track.isLocked === 'function') return !!track.isLocked();
    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (!qeSeq) throw new Error('Track kilidi okunamadi: QE sequence yok');
    var qeTrack = group === 0 ? qeSeq.getVideoTrackAt(index) : qeSeq.getAudioTrackAt(index);
    if (!qeTrack || typeof qeTrack.isLocked !== 'function') throw new Error('Track kilidi okunamadi');
    var locked = qeTrack.isLocked();
    if (locked !== true && locked !== false && locked !== 0 && locked !== 1) {
        throw new Error('Track kilit durumu belirsiz');
    }
    return !!locked;
}

/* Yapısal kimlik: ad ve sure ayni kalsa bile farkli sequence/kaynak/yerlesim
 * eski analizi gecersiz kilar. Ses efekti degisiklikleri icin tekrar analiz gerekir. */
function ACS_getAnalysisContext() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var parts = [app.project.path, seq.sequenceID, seq.timebase, seq.end, seq.zeroPoint, seq.videoDisplayFormat];
        var groups = [seq.videoTracks, seq.audioTracks];
        for (var g = 0; g < groups.length; g++) {
            parts.push(groups[g].numTracks);
            for (var t = 0; t < groups[g].numTracks; t++) {
                var track = groups[g][t];
                parts.push(track.clips.numItems > 0 ? ACS_trackLocked(track, g, t) : '',
                    g === 1 ? track.isMuted() : '', track.clips.numItems);
                for (var c = 0; c < track.clips.numItems; c++) {
                    var it = track.clips[c];
                    parts.push(it.nodeId, it.start.seconds, it.end.seconds,
                        it.inPoint.seconds, it.outPoint.seconds, it.disabled);
                    if (typeof it.getSpeed === 'function') parts.push(it.getSpeed(), it.isSpeedReversed());
                    if (it.projectItem) parts.push(it.projectItem.nodeId, it.projectItem.getMediaPath());
                }
            }
        }
        // Uzun timeline kimligini CEP koprusune sabit boyutta aktar.
        var value = parts.join('\n'), h1 = 2166136261, h2 = 5381;
        for (var i = 0; i < value.length; i++) {
            h1 = ((h1 << 5) - h1) ^ value.charCodeAt(i);
            h2 = ((h2 << 5) + h2) ^ value.charCodeAt(i);
        }
        return 'OK|' + (h1 >>> 0) + ':' + (h2 >>> 0) + ':' + value.length +
            '|' + (ACS_TICKS_PER_SECOND / parseFloat(seq.timebase));
    } catch (e) { return 'ERR|' + e.toString(); }
}

function ACS_beginEdit(expectedContext, manage) {
    ACS_endEdit();
    var context = ACS_getAnalysisContext();
    if (context.split('|')[0] !== 'OK') return context;
    if (context.split('|')[1] !== expectedContext) return 'ERR|Timeline degisti. Tekrar analiz edin.';
    var seq = app.project.activeSequence;
    var groups = manage === 'mute' ? [seq.audioTracks] : [seq.videoTracks, seq.audioTracks];
    for (var g = 0; g < groups.length; g++) {
        for (var t = 0; t < groups[g].numTracks; t++) {
            var track = groups[g][t];
            if (track.clips.numItems > 0 && ACS_trackLocked(track, manage === 'mute' ? 1 : g, t)) {
                return 'ERR|Islemden once ilgili track kilitlerini acin';
            }
        }
    }
    ACS_editSequenceID = app.project.activeSequence.sequenceID;
    return 'OK';
}

function ACS_endEdit() {
    ACS_editSequenceID = null;
    ACS_clipAction = null;
    ACS_moveTargets = null;
    return 'OK';
}

function ACS_checkEditSequence() {
    if (ACS_editSequenceID !== null && (!app.project.activeSequence ||
        app.project.activeSequence.sequenceID !== ACS_editSequenceID)) {
        throw new Error('Aktif sequence degisti. Islem durduruldu.');
    }
}

/* Butun araliklar icin tek DOM taramasi. Ripple olmadan referanslar kalir. */
function ACS_prepareClipAction(silencesStr, action) {
    try {
        ACS_checkEditSequence();
        ACS_clipAction = null;
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        if (action !== 'remove' && action !== 'mute') return 'ERR|Gecersiz klip islemi';
        var ivs = ACS_parseSilences(silencesStr);
        ivs.sort(function (a, b) { return a.start - b.start; });
        var targets = [], EPS = 0.000001;
        var groups = action === 'mute' ? [seq.audioTracks] : [seq.videoTracks, seq.audioTracks];
        for (var g = 0; g < groups.length; g++) {
            for (var t = 0; t < groups[g].numTracks; t++) {
                var track = groups[g][t];
                if (track.clips.numItems > 0 && ACS_trackLocked(track, action === 'mute' ? 1 : g, t)) {
                    throw new Error('Ilgili track kilitli; islem durduruldu');
                }
                var snap = [];
                for (var c = 0; c < track.clips.numItems; c++) {
                    var it = track.clips[c];
                    snap.push({ ref: it, s: it.start.seconds, e: it.end.seconds,
                                g: action === 'mute' ? 1 : g, t: t });
                }
                snap.sort(function (a, b) { return a.s - b.s; });
                var trackTargets = [], k = 0;
                for (var i = 0; i < snap.length; i++) {
                    var sn = snap[i];
                    while (k < ivs.length && ivs[k].end < sn.s + EPS) k++;
                    if (k < ivs.length && sn.s >= ivs[k].start - EPS && sn.e <= ivs[k].end + EPS) {
                        trackTargets.push(sn);
                    } else if (k < ivs.length && sn.s < ivs[k].end - EPS && sn.e > ivs[k].start + EPS) {
                        throw new Error('Kesim sinirini asan klip bulundu; razor sonucunu kontrol edin.');
                    }
                }
                for (var r = trackTargets.length - 1; r >= 0; r--) targets.push(trackTargets[r]);
            }
        }
        ACS_clipAction = { targets: targets, action: action, next: 0, sequenceID: seq.sequenceID };
        return 'OK|' + targets.length;
    } catch (e) { ACS_clipAction = null; return 'ERR|' + e.toString(); }
}

/* URI escaping keeps paths and arbitrary names outside the pipe protocol. */
function ACS_getBulkIdentity() {
    try {
        ACS_checkEditSequence();
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        return 'OK|' + encodeURIComponent(app.project.path) + '|' + encodeURIComponent(seq.sequenceID);
    } catch (e) { return 'ERR|' + e.toString(); }
}

function ACS_getBulkPlan() {
    try {
        ACS_checkEditSequence();
        var job = ACS_clipAction;
        if (!job || job.action !== 'remove' || job.next !== 0) return 'ERR|Silme plani hazir degil';
        var lines = [ACS_getBulkIdentity()], checkedTracks = {};
        if (lines[0].indexOf('OK|') !== 0) return lines[0];
        for (var i = 0; i < job.targets.length; i++) {
            var sn = job.targets[i];
            var seq = app.project.activeSequence;
            var track = (sn.g === 0 ? seq.videoTracks : seq.audioTracks)[sn.t];
            var key = sn.g + ':' + sn.t;
            if (!checkedTracks[key]) {
                if (ACS_trackLocked(track, sn.g, sn.t)) throw new Error('Hedef track kilitli');
                checkedTracks[key] = true;
            }
            if (Math.abs(sn.ref.start.seconds - sn.s) > 0.000001 ||
                Math.abs(sn.ref.end.seconds - sn.e) > 0.000001) throw new Error('Hedef klip degisti');
            var source = sn.ref.projectItem;
            lines.push([sn.g, sn.t, sn.s, sn.e, sn.ref.inPoint.seconds, sn.ref.outPoint.seconds,
                encodeURIComponent(source.getMediaPath()), encodeURIComponent(source.name || '')].join(','));
        }
        return lines.join('\n');
    } catch (e) { return 'ERR|' + e.toString(); }
}

function ACS_applyClipAction(from, count) {
    try {
        ACS_checkEditSequence();
        var job = ACS_clipAction;
        if (!job) return 'ERR|Klip islemi hazirlanmadi';
        if (!app.project.activeSequence || app.project.activeSequence.sequenceID !== job.sequenceID) {
            return 'ERR|Aktif sequence degisti';
        }
        var f = parseInt(from, 10), n = parseInt(count, 10);
        if (f !== job.next || !(n > 0)) return 'ERR|Gecersiz klip partisi';
        var to = Math.min(f + n, job.targets.length), changed = 0;
        for (var i = f; i < to; i++) {
            var sn = job.targets[i];
            if (Math.abs(sn.ref.start.seconds - sn.s) > 0.000001 ||
                Math.abs(sn.ref.end.seconds - sn.e) > 0.000001) throw new Error('Hedef klip yeri degisti');
            if (job.action === 'remove') {
                // Host surumune gore basari 0 veya true; eski host'larda undefined olabilir.
                var result = sn.ref.remove(false, false);
                if (result !== undefined && result !== 0 && result !== true) {
                    throw new Error('Klip silinemedi: ' + result);
                }
            } else {
                sn.ref.disabled = true;
                if (!sn.ref.disabled) throw new Error('Klip susturulamadi');
            }
            changed++;
            job.next = i + 1;
        }
        return 'OK|' + (to - f) + '|' + changed + '|' + job.targets.length;
    } catch (e) { ACS_clipAction = null; return 'ERR|' + e.toString(); }
}

function ACS_removeBatch(silencesStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var ivs = ACS_parseSilences(silencesStr);
        if (ivs.length === 0) return 'OK|0';
        ivs.sort(function (a, b) { return a.start - b.start; });

        var EPS = 0.000001; // yalniz kayan nokta toleransi; komsu kareleri silme
        var removed = 0;
        var groups = [seq.videoTracks, seq.audioTracks];
        for (var g = 0; g < groups.length; g++) {
            var tracks = groups[g];
            for (var t = 0; t < tracks.numTracks; t++) {
                var track = tracks[t];
                try { if (track.isLocked()) continue; } catch (eL) {}

                // 1) Anlik goruntu: DOM'a track basina tek gecis
                var snap = [];
                var n = track.clips.numItems;
                for (var c = 0; c < n; c++) {
                    try {
                        var it = track.clips[c];
                        snap.push({ ref: it, s: it.start.seconds, e: it.end.seconds });
                    } catch (eS) {}
                }
                snap.sort(function (a, b) { return a.s - b.s; });

                // 2) Merge-scan: iki sirali liste tek gecis
                var toRemove = [];
                var k = 0;
                for (var si = 0; si < snap.length; si++) {
                    var sn = snap[si];
                    while (k < ivs.length && ivs[k].end + EPS < sn.s) k++;
                    for (var kk = k; kk < ivs.length && ivs[kk].start - EPS <= sn.s; kk++) {
                        if (sn.s >= ivs[kk].start - EPS && sn.e <= ivs[kk].end + EPS) {
                            toRemove.push(sn.ref);
                            break;
                        }
                    }
                }

                // 3) Sondan basa sil (index kaymasi olmasin)
                for (var r = toRemove.length - 1; r >= 0; r--) {
                    toRemove[r].remove(false, false); removed++;
                }
            }
        }
        return 'OK|' + removed;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Faz 2b: Susturma (parcali) ----
 * Sessizlik araligina oturan SES kliplerini devre disi birakir (disabled).
 * Hicbir sey kaymaz; "Mute silences" davranisi. removeBatch ile ayni
 * snapshot + merge-scan yaklasimi. */
function ACS_muteBatch(silencesStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var ivs = ACS_parseSilences(silencesStr);
        if (ivs.length === 0) return 'OK|0';
        ivs.sort(function (a, b) { return a.start - b.start; });

        var EPS = 0.000001;
        var muted = 0;
        var tracks = seq.audioTracks;
        for (var t = 0; t < tracks.numTracks; t++) {
            var track = tracks[t];
            try { if (track.isLocked()) continue; } catch (eL) {}

            var snap = [];
            var n = track.clips.numItems;
            for (var c = 0; c < n; c++) {
                try {
                    var it = track.clips[c];
                    snap.push({ ref: it, s: it.start.seconds, e: it.end.seconds });
                } catch (eS) {}
            }
            snap.sort(function (a, b) { return a.s - b.s; });

            var k = 0;
            for (var si = 0; si < snap.length; si++) {
                var sn = snap[si];
                while (k < ivs.length && ivs[k].end + EPS < sn.s) k++;
                for (var kk = k; kk < ivs.length && ivs[kk].start - EPS <= sn.s; kk++) {
                    if (sn.s >= ivs[kk].start - EPS && sn.e <= ivs[kk].end + EPS) {
                        sn.ref.disabled = true; muted++;
                        break;
                    }
                }
            }
        }
        return 'OK|' + muted;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Faz 3 (yeni): Kompaksiyon — bosluklari kapatma ----
 * QE Empty.remove bu kullanicinin sequence'inde "Unknown error" veriyor;
 * bunun yerine RESMI API ile kalan klipler sola kaydirilir:
 * yeni pozisyon = eski pozisyon - (clip'ten once biten kesimlerin toplami).
 * Kesim sinirlari razor'la AYNI kare hizalamasina oturtulur (tcMode), boylece
 * kaydirma miktarlari tam kare kati olur ve klipler boşluksuz birlesir.
 * Klipler soldan saga islenir: sola tasinan klip her zaman bosalmis alana gider.
 * ONEMLI: cagirmadan once ACS_unlinkAll ile linkler cozulmeli, yoksa linkli
 * partner birlikte suruklenip cift kayma olur. */

function ACS_snapSec(x, fps, tcMode) {
    if (tcMode === 'round') return Math.round(x * fps) / fps;
    return Math.floor(x * fps + 1e-6) / fps;
}

function ACS_compactBatch(cutsStr, globalFrom, count, tcMode) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var cuts = ACS_parseSilences(cutsStr);
        if (cuts.length === 0) return 'OK|0|0|0|0|';
        var fps = ACS_TICKS_PER_SECOND / parseFloat(seq.timebase);
        var i;
        for (i = 0; i < cuts.length; i++) {
            cuts[i].start = ACS_snapSec(cuts[i].start, fps, tcMode);
            cuts[i].end = ACS_snapSec(cuts[i].end, fps, tcMode);
        }
        cuts.sort(function (a, b) { return a.start - b.start; });

        // kumulatif kesim toplami (binary search ile sorgulanir)
        var prefixEnd = [], prefixTot = [];
        var acc = 0;
        for (i = 0; i < cuts.length; i++) {
            acc += cuts[i].end - cuts[i].start;
            prefixEnd.push(cuts[i].end);
            prefixTot.push(acc);
        }
        var EPS = 0.05;
        function offsetFor(s) {
            var lo = 0, hi = prefixEnd.length - 1, ans = 0;
            while (lo <= hi) {
                var mid = (lo + hi) >> 1;
                if (prefixEnd[mid] <= s + EPS) { ans = prefixTot[mid]; lo = mid + 1; }
                else hi = mid - 1;
            }
            return ans;
        }

        var tracks = ACS_getContentTrackIndices(seq);
        var lists = [], t;
        for (t = 0; t < tracks.v.length; t++) lists.push(seq.videoTracks[tracks.v[t]]);
        for (t = 0; t < tracks.a.length; t++) lists.push(seq.audioTracks[tracks.a[t]]);

        var total = 0;
        for (t = 0; t < lists.length; t++) total += lists[t].clips.numItems;

        var from = parseInt(globalFrom, 10) || 0;
        var n = parseInt(count, 10) || 60;
        var idx = 0, processed = 0, movedCount = 0, errors = 0, firstErr = '';

        for (t = 0; t < lists.length; t++) {
            if (processed >= n) break;
            var track = lists[t];
            var cnt = track.clips.numItems;
            if (idx + cnt <= from) { idx += cnt; continue; }
            for (var c = 0; c < cnt; c++) {
                if (idx < from) { idx++; continue; }
                if (processed >= n) break;
                idx++;
                processed++;
                try {
                    var item = track.clips[c];
                    var s = item.start.seconds;
                    var off = offsetFor(s);
                    if (off <= 0.0005) continue; // ilk kesimden onceki clipler kaymaz
                    item.move(-off); // resmi API: saniye cinsinden goreli kaydirma
                    var after = item.start.seconds;
                    if (Math.abs(after - (s - off)) > 0.05) {
                        // move beklenmedik davrandi: tek clip etkilenmisken DURDUR
                        return 'ERR|move dogrulanamadi: beklenen ' + (s - off).toFixed(3) +
                               ' gerceklesen ' + after.toFixed(3) + ' (clip #' + idx +
                               '). Ctrl+Z ile geri alin.';
                    }
                    movedCount++;
                } catch (eM) {
                    errors++;
                    if (!firstErr) firstErr = eM.toString();
                }
            }
        }
        return 'OK|' + processed + '|' + movedCount + '|' + total + '|' + errors + '|' + firstErr;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* Tum icerikli tracklerdeki kliplerin linklerini coz (kompaksiyon oncesi sart) */
function ACS_unlinkAll() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var groups = [seq.videoTracks, seq.audioTracks];
        var sel = 0;
        for (var g = 0; g < groups.length; g++) {
            for (var t = 0; t < groups[g].numTracks; t++) {
                var track = groups[g][t];
                for (var c = 0; c < track.clips.numItems; c++) {
                    try { track.clips[c].setSelected(true, false); sel++; } catch (e1) {}
                }
            }
        }
        try { seq.unlinkSelection(); } catch (eU) {}
        ACS_clearSelection(seq);
        return 'OK|' + sel;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Faz 4: Yeniden linkleme (parcali) ----
 * QE razor track'leri bagimsiz boldugu icin parcalarin video-ses linki
 * kopabiliyor. Ticari AutoCut gibi sonucu linkli birakmak icin: ilk dolu
 * video track'in her clip'i, ayni zaman araligindaki ses clipleriyle
 * secilip resmi linkSelection() API'siyle baglanir.
 * fromIdx/count: video clip indeksine gore parti. doClear: ilk partide
 * timeline'daki mevcut secimi temizle. */
function ACS_relinkBatch(fromIdx, count, doClear) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        if (!seq.linkSelection) return 'ERR|linkSelection API bu surumde yok';
        var tracks = ACS_getContentTrackIndices(seq);
        if (tracks.v.length === 0 || tracks.a.length === 0) return 'OK|0|0|0';
        var vTrack = seq.videoTracks[tracks.v[0]];
        var total = vTrack.clips.numItems;
        var from = parseInt(fromIdx, 10) || 0;
        var n = parseInt(count, 10) || 25;
        var to = Math.min(from + n, total);
        var EPS = 0.12;

        if (doClear === 'true' || doClear === true) ACS_clearSelection(seq);

        // Ses track snapshotlari (sirali) + ilerleyen pointer'lar:
        // video clipleri de sirali oldugundan toplam tarama O(n+m)
        var aSnaps = [];
        var t, c, g;
        for (t = 0; t < tracks.a.length; t++) {
            var at = seq.audioTracks[tracks.a[t]];
            var snap = [];
            for (c = 0; c < at.clips.numItems; c++) {
                try {
                    var it = at.clips[c];
                    snap.push({ ref: it, s: it.start.seconds, e: it.end.seconds });
                } catch (eS) {}
            }
            snap.sort(function (a, b) { return a.s - b.s; });
            aSnaps.push({ snap: snap, ptr: 0 });
        }

        var linked = 0, misses = 0;
        for (var v = from; v < to; v++) {
            var vit = null, vs = 0, ve = 0;
            try {
                vit = vTrack.clips[v];
                vs = vit.start.seconds;
                ve = vit.end.seconds;
            } catch (eV) { misses++; continue; }

            var group = [];
            for (t = 0; t < aSnaps.length; t++) {
                var st = aSnaps[t];
                while (st.ptr < st.snap.length && st.snap[st.ptr].s < vs - EPS) st.ptr++;
                var k = st.ptr;
                while (k < st.snap.length && st.snap[k].s <= vs + EPS) {
                    if (Math.abs(st.snap[k].s - vs) <= EPS &&
                        Math.abs(st.snap[k].e - ve) <= EPS) {
                        group.push(st.snap[k].ref);
                        break;
                    }
                    k++;
                }
            }
            if (group.length === 0) { misses++; continue; }

            try {
                vit.setSelected(true, false);
                for (g = 0; g < group.length; g++) group[g].setSelected(true, false);
                try { seq.unlinkSelection(); } catch (eU) {} // eski/yarim linkleri temizle
                var ok = seq.linkSelection();
                if (ok !== false) linked++; else misses++;
            } catch (eL) {
                misses++;
            }
            // grubu her durumda desele (sonraki grup kirlenmesin)
            try { vit.setSelected(false, false); } catch (e1) {}
            for (g = 0; g < group.length; g++) {
                try { group[g].setSelected(false, false); } catch (e2) {}
            }
        }
        return 'OK|' + linked + '|' + misses + '|' + total;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

function ACS_clearSelection(seq) {
    var groups = [seq.videoTracks, seq.audioTracks];
    for (var g = 0; g < groups.length; g++) {
        for (var t = 0; t < groups[g].numTracks; t++) {
            var track = groups[g][t];
            for (var c = 0; c < track.clips.numItems; c++) {
                try { track.clips[c].setSelected(false, false); } catch (e) {}
            }
        }
    }
}

/* Islemden once yedek sequence olustur (clone). Clone aktif sequence'i
 * degistirirse orijinali geri aktif eder. */
function ACS_backupSequence() {
    try {
        ACS_checkEditSequence();
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var name = seq.name;
        var id = seq.sequenceID;
        if (!seq.clone()) return 'ERR|Sequence kopyalanamadi';
        if (!app.project.activeSequence || app.project.activeSequence.sequenceID !== id) {
            if (typeof app.project.openSequence === 'function') app.project.openSequence(id);
            else app.project.activeSequence = seq;
        }
        if (!app.project.activeSequence || app.project.activeSequence.sequenceID !== id) {
            return 'ERR|Yedek sonrasi asil sequence acilamadi';
        }
        return 'OK|' + name;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* ---- Faz 3: Bosluk kapatma (parcali, SONDAN BASA) ----
 * Ripple delete tum timeline'i kaydirir; bu yuzden panel partileri kesinlikle
 * sondan basa gondermeli (bu fonksiyon da kendi icinde sondan basa isler).
 * Ilk video track uzerinde tek gecisli (lockstep) tarama yapilir: hem gap'ler
 * hem item'lar azalan sirada oldugundan her item en fazla bir kez okunur. */
function ACS_closeGapsBatch(silencesStr) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        app.enableQE();
        var qeSeq = qe.project.getActiveSequence();
        if (!qeSeq) return 'ERR|QE sequence alinamadi';

        var ivs = ACS_parseSilences(silencesStr);
        if (ivs.length === 0) return 'OK|0|0';
        ivs.sort(function (a, b) { return b.start - a.start; }); // azalan

        var vTrack = qeSeq.numVideoTracks > 0 ? qeSeq.getVideoTrackAt(0) : null;
        var aTrack = qeSeq.numAudioTracks > 0 ? qeSeq.getAudioTrackAt(0) : null;
        var primary = vTrack ? vTrack : aTrack;
        if (!primary) return 'ERR|Track yok';

        var EPS = 0.18;
        var closed = 0, notFound = 0, errors = 0, firstErr = '';
        var idx = primary.numItems - 1;

        for (var x = 0; x < ivs.length; x++) {
            var iv = ivs[x];
            var matched = false;
            while (idx >= 0) {
                var item = null;
                try { item = primary.getItemAt(idx); } catch (e0) { idx--; continue; }
                if (!item) { idx--; continue; }
                var s = ACS_qeItemSec(item.start);
                if (s === null) { idx--; continue; }
                if (s > iv.start + EPS) { idx--; continue; } // gap'ten sonraki item, gec
                // s <= iv.start + EPS: aday bolgeye geldik
                var isEmpty = false;
                try { isEmpty = (item.type === 'Empty'); } catch (e1) {}
                if (isEmpty) {
                    var e = ACS_qeItemSec(item.end);
                    if (e !== null &&
                        Math.abs(s - iv.start) < EPS && Math.abs(e - iv.end) < EPS) {
                        var err = ACS_tryRemoveGap(primary, item);
                        if (err === '') {
                            closed++;
                            matched = true;
                            idx--;
                        } else {
                            errors++;
                            if (!firstErr) firstErr = err;
                        }
                    }
                }
                break; // bu gap icin arama bitti (idx bir sonraki gap icin yerinde)
            }
            if (!matched) {
                // Birincil track'te yoksa/silinemediyse ses track'inde tam tarama dene
                var fb = (aTrack && primary !== aTrack)
                    ? ACS_findAndRemoveGap(aTrack, iv, EPS) : 'yok';
                if (fb === '') {
                    closed++;
                } else {
                    notFound++;
                    if (fb !== 'yok' && !firstErr) firstErr = fb;
                }
            }
        }
        return 'OK|' + closed + '|' + (notFound + errors) + '|' + firstErr;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}

/* Gap silmeyi birden fazla imzayla dene; basariyi numItems'in azalmasiyla
 * DOGRULA (bazi QE cagrilari sessizce basarisiz olabiliyor).
 * Donus: '' = basarili, aksi halde ilk hata metni. */
function ACS_tryRemoveGap(track, item) {
    var before = -1;
    try { before = track.numItems; } catch (e0) {}
    var firstErr = '';

    try {
        item.remove(true, true);
        if (before < 0 || track.numItems < before) return '';
    } catch (e1) {
        firstErr = 'remove(t,t): ' + e1.toString();
    }
    try {
        item.remove(true);
        if (before < 0 || track.numItems < before) return '';
    } catch (e2) {
        if (!firstErr) firstErr = 'remove(t): ' + e2.toString();
    }
    try {
        item.remove();
        if (before < 0 || track.numItems < before) return '';
    } catch (e3) {
        if (!firstErr) firstErr = 'remove(): ' + e3.toString();
    }
    if (firstErr === '') firstErr = 'remove sessizce etkisiz kaldi (numItems degismedi)';
    return firstErr;
}

/* Yedek: verilen aralikla eslesen Empty item'i tam taramayla bul ve sil.
 * Donus: '' = basarili, 'yok' = bulunamadi, aksi halde hata metni. */
function ACS_findAndRemoveGap(track, iv, eps) {
    try {
        for (var i = track.numItems - 1; i >= 0; i--) {
            var item = null;
            try { item = track.getItemAt(i); } catch (e0) { continue; }
            if (!item) continue;
            var isEmpty = false;
            try { isEmpty = (item.type === 'Empty'); } catch (e1) {}
            if (!isEmpty) continue;
            var s = ACS_qeItemSec(item.start);
            var e = ACS_qeItemSec(item.end);
            if (s === null || e === null) continue;
            if (Math.abs(s - iv.start) < eps && Math.abs(e - iv.end) < eps) {
                return ACS_tryRemoveGap(track, item);
            }
        }
    } catch (eAll) {}
    return 'yok';
}

/* ---- Gecici tani (0.9.4.2): QE setSpeed imzasi ve davranisi ----
 * Secili klip (linkli secimde video parcasi). applyValue bos: yalniz incele.
 * Dolu: yansitilan imzaya gore setSpeed cagrilir; secili tum parcalarin once/sonra
 * hiz, sure ve sonraki klip baslangici raporlanir (ripple ve link davranisi). */
function ACS_speedProbe(applyValue) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return 'ERR|Aktif sequence yok';
        var sel = seq.getSelection();
        if (!sel || sel.length < 1) return 'ERR|Timeline\'da bir klip secin';
        // Linkli secim (V + A parcalari) normal; setSpeed video parcasina uygulanir.
        var groups = [seq.videoTracks, seq.audioTracks], parts = [];
        for (var s0 = 0; s0 < sel.length; s0++) {
            var hit = false;
            for (var gi = 0; gi < 2 && !hit; gi++) {
                for (var ti = 0; ti < groups[gi].numTracks && !hit; ti++) {
                    for (var ci = 0; ci < groups[gi][ti].clips.numItems; ci++) {
                        if (groups[gi][ti].clips[ci].nodeId === sel[s0].nodeId) {
                            parts.push({ g: gi, t: ti, idx: ci }); hit = true; break;
                        }
                    }
                }
            }
        }
        if (!parts.length) return 'ERR|Secili klip track\'te bulunamadi';
        parts.sort(function (a, b) { return a.g - b.g || a.t - b.t || a.idx - b.idx; });
        var g = parts[0].g, t = parts[0].t;
        var clip = groups[g][t].clips[parts[0].idx], start = clip.start.seconds;
        app.enableQE();
        var qs = qe.project.getActiveSequence();
        // Her parcanin QE karsiligi, hicbir degisiklik yapilmadan once bulunur.
        var qItems = [];
        for (var qp = 0; qp < parts.length; qp++) {
            var pc = groups[parts[qp].g][parts[qp].t].clips[parts[qp].idx];
            var qt = parts[qp].g === 0 ? qs.getVideoTrackAt(parts[qp].t) : qs.getAudioTrackAt(parts[qp].t);
            var found = null;
            for (var k = 0; k < qt.numItems; k++) {
                var it = qt.getItemAt(k);
                if (it && it.type !== 'Empty' && Math.abs(ACS_qeItemSec(it.start) - pc.start.seconds) < 0.001) { found = it; break; }
            }
            if (!found) return 'ERR|QE klibi eslesmedi: parca ' + (qp + 1);
            qItems.push(found);
        }
        var q = qItems[0];
        var out = ['secili ' + parts.length + ' parca; setSpeed: ' + (g === 0 ? 'V' : 'A') + (t + 1) + ' @' + start + 's'];
        var ms = q.reflect.methods, names = [], sig = null;
        for (var m = 0; m < ms.length; m++) {
            names.push(ms[m].name);
            if (ms[m].name === 'setSpeed') {
                sig = [];
                var a = ms[m].arguments || [];
                for (var ai = 0; ai < a.length; ai++) sig.push({ name: a[ai].name, type: a[ai].dataType });
            }
        }
        out.push('QE metodlari: ' + names.join(','));
        var sigText = [];
        if (sig) for (var si = 0; si < sig.length; si++) sigText.push(sig[si].name + ':' + sig[si].type);
        out.push('setSpeed imzasi: ' + (sig ? '(' + sigText.join(', ') + ')' : 'YOK'));
        function state(label) {
            var lines = [];
            for (var pi = 0; pi < parts.length; pi++) {
                var tr = groups[parts[pi].g][parts[pi].t], c = tr.clips[parts[pi].idx];
                var n = parts[pi].idx + 1 < tr.clips.numItems ? tr.clips[parts[pi].idx + 1] : null;
                lines.push((parts[pi].g === 0 ? 'V' : 'A') + (parts[pi].t + 1) + '#' + (parts[pi].idx + 1) +
                    ' hiz=' + (typeof c.getSpeed === 'function' ? c.getSpeed() : '?') +
                    ' sure=' + (c.duration ? c.duration.seconds : c.end.seconds - c.start.seconds) +
                    ' bas=' + c.start.seconds + ' sonraki=' + (n ? n.start.seconds : '-'));
            }
            return label + ': ' + lines.join(' | ');
        }
        out.push(state('once'));
        if (applyValue !== '') {
            // "0.5 r": son boolean (ripple adayi) true. "0.5 d": metin parametresine
            // hedef sure (sure / hiz) timecode olarak verilir (Speed/Duration "sure" adayi).
            // "2 e": setSpeed sureyi korudugu icin her parcanin end'i DOM'dan
            // baslangic + (onceki sure / hiz) noktasina yazilir.
            var flags = ' ' + applyValue.toLowerCase().split(/\s+/).slice(1).join(' ') + ' ';
            var rippleFlag = flags.indexOf(' r ') >= 0, durationFlag = flags.indexOf(' d ') >= 0;
            var endFlag = flags.indexOf(' e ') >= 0;
            var v = parseFloat(applyValue);
            if (isNaN(v)) return 'ERR|Gecersiz hiz degeri';
            if (!sig) return 'ERR|setSpeed yok\n' + out.join('\n');
            // Imza bilgisi yoksa toplulukta gecen 5 parametreli bicim denenir.
            var types = sig.length ? sig : [{ type: 'number' }, { type: 'string' }, { type: 'boolean' },
                { type: 'boolean' }, { type: 'boolean' }];
            var args = [], usedNumber = false;
            for (var ki = 0; ki < types.length; ki++) {
                var ty = String(types[ki].type).toLowerCase();
                if (!usedNumber && /num|float|double|int/.test(ty)) { args.push(v); usedNumber = true; }
                else if (/str/.test(ty)) args.push('');
                else if (/bool/.test(ty)) args.push(false);
                else args.push(/num|float|double|int/.test(ty) ? 0 : '');
            }
            if (rippleFlag && typeof args[args.length - 1] === 'boolean') args[args.length - 1] = true;
            if (durationFlag) {
                var fps = ACS_TICKS_PER_SECOND / parseFloat(seq.timebase);
                var cti = qs.CTI && qs.CTI.timecode ? String(qs.CTI.timecode) : '';
                var dur = clip.duration ? clip.duration.seconds : clip.end.seconds - clip.start.seconds;
                var tc = ACS_frameToTimecode(Math.round(dur / v * fps), fps, cti.indexOf(';') >= 0);
                for (var di = 0; di < args.length; di++) if (typeof args[di] === 'string') { args[di] = tc; break; }
            }
            var before = [];
            for (var bi = 0; bi < parts.length; bi++) {
                var bc = groups[parts[bi].g][parts[bi].t].clips[parts[bi].idx];
                before.push({ start: bc.start.seconds,
                    dur: bc.duration ? bc.duration.seconds : bc.end.seconds - bc.start.seconds });
            }
            // setSpeed linkli partnerlere yayilmiyor (canli: yalniz V degisti) — her parca ayri.
            var results = [];
            for (var qi = 0; qi < qItems.length; qi++) {
                var qx = qItems[qi], r;
                switch (args.length) {
                    case 1: r = qx.setSpeed(args[0]); break;
                    case 2: r = qx.setSpeed(args[0], args[1]); break;
                    case 3: r = qx.setSpeed(args[0], args[1], args[2]); break;
                    case 4: r = qx.setSpeed(args[0], args[1], args[2], args[3]); break;
                    default: r = qx.setSpeed(args[0], args[1], args[2], args[3], args[4]);
                }
                results.push(r);
            }
            out.push('cagri: setSpeed(' + args.join(', ') + ') x' + qItems.length + ' -> ' + results.join(','));
            if (endFlag) {
                var endErrors = [];
                for (var ei = 0; ei < parts.length; ei++) {
                    try {
                        var et = new Time();
                        et.seconds = before[ei].start + before[ei].dur / v;
                        groups[parts[ei].g][parts[ei].t].clips[parts[ei].idx].end = et;
                    } catch (eE) { endErrors.push((ei + 1) + ': ' + eE.toString()); }
                }
                out.push('end yazildi x' + (parts.length - endErrors.length) +
                    (endErrors.length ? ' | hata: ' + endErrors.join('; ') : ''));
            }
            out.push(state('sonra'));
        }
        return 'OK|' + out.join('\n');
    } catch (e) {
        return 'ERR|' + e.toString();
    }
}
