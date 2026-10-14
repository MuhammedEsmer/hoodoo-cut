/*
 * HooDoo Cut - tık ritmi planı
 * Tıkları (blok koyma/kırma sesleri) sabit aralıklı ızgaraya oturtur: her tıktan
 * sonra "tık parçası" (holdFrames) normal hızda kalır, bir sonraki tıka kadar olan
 * ara kısım hızlandırılır/yavaşlatılır ve toplam süre tam bir aralık (interval) olur.
 * Hem CEP panelinde (window.ACSTickPlan) hem sistem Node'unda (require) çalışır.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ACSTickPlan = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* 120 BPM, bölüm 0.5 (yarım vuruş) -> 0.25 sn */
    function intervalFromBpm(bpm, beats) {
        return 60 / bpm * beats;
    }

    /* clicks: saniye. opts: fps, interval (sn), holdFrames, minSpeed, maxSpeed.
     * Dönüş: { clicks, gaps: [{ start, end, target, speed }], boundaries,
     *          merged, limited, deltaSec } — tüm zamanlar kare ızgarasında. */
    function planTicks(clicks, opts) {
        var fps = opts.fps, hold = opts.holdFrames;
        var slot = Math.round(opts.interval * fps) - hold; // ara kısmın hedef süresi (kare)
        if (!(fps > 0) || !(slot >= 1)) throw new Error('Tik araligi tik parcasindan uzun olmali');
        var frames = clicks.map(function (c) { return Math.round(c * fps); })
            .sort(function (a, b) { return a - b; });
        var kept = [], merged = 0;
        for (var i = 0; i < frames.length; i++) {
            if (!kept.length) { kept.push(frames[i]); continue; }
            var src = frames[i] - (kept[kept.length - 1] + hold);
            // Ara bu kadar kısaysa alt hız sınırının altına inmek gerekir: önceki tıka katılır.
            if (src < opts.minSpeed * slot) { merged++; continue; }
            kept.push(frames[i]);
        }
        var gaps = [], boundaries = [], limited = 0, delta = 0;
        for (var k = 0; k + 1 < kept.length; k++) {
            var startF = kept[k] + hold, endF = kept[k + 1], srcF = endF - startF;
            var speed = srcF / slot;
            if (speed > opts.maxSpeed) { speed = opts.maxSpeed; limited++; }
            gaps.push({ start: startF / fps, end: endF / fps, target: slot / fps, speed: speed });
            boundaries.push(startF / fps, endF / fps);
            delta += slot - srcF;
        }
        return {
            clicks: kept.map(function (f) { return f / fps; }),
            gaps: gaps, boundaries: boundaries,
            merged: merged, limited: limited, deltaSec: delta / fps
        };
    }

    /* Bulunan tıkların doğal aralığı (ardışık farkların medyanı) — aralık önerisi için. */
    function medianInterval(clicks) {
        if (clicks.length < 2) return null;
        var d = [];
        for (var i = 1; i < clicks.length; i++) d.push(clicks[i] - clicks[i - 1]);
        d.sort(function (a, b) { return a - b; });
        var m = Math.floor(d.length / 2);
        return d.length % 2 ? d[m] : (d[m - 1] + d[m]) / 2;
    }

    /* Müzik melodisi hedefi: tıkları (video) nota başlangıçlarına (kilitli müzik, timeline
     * zamanı) eşler. Dinamik programlama: sıralı eşleşme; her geçişin hızı
     * (tık arası − tık parçası) / (nota arası − tık parçası) sınırlar içinde olmalı; maliyet
     * |ln hız| + atlanan nota + düşen tık cezası − eşleşme ödülü. İlk tık notasına otursun diye
     * bölge başı da (regionStart → ilk tık) yeniden zamanlanır. Dönüş planTicks ile aynı biçimde
     * (+ targets: eşleşen nota zamanları, skipped: atlanan nota). Canlı (In the End): 158 tıkın
     * 156'sı notaya, medyan hız 1.00. */
    function alignToNotes(clicks, notes, opts) {
        var fps = opts.fps, hold = opts.holdFrames, minS = opts.minSpeed, maxS = opts.maxSpeed;
        var skipCost = opts.skipCost || 0.15, dropCost = opts.dropCost || 0.6, reward = opts.reward || 1;
        var MAXSKIP = opts.maxSkip || 8, MAXDROP = opts.maxDrop || 3, rs = Math.round(opts.regionStart * fps);
        function frames(list) {
            var out = [];
            list.map(function (t) { return Math.round(t * fps); }).sort(function (a, b) { return a - b; })
                .forEach(function (f) { if (f > rs && (!out.length || f !== out[out.length - 1])) out.push(f); });
            return out;
        }
        var C = frames(clicks), M = frames(notes), n = C.length, m = M.length, i, j, i2, j2;
        var empty = { clicks: [], targets: [], gaps: [], boundaries: [], merged: 0, limited: 0, skipped: 0, deltaSec: 0 };
        if (n < 2 || m < 2) return empty;
        var INF = 1e18, cost = [], prev = [];
        for (i = 0; i < n; i++) { cost.push(new Float64Array(m).fill(INF)); prev.push(new Int32Array(m).fill(-1)); }
        for (i = 0; i <= MAXDROP && i < n; i++) {
            for (j = 0; j < m; j++) {
                var s0 = (C[i] - rs) / (M[j] - rs);
                if (s0 >= minS && s0 <= maxS) cost[i][j] = Math.abs(Math.log(s0)) + dropCost * i - reward;
            }
        }
        for (i = 0; i < n; i++) {
            for (j = 0; j < m; j++) {
                if (cost[i][j] >= INF) continue;
                for (i2 = i + 1; i2 <= Math.min(n - 1, i + 1 + MAXDROP); i2++) {
                    var src = C[i2] - C[i] - hold;
                    if (src <= 0) continue;
                    for (j2 = j + 1; j2 <= Math.min(m - 1, j + 1 + MAXSKIP); j2++) {
                        var slot = M[j2] - M[j] - hold;
                        if (slot < 1) continue;
                        var s = src / slot;
                        if (s < minS || s > maxS) continue;
                        var c = cost[i][j] + Math.abs(Math.log(s)) + skipCost * (j2 - j - 1) + dropCost * (i2 - i - 1) - reward;
                        if (c < cost[i2][j2]) { cost[i2][j2] = c; prev[i2][j2] = i * m + j; }
                    }
                }
            }
        }
        var best = INF, bi = -1, bj = -1;
        for (i = 0; i < n; i++) for (j = 0; j < m; j++) {
            var total = cost[i][j] + dropCost * (n - 1 - i);
            if (total < best) { best = total; bi = i; bj = j; }
        }
        if (bi < 0) return empty;
        var pairs = [];
        for (i = bi, j = bj; ;) {
            pairs.unshift([i, j]);
            var p = prev[i][j];
            if (p < 0) break;
            i = Math.floor(p / m); j = p % m;
        }
        if (pairs.length < 2) return empty;
        var gaps = [], delta = 0, skipped = 0, first = pairs[0];
        if (M[first[1]] !== C[first[0]]) {
            gaps.push({ start: rs / fps, end: C[first[0]] / fps, target: (M[first[1]] - rs) / fps,
                speed: (C[first[0]] - rs) / (M[first[1]] - rs) });
            delta += (M[first[1]] - rs) - (C[first[0]] - rs);
        }
        for (var k = 1; k < pairs.length; k++) {
            var a = pairs[k - 1], b = pairs[k];
            var startF = C[a[0]] + hold, endF = C[b[0]], targetF = M[b[1]] - M[a[1]] - hold;
            gaps.push({ start: startF / fps, end: endF / fps, target: targetF / fps, speed: (endF - startF) / targetF });
            delta += targetF - (endF - startF);
            skipped += b[1] - a[1] - 1;
        }
        var boundaries = [];
        gaps.forEach(function (g) { boundaries.push(g.start, g.end); });
        return {
            clicks: pairs.map(function (q) { return C[q[0]] / fps; }),
            targets: pairs.map(function (q) { return M[q[1]] / fps; }),
            gaps: gaps, boundaries: boundaries, merged: n - pairs.length, limited: 0, skipped: skipped, deltaSec: delta / fps
        };
    }

    /* Riff filtresi: şarkının tekrar periyodunu (2-12 sn arası en çok eşleşen gecikme) bulur, bir
     * periyot öncesinde/sonrasında karşılığı olan notaları tutar — tekrar eden riff kalır, tek
     * seferlik gitar vuruşu/dolgu elenir. Filtre fillGap'ten (sn) uzun bir boşluk bırakırsa
     * (riff'in olmadığı bölüm) oradaki notalar geri konur ki tık eşleşmesi kopmasın. */
    function keepRepeating(notes, opts) {
        opts = opts || {};
        var eps = opts.eps || 0.05, fillGap = opts.fillGap || 1.5, minP = opts.minPeriod || 2, maxP = opts.maxPeriod || 12;
        var sorted = notes.slice().sort(function (a, b) { return a - b; });
        if (sorted.length < 4) return { notes: sorted, period: null };
        function hasNear(t) {
            var lo = 0, hi = sorted.length - 1;
            while (lo <= hi) {
                var mid = (lo + hi) >> 1;
                if (sorted[mid] < t - eps) lo = mid + 1;
                else if (sorted[mid] > t + eps) hi = mid - 1;
                else return true;
            }
            return false;
        }
        // Tolerans yüzünden en iyi skor bir plato oluşturur (ör. 2.35-2.45); platonun ortası alınır.
        var bestLag = null, bestScore = 0, plateauEnd = null;
        for (var lag = minP; lag <= maxP + 1e-9; lag += 0.01) {
            var score = 0;
            for (var i = 0; i < sorted.length; i++) if (hasNear(sorted[i] + lag)) score++;
            if (score > bestScore) { bestScore = score; bestLag = lag; plateauEnd = lag; }
            else if (score === bestScore && plateauEnd !== null && lag - plateauEnd < 0.015) plateauEnd = lag;
        }
        if (!bestLag) return { notes: sorted, period: null };
        bestLag = (bestLag + plateauEnd) / 2;
        var kept = sorted.filter(function (t) { return hasNear(t + bestLag) || hasNear(t - bestLag); });
        var out = [], k = 0;
        for (var j = 0; j < sorted.length; j++) {
            var t = sorted[j];
            while (k < kept.length && kept[k] < t) k++;
            if (kept[k] === t) { out.push(t); continue; }
            var before = k > 0 ? kept[k - 1] : -Infinity, after = k < kept.length ? kept[k] : Infinity;
            if (after - before > fillGap) out.push(t);
        }
        return { notes: out, period: Math.round(bestLag * 100) / 100, repeating: kept.length };
    }

    return { intervalFromBpm: intervalFromBpm, planTicks: planTicks, medianInterval: medianInterval,
        alignToNotes: alignToNotes, keepRepeating: keepRepeating };
});
