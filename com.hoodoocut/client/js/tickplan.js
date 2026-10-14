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

    return { intervalFromBpm: intervalFromBpm, planTicks: planTicks };
});
