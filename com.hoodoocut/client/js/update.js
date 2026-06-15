/* HooDoo Cut - güncelleme kontrolü (GitHub Releases üzerinden)
 *
 * Panel açılışta GitHub'ın public Releases API'sini token'sız sorgular,
 * en son yayın etiketini (tag_name, örn "v0.9.1") mevcut sürümle karşılaştırır.
 * Yeni sürüm varsa panel bir "güncelleme var" çubuğu gösterir; indirme
 * kullanıcıya bırakılır (imzalı .zxp'yi indirip kurar).
 *
 * KURULUM: Aşağıdaki OWNER'ı kendi GitHub kullanıcı adınla değiştir.
 * Repo public olmalı (kaynak gizli kalsın istersen yalnız Release'leri
 * barındıran ayrı bir public repo da kullanabilirsin).
 */
(function (root) {
    'use strict';

    var OWNER = 'MuhammedEsmer';
    var REPO = 'hoodoo-cut';

    function nodeReq() {
        if (typeof cep_node !== 'undefined' && cep_node.require) return cep_node.require;
        if (typeof require === 'function') return require;
        return null;
    }

    /* "0.9.1.2" vs "0.9.1.1" -> 1 (a>b), -1, 0. Baştaki 'v' atılır.
     * Parça sayısı serbest (3 ya da 4 parçalı sürümleri de karşılaştırır). */
    function cmpSemver(a, b) {
        var pa = ('' + a).replace(/^v/i, '').split('.');
        var pb = ('' + b).replace(/^v/i, '').split('.');
        var n = Math.max(pa.length, pb.length);
        for (var i = 0; i < n; i++) {
            var x = parseInt(pa[i], 10) || 0;
            var y = parseInt(pb[i], 10) || 0;
            if (x > y) return 1;
            if (x < y) return -1;
        }
        return 0;
    }

    function isConfigured() {
        return OWNER.indexOf('YOUR_GITHUB') < 0 && OWNER.length > 0;
    }

    /* cb(info, err). info = { latest, newer, url (zxp ya da sayfa), page } */
    function check(current, cb) {
        if (!isConfigured()) { cb(null, 'repo ayarlanmamış (update.js OWNER)'); return; }
        var req = nodeReq();
        if (!req) { cb(null, 'node yok'); return; }
        var https;
        try { https = req('https'); } catch (e) { cb(null, 'https modülü yok'); return; }

        var opts = {
            host: 'api.github.com',
            path: '/repos/' + OWNER + '/' + REPO + '/releases/latest',
            headers: { 'User-Agent': 'HooDooCut', 'Accept': 'application/vnd.github+json' }
        };
        var r = https.get(opts, function (res) {
            var data = '';
            res.on('data', function (c) { data += c; });
            res.on('end', function () {
                try {
                    if (res.statusCode === 404) { cb(null, 'henüz yayın yok'); return; }
                    if (res.statusCode !== 200) { cb(null, 'HTTP ' + res.statusCode); return; }
                    var j = JSON.parse(data);
                    var tag = (j.tag_name || '').replace(/^v/i, '');
                    if (!tag) { cb(null, 'etiket yok'); return; }
                    var zxp = null;
                    if (j.assets) {
                        for (var i = 0; i < j.assets.length; i++) {
                            if (/\.zxp$/i.test(j.assets[i].name)) {
                                zxp = j.assets[i].browser_download_url;
                                break;
                            }
                        }
                    }
                    cb({
                        latest: tag,
                        newer: cmpSemver(tag, current) > 0,
                        url: zxp || j.html_url,
                        page: j.html_url
                    }, null);
                } catch (e) { cb(null, e.message); }
            });
        });
        r.on('error', function (e) { cb(null, e.message); });
        r.setTimeout(8000, function () { try { r.destroy(); } catch (e) {} cb(null, 'zaman aşımı'); });
    }

    root.ACSUpdate = { check: check, cmpSemver: cmpSemver, OWNER: OWNER, REPO: REPO,
                       configured: isConfigured() };
})(typeof window !== 'undefined' ? window : this);
