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

    /* Müzik melodisi hedefi: her melodi notasına bir tık oturur; iki eşleşen tık arasındaki fazla
     * tıkların görüntüsü KESİLİR (seçenek b). Bir geçişte (tık a → tık b, nota j → nota j2) kaynak
     * = b − (a + tık parçası), hedef D = nota arası − tık parçası. Temiz (fazla tıksız) kısımlar:
     * "baş" = a'dan sonraki ilk fazla tıka kadar, "yaklaşma" = son fazla tıkın sesi bittikten (150 ms,
     * en az tık parçası) b'ye kadar. Adaylar (en ucuzu seçilir):
     *   - yaklaşma ≥ D: b'den önceki son D kare normal hızda, öncesi silinir;
     *   - yaklaşma minSpeed'e kadar yavaşlatılır;
     *   - baş + yaklaşma ≥ D: ikisi de normal hızda, ortası silinir;
     *   - seçenek (c), uzun nota arası: baş (yoksa yaklaşma) normal hızda, son 2 karesi DONDURULUR
     *     (çok yavaş) ve D dolana kadar bekler, ortası silinir; görünür fazla blok ve ağır çekim yok;
     *   - hiçbiri olmazsa (temiz kısım 2 kareden kısa) fazla tıklar görünür kalır.
     * Maliyet: yavaşlama |ln hız| + kesme 0.1·ln(kaynak/D) + ek kesme 0.05 + donma 0.3 + 0.5/sn +
     * görünür fazla tık 0.5 + atlanan nota 0.4 + düşen tık 0.02 − eşleşme ödülü 1. Bölge başı da aynı
     * kuralla ilk notaya oturtulur. Dönüş planTicks biçiminde; silinecek parça = { target: 0, speed: 0 };
     * normal hızda tutulan parça plana yazılmaz (yalnız kayar). */
    function alignToNotes(clicks, notes, opts) {
        var fps = opts.fps, hold = opts.holdFrames, minS = opts.minSpeed, rs = Math.round(opts.regionStart * fps);
        var SKIP = 0.4, DROP = 0.02, CUT = 0.1, JUMP = 0.05, VISIBLE = 0.5, REWARD = 1, MAXDROP = 12, MAXSKIP = 4;
        var FZ = 2, FREEZE = 0.3, FREEZE_SEC = 0.5;
        // Fazla tıktan sonraki temiz görüntü 150 ms sonra başlar: blok sesi ~0.3 sn sürüyor ve ilk
        // 60 ms'de tepeye yakın; tık parçasından (3 kare) hemen sonra kesilince kuyruk yeni bir tık gibi
        // duyuluyordu (canlı: 15 nota dışı tıkın çoğu kesimden 20-30 ms sonra).
        var tail = Math.max(hold, Math.round(0.15 * fps));
        function frames(list) {
            var out = [];
            list.map(function (t) { return Math.round(t * fps); }).sort(function (a, b) { return a - b; })
                .forEach(function (f) { if (f > rs && (!out.length || f !== out[out.length - 1])) out.push(f); });
            return out;
        }
        var C = frames(clicks), M = frames(notes), n = C.length, m = M.length, i, j, i2, j2;
        var empty = { clicks: [], targets: [], gaps: [], boundaries: [], merged: 0, limited: 0, skipped: 0, deltaSec: 0, cutSec: 0, visible: 0, freezes: 0, frozenSec: 0 };
        if (n < 2 || m < 2) return empty;
        // Bir geçişin kararı: startF'den endF'deki tıka, D karelik hedef; dropped = aradaki fazla tıklar.
        // Dönüş: tutulan parçalar [{ s, e, t }] (kaynak kareleri [s, e), hedef t kare), görünür fazla
        // tık sayısı, donma kareleri ve maliyet; parça dışı kaynak silinir.
        function decide(startF, endF, D, dropped) {
            var avail = endF - startF;
            if (D < 1 || avail <= 0) return null;
            var cut = CUT * Math.log(Math.max(avail, D) / D), best = null;
            function offer(pieces, cost, visible, frozen) {
                if (!best || cost < best.cost) best = { pieces: pieces, cost: cost, visible: visible, frozen: frozen };
            }
            var lead = dropped.length ? Math.max(0, endF - (dropped[dropped.length - 1] + tail)) : avail;
            var head = dropped.length ? Math.max(0, dropped[0] - startF) : 0;
            if (lead >= D) offer([{ s: endF - D, e: endF, t: D }], cut, 0, 0);
            else {
                if (lead >= 1 && lead / D >= minS) offer([{ s: endF - lead, e: endF, t: D }], Math.abs(Math.log(lead / D)) + cut, 0, 0);
                if (head + lead >= D) offer([{ s: startF, e: startF + D - lead, t: D - lead }, { s: endF - lead, e: endF, t: lead }], cut + JUMP, 0, 0);
                else {
                    var fill = D - head - lead; // dondurularak doldurulacak kare
                    if (head >= FZ) {
                        offer([{ s: startF, e: startF + head - FZ, t: head - FZ }, { s: startF + head - FZ, e: startF + head, t: FZ + fill },
                            { s: endF - lead, e: endF, t: lead }], FREEZE + FREEZE_SEC * fill / fps + cut + (lead ? JUMP : 0), 0, fill);
                    } else if (lead >= FZ) {
                        // Yaklaşmanın başında donar; fazla tık yoksa a'nın sesi bittikten sonra (donan karenin
                        // sesi silinir, ses tıkın kuyruğunun ortasından başlarsa yeni bir tık gibi duyuluyordu).
                        var fp = endF - lead + (dropped.length ? 0 : Math.min(Math.max(0, tail - hold), lead - FZ));
                        offer([{ s: endF - lead, e: fp, t: fp - (endF - lead) }, { s: fp, e: fp + FZ, t: FZ + fill },
                            { s: fp + FZ, e: endF, t: endF - fp - FZ }], FREEZE + FREEZE_SEC * fill / fps + cut, 0, fill);
                    }
                }
            }
            if (!best) { // temiz kısım yok: fazla tıklar görünür kalır
                var s0 = Math.max(startF, endF - D), sp = (endF - s0) / D, vis = 0;
                for (var q = 0; q < dropped.length; q++) if (dropped[q] >= s0) vis++;
                if (sp >= minS) offer([{ s: s0, e: endF, t: D }], Math.abs(Math.log(sp)) + cut + VISIBLE * vis, vis, 0);
            }
            return best;
        }
        var INF = 1e18, cost = [], prev = [];
        for (i = 0; i < n; i++) { cost.push(new Float64Array(m).fill(INF)); prev.push(new Int32Array(m).fill(-1)); }
        for (i = 0; i < n; i++) {
            for (j = 0; j < m; j++) {
                var d0 = decide(rs, C[i], M[j] - rs, C.slice(0, i));
                if (d0) cost[i][j] = d0.cost + DROP * i - REWARD;
            }
        }
        for (i = 0; i < n; i++) {
            for (j = 0; j < m; j++) {
                if (cost[i][j] >= INF) continue;
                for (i2 = i + 1; i2 <= Math.min(n - 1, i + 1 + MAXDROP); i2++) {
                    var dropped = C.slice(i + 1, i2);
                    for (j2 = j + 1; j2 <= Math.min(m - 1, j + 1 + MAXSKIP); j2++) {
                        var dd = decide(C[i] + hold, C[i2], M[j2] - M[j] - hold, dropped);
                        if (!dd) continue;
                        var c = cost[i][j] + dd.cost + SKIP * (j2 - j - 1) + DROP * (i2 - i - 1) - REWARD;
                        if (c < cost[i2][j2]) { cost[i2][j2] = c; prev[i2][j2] = i * m + j; }
                    }
                }
            }
        }
        var best = INF, bi = -1, bj = -1;
        for (i = 0; i < n; i++) for (j = 0; j < m; j++) if (cost[i][j] < best) { best = cost[i][j]; bi = i; bj = j; }
        if (bi < 0) return empty;
        var pairs = [];
        for (i = bi, j = bj; ;) {
            pairs.unshift([i, j]);
            var p = prev[i][j];
            if (p < 0) break;
            i = Math.floor(p / m); j = p % m;
        }
        if (pairs.length < 2) return empty;
        var gaps = [], delta = 0, cutF = 0, skipped = 0, visible = 0, freezes = 0, frozenF = 0;
        function emit(startF, endF, D, dropped) {
            var d = decide(startF, endF, D, dropped), pos = startF;
            d.pieces.forEach(function (pc) {
                if (pc.s > pos) { gaps.push({ start: pos / fps, end: pc.s / fps, target: 0, speed: 0 }); cutF += pc.s - pos; }
                if (pc.e > pc.s && pc.t !== pc.e - pc.s) {
                    var g = { start: pc.s / fps, end: pc.e / fps, target: pc.t / fps, speed: (pc.e - pc.s) / pc.t };
                    if (d.frozen && pc.e - pc.s === FZ && pc.t > FZ) g.freeze = true;
                    gaps.push(g);
                }
                pos = Math.max(pos, pc.e);
            });
            visible += d.visible;
            if (d.frozen) { freezes++; frozenF += d.frozen; }
            delta += D - (endF - startF);
        }
        emit(rs, C[pairs[0][0]], M[pairs[0][1]] - rs, C.slice(0, pairs[0][0]));
        for (var k = 1; k < pairs.length; k++) {
            var a = pairs[k - 1], b = pairs[k];
            emit(C[a[0]] + hold, C[b[0]], M[b[1]] - M[a[1]] - hold, C.slice(a[0] + 1, b[0]));
            skipped += b[1] - a[1] - 1;
        }
        var boundaries = [];
        gaps.forEach(function (g) { boundaries.push(g.start, g.end); });
        return {
            clicks: pairs.map(function (q) { return C[q[0]] / fps; }),
            targets: pairs.map(function (q) { return M[q[1]] / fps; }),
            gaps: gaps, boundaries: boundaries, merged: n - pairs.length, limited: 0, skipped: skipped,
            deltaSec: delta / fps, cutSec: cutF / fps, visible: visible, freezes: freezes, frozenSec: frozenF / fps
        };
    }

    return { intervalFromBpm: intervalFromBpm, planTicks: planTicks, medianInterval: medianInterval,
        alignToNotes: alignToNotes };
});
