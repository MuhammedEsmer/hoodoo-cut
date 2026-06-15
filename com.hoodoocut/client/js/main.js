/* HooDoo Cut - panel mantığı (CEP/Chromium tarafı) */
(function () {
    'use strict';

    var csInterface = new CSInterface();

    // Node erişimi: --enable-nodejs --mixed-context ile require doğrudan gelir,
    // bazı CEP sürümlerinde cep_node üzerinden gelir.
    var nodeRequire = null;
    if (typeof cep_node !== 'undefined' && cep_node.require) nodeRequire = cep_node.require;
    else if (typeof require === 'function') nodeRequire = require;

    var fs = null, os = null, path = null;
    if (nodeRequire) {
        try {
            fs = nodeRequire('fs');
            os = nodeRequire('os');
            path = nodeRequire('path');
        } catch (e) { /* log'a düşecek */ }
    }

    var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    var EPR_PATH = extPath + '/assets/wav48k16.epr';
    // Direkt export bazi sistem presetlerini reddedebiliyor ("Unknown Error");
    // bu yuzden sirayla birden fazla aday denenir, hicbiri olmazsa AME'ye dusulur.
    var PRESET_CANDIDATES = [
        EPR_PATH,
        'C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\MediaIO\\systempresets\\3F3F3F3F_57415645\\Waveform Audio 48kHz 16-bit.epr',
        'C:\\Program Files\\Adobe\\Adobe Media Encoder 2026\\MediaIO\\systempresets\\3F3F3F3F_57415645\\Waveform Audio 48kHz 16-bit.epr'
    ];

    var ACS_VERSION = '0.9.3.0'; // tek kaynak: manifest.xml ile aynı tutulmalı (4 parçalı şema)

    var $ = function (id) { return document.getElementById(id); };
    var state = { lastCuts: null, cutArmed: false, mutesApplied: false,
                  lastBeats: null, beatArmed: false, audioCounts: [], videoCounts: [],
                  taps: [], csvRows: [] };

    /* ---- yardımcılar ---- */

    function log(msg) {
        var el = $('log');
        var time = new Date().toTimeString().slice(0, 8);
        el.textContent += '[' + time + '] ' + msg + '\n';
        el.scrollTop = el.scrollHeight;
    }

    function setStatus(ok, text) {
        $('statusDot').className = 'dot ' + (ok ? 'ok' : 'err');
        $('statusText').textContent = text;
    }

    function jsxEscape(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function evalJsx(script, cb) {
        csInterface.evalScript(script, function (res) {
            if (res === 'EvalScript error.' || res === undefined || res === null) {
                cb('ERR|ExtendScript çalıştırılamadı (EvalScript error)');
            } else {
                cb(String(res));
            }
        });
    }

    function fmtSec(s) {
        var m = Math.floor(s / 60);
        var sec = (s - m * 60).toFixed(1);
        return m > 0 ? m + 'dk ' + sec + 'sn' : sec + 'sn';
    }

    function showResult(ok, html) {
        var el = $('analysisResult');
        el.className = 'result' + (ok ? '' : ' err');
        el.innerHTML = html;
        el.style.display = 'block';
    }

    /* ---- şablon / parametre alanları ---- */

    // Özel şablonlar localStorage'da kalıcı saklanır (oturumlar arası kalır)
    var CUSTOM_PRESETS = { ozel1: null, ozel2: null };

    function loadCustomPresets() {
        try {
            var a = localStorage.getItem('hoodoo_preset_ozel1');
            var b = localStorage.getItem('hoodoo_preset_ozel2');
            if (a) CUSTOM_PRESETS.ozel1 = JSON.parse(a);
            if (b) CUSTOM_PRESETS.ozel2 = JSON.parse(b);
        } catch (e) {}
    }

    function readFields() {
        return {
            minSilence: parseInt($('pMinSilence').value, 10) || 0,
            minSpeech: parseInt($('pMinSpeech').value, 10) || 0,
            keepAfter: parseInt($('pKeepAfter').value, 10) || 0,
            keepBefore: parseInt($('pKeepBefore').value, 10) || 0
        };
    }

    function writeFields(v) {
        $('pMinSilence').value = v.minSilence;
        $('pMinSpeech').value = v.minSpeech;
        $('pKeepAfter').value = v.keepAfter;
        $('pKeepBefore').value = v.keepBefore;
    }

    function setActiveChip(modeName) {
        var chips = document.querySelectorAll('.chip');
        for (var i = 0; i < chips.length; i++) {
            if (chips[i].dataset.mode === modeName) chips[i].classList.add('active');
            else chips[i].classList.remove('active');
        }
    }

    function getActiveChipMode() {
        var c = document.querySelector('.chip.active');
        return c ? c.dataset.mode : '';
    }

    function applyMode(modeName) {
        if (modeName === 'ozel1' || modeName === 'ozel2') {
            var data = CUSTOM_PRESETS[modeName];
            if (data) writeFields(data); // boşsa mevcut alanlar korunur (kullanıcı doldurup kaydeder)
            setActiveChip(modeName);
            return;
        }
        var m = ACSAnalyzer.MODES[modeName];
        if (!m) return;
        writeFields({
            minSilence: Math.round(m.minSilenceSec * 1000),
            minSpeech: Math.round(m.minSpeechSec * 1000),
            keepAfter: Math.round(m.keepAfterSec * 1000),
            keepBefore: Math.round(m.keepBeforeSec * 1000)
        });
        setActiveChip(modeName);
    }

    // Alan elle değişince: yerleşik şablon seçimi kalkar; özel şablon aktifse
    // kalır (böylece Kaydet o özel slota yazar).
    function onFieldEdit() {
        var active = getActiveChipMode();
        if (active === 'ozel1' || active === 'ozel2') return;
        var c = document.querySelector('.chip.active');
        if (c) c.classList.remove('active');
    }

    function saveActivePreset() {
        var active = getActiveChipMode();
        var slot = (active === 'ozel2') ? 'ozel2' : 'ozel1';
        var data = readFields();
        CUSTOM_PRESETS[slot] = data;
        try { localStorage.setItem('hoodoo_preset_' + slot, JSON.stringify(data)); } catch (e) {}
        setActiveChip(slot);
        log('Özel şablon kaydedildi: ' + (slot === 'ozel1' ? 'Özel 1' : 'Özel 2') +
            ' (' + data.minSilence + '/' + data.minSpeech + '/' + data.keepAfter + '/' + data.keepBefore + ' ms)');
    }

    function msField(id, fallbackMs) {
        var v = parseInt($(id).value, 10);
        if (isNaN(v) || v < 0) v = fallbackMs;
        return v / 1000;
    }

    /* Analize gidecek parametreleri alanlardan topla. */
    function getParams() {
        var overrides = {
            minSilenceSec: msField('pMinSilence', 600),
            minSpeechSec: msField('pMinSpeech', 150),
            keepAfterSec: msField('pKeepAfter', 300),
            keepBeforeSec: msField('pKeepBefore', 300)
        };
        if (!$('autoThreshold').checked) {
            overrides.thresholdDb = parseInt($('thresholdSlider').value, 10);
        }
        return overrides;
    }

    function setSliderDb(v) {
        v = Math.round(Math.max(-65, Math.min(-15, v)));
        $('thresholdSlider').value = v;
        $('thresholdValue').textContent = v + ' dB';
    }

    function getScope() {
        var radios = document.getElementsByName('scope');
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
        return 'all';
    }

    /* ---- seçim aralıkları ---- */

    function parseRanges(str) {
        var out = [];
        var parts = str.split(';');
        for (var i = 0; i < parts.length; i++) {
            var se = parts[i].split(',');
            var s = parseFloat(se[0]), e = parseFloat(se[1]);
            if (!isNaN(s) && !isNaN(e) && e > s) out.push([s, e]);
        }
        return out;
    }

    function mergeRanges(ranges) {
        ranges.sort(function (a, b) { return a[0] - b[0]; });
        var out = [];
        for (var i = 0; i < ranges.length; i++) {
            var r = ranges[i];
            if (out.length && r[0] <= out[out.length - 1][1] + 0.001) {
                out[out.length - 1][1] = Math.max(out[out.length - 1][1], r[1]);
            } else {
                out.push([r[0], r[1]]);
            }
        }
        return out;
    }

    /* Kesim adaylarını seçim aralıklarıyla kırp: dışarıda kalanlar atılır,
     * taşanlar sınıra çekilir. */
    function intersectCuts(cuts, ranges) {
        var out = [];
        for (var i = 0; i < cuts.length; i++) {
            for (var k = 0; k < ranges.length; k++) {
                var s = Math.max(cuts[i].start, ranges[k][0]);
                var e = Math.min(cuts[i].end, ranges[k][1]);
                if (e - s >= 0.05) {
                    out.push({ start: Math.round(s * 1000) / 1000, end: Math.round(e * 1000) / 1000 });
                }
            }
        }
        return out;
    }

    /* ---- bağlantı ---- */

    /* "Analiz Sesi" kartını sequence'in ses track'lerine göre kur.
     * Varsayılan: dolu track'ler işaretli, boşlar işaretsiz. */
    function renderAudioTracks(countsStr) {
        var card = $('audioTracksCard');
        if (!countsStr) { card.style.display = 'none'; return; }
        var counts = countsStr.split(',');
        var html = '';
        for (var i = 0; i < counts.length; i++) {
            var c = parseInt(counts[i], 10) || 0;
            html += '<label class="row"><input type="checkbox" data-idx="' + i +
                '" data-content="' + (c > 0 ? 1 : 0) + '"' + (c > 0 ? ' checked' : '') + '>' +
                '<span>A' + (i + 1) + (c > 0 ? ' (' + c + ' klip)' : ' (boş)') + '</span></label>';
        }
        $('audioTracks').innerHTML = html;
        card.style.display = 'block';
    }

    /* Seçimi oku: 'all' = mix aynen (mute gerekmez), 'none' = hata,
     * yoksa '0,2' gibi dahil edilecek track indeksleri. */
    function getAudioSelection() {
        var boxes = document.querySelectorAll('#audioTracks input');
        if (!boxes.length) return 'all';
        var sel = [], content = [];
        for (var i = 0; i < boxes.length; i++) {
            var idx = parseInt(boxes[i].dataset.idx, 10);
            if (boxes[i].checked) sel.push(idx);
            if (boxes[i].dataset.content === '1') content.push(idx);
        }
        if (sel.length === 0) return 'none';
        // Tam olarak tüm dolu track'ler seçiliyse mix değişmez, mute gereksiz
        if (sel.join(',') === content.join(',')) return 'all';
        return sel.join(',');
    }

    function checkConnection() {
        evalJsx('ACS_getEnv()', function (res) {
            var p = res.split('|');
            if (p[0] === 'OK') {
                setStatus(true, p[2]);
                log('Bağlandı. Proje: ' + p[1] + ' | Sequence: ' + p[2] +
                    ' | V:' + p[3] + ' A:' + p[4] + ' | Süre: ' + fmtSec(parseFloat(p[5])));
                renderAudioTracks(p[6] || '');
                renderBeatTracks(p[6] || '', p[7] || '');
            } else {
                setStatus(false, 'Sequence yok');
                log('Uyarı: ' + p.slice(1).join('|'));
            }
        });
    }

    /* ---- export ---- */

    /* Dosya oluşup boyutu sabitlenene kadar bekle (AME asenkron yazar). */
    function waitForFile(p, timeoutMs, cb) {
        var start = Date.now();
        var lastSize = -1;
        var stable = 0;
        var iv = setInterval(function () {
            var size = -1;
            try { if (fs.existsSync(p)) size = fs.statSync(p).size; } catch (e) {}
            if (size > 1000 && size === lastSize) {
                stable++;
                if (stable >= 2) { clearInterval(iv); cb(true, size); return; }
            } else {
                stable = 0;
            }
            lastSize = size;
            if (Date.now() - start > timeoutMs) { clearInterval(iv); cb(false, size); }
        }, 1500);
    }

    function resetAnalyzeButton() {
        var btn = $('btnAnalyze');
        btn.disabled = false;
        btn.textContent = '🔍 Analiz Et';
    }

    function exportFailed(msg) {
        resetAnalyzeButton();
        log('Export HATASI: ' + msg);
        showResult(false, 'Ses dışa aktarılamadı. Günlüğe bakın.');
    }

    /* ---- analiz akışı ---- */

    function analyze() {
        if (!fs) {
            log('HATA: Node.js erişimi yok. Manifest CEFCommandLine ayarlarını kontrol edin.');
            return;
        }
        var btn = $('btnAnalyze');
        btn.disabled = true;
        $('analysisResult').style.display = 'none';
        $('btnCut').style.display = 'none';
        $('manageRow').style.display = 'none';
        state.lastCuts = null;

        var audioSel = getAudioSelection();
        if (audioSel === 'none') {
            resetAnalyzeButton();
            showResult(false, 'Analiz için en az bir ses track\'i işaretleyin.');
            return;
        }

        if (getScope() === 'selection') {
            btn.textContent = '⏳ Seçim okunuyor…';
            evalJsx('ACS_getSelection()', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') {
                    resetAnalyzeButton();
                    log('Seçim hatası: ' + p.slice(1).join('|'));
                    showResult(false, 'Timeline\'da seçili clip yok. Klipleri seçin ya da kapsamı "Tüm sequence" yapın.');
                    return;
                }
                var ranges = mergeRanges(parseRanges(p[1]));
                var total = 0;
                for (var i = 0; i < ranges.length; i++) total += ranges[i][1] - ranges[i][0];
                log('Seçim: ' + ranges.length + ' bölge, toplam ' + fmtSec(total));
                doExport(ranges, audioSel);
            });
        } else {
            doExport(null, audioSel);
        }
    }

    /* Mute uygulandıysa ne olursa olsun geri al, sonra devam et */
    function restoreThen(cb) {
        if (!state.mutesApplied) { cb(); return; }
        evalJsx('ACS_restoreMutes()', function () {
            state.mutesApplied = false;
            log('Track mute durumları eski haline döndürüldü.');
            cb();
        });
    }

    function doExport(selRanges, audioSel) {
        var btn = $('btnAnalyze');
        if (audioSel !== 'all') {
            btn.textContent = '⏳ Ses track\'leri ayarlanıyor…';
            evalJsx('ACS_muteForAnalysis("' + audioSel + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') {
                    exportFailed('track seçimi uygulanamadı: ' + p.slice(1).join('|'));
                    return;
                }
                state.mutesApplied = true;
                if ((parseInt(p[2], 10) || 0) > 0) {
                    log('UYARI: ' + p[2] + ' track mute edilemedi; analiz istenmeyen sesi içerebilir.');
                }
                var names = audioSel.split(',').map(function (x) { return 'A' + (parseInt(x, 10) + 1); });
                log('Analiz sesi: ' + names.join(', ') + ' (diğerleri geçici mute)');
                exportNow(selRanges);
            });
        } else {
            exportNow(selRanges);
        }
    }

    function exportNow(selRanges) {
        var btn = $('btnAnalyze');
        btn.textContent = '⏳ Ses dışa aktarılıyor…';
        var wavPath = path.join(os.tmpdir(), 'acs_audio.wav');
        var t0 = Date.now();
        var script = 'ACS_exportAudio2("' + jsxEscape(wavPath) + '", "' +
            jsxEscape(PRESET_CANDIDATES.join('||')) + '")';

        evalJsx(script, function (res) {
            var p = res.split('|');
            if (p[0] === 'OK') {
                log('Ses dışa aktarıldı (' + ((Date.now() - t0) / 1000).toFixed(1) + ' sn, ' +
                    Math.round(parseInt(p[2], 10) / 1024 / 1024) + ' MB, ' + p[3] + ')');
                restoreThen(function () { runAnalysis(wavPath, selRanges); });
                return;
            }
            // Direkt export olmadı → AME kuyruğuna düş
            log('Direkt export başarısız: ' + p.slice(1).join('|'));
            log('Adobe Media Encoder ile deneniyor (AME açılabilir, bekleyin)…');
            btn.textContent = '⏳ AME ile dışa aktarılıyor…';
            var ameScript = 'ACS_exportAudioAME("' + jsxEscape(wavPath) + '", "' +
                jsxEscape(PRESET_CANDIDATES[2]) + '")';
            evalJsx(ameScript, function (res2) {
                var p2 = res2.split('|');
                if (p2[0] !== 'OK') {
                    restoreThen(function () {
                        exportFailed('AME da başarısız: ' + p2.slice(1).join('|'));
                    });
                    return;
                }
                log('AME işi kuyruğa alındı (' + p2[1] + '), dosya bekleniyor…');
                waitForFile(wavPath, 180000, function (ok, size) {
                    // AME canlı proje durumunu render ettiği için mute'lar ancak
                    // dosya tamamlandıktan (ya da vazgeçildikten) sonra geri alınır
                    if (!ok) {
                        restoreThen(function () {
                            exportFailed('AME çıktısı 3 dk içinde oluşmadı (son boyut: ' + size + ')');
                        });
                        return;
                    }
                    log('Ses dışa aktarıldı (AME, ' + ((Date.now() - t0) / 1000).toFixed(1) +
                        ' sn, ' + Math.round(size / 1024 / 1024) + ' MB)');
                    restoreThen(function () { runAnalysis(wavPath, selRanges); });
                });
            });
        });
    }

    function runAnalysis(wavPath, selRanges) {
        var btn = $('btnAnalyze');
        btn.textContent = '⏳ Analiz ediliyor…';

        // setTimeout: UI bir kez boyansın, sonra senkron analiz çalışsın
        setTimeout(function () {
            try {
                var overrides = getParams();
                var r = ACSAnalyzer.analyzeFile(fs, wavPath, 'olculu', overrides);

                // Otomatik eşik kullanıldıysa hesaplananı kaydırıcıya yansıt
                if ($('autoThreshold').checked) {
                    setSliderDb(r.usedOpts.thresholdDb);
                }
                var thrInfo = 'Eşik: ' + r.usedOpts.thresholdDb.toFixed(1) + ' dB' +
                    ($('autoThreshold').checked
                        ? ' (oto — gürültü ' + r.auto.noiseDb.toFixed(1) +
                          ' dB, konuşma ' + r.auto.speechDb.toFixed(1) + ' dB)'
                        : ' (manuel)');
                $('thresholdInfo').textContent = thrInfo;
                if (!r.auto.confident && $('autoThreshold').checked) {
                    log('Uyarı: ses dinamiği dar, otomatik eşik emin değil. Manuel deneyin.');
                }

                var cuts = r.cuts;
                var scopeNote = '';
                if (selRanges) {
                    var before = cuts.length;
                    cuts = intersectCuts(cuts, selRanges);
                    scopeNote = ' (seçim dışı ' + (before - cuts.length) + ' aday elendi)';
                }
                state.lastCuts = cuts;

                var totalCut = 0;
                for (var i = 0; i < cuts.length; i++) totalCut += cuts[i].end - cuts[i].start;
                totalCut = Math.round(totalCut * 100) / 100;

                log('Analiz bitti: ' + r.windowCount + ' pencere, ' +
                    cuts.length + ' kesim adayı' + scopeNote);

                if (cuts.length === 0) {
                    showResult(true, 'Kesilecek sessizlik bulunamadı.<br>' + thrInfo);
                } else {
                    showResult(true,
                        '<b>' + cuts.length + ' sessizlik</b> bulundu — toplam <b>' +
                        fmtSec(totalCut) + '</b> kesilecek' +
                        (selRanges ? ' <i>(sadece seçim içinde)</i>' : '') + '<br>' +
                        previewBarHtml(cuts, r.durationSec) +
                        'Video süresi: ' + fmtSec(r.durationSec) + ' → ' +
                        fmtSec(r.durationSec - totalCut) + '<br>' + thrInfo);
                    $('btnCut').style.display = 'block';
                    $('manageRow').style.display = 'block';
                    resetCutButton();
                }
            } catch (e) {
                log('Analiz HATASI: ' + (e && e.message ? e.message : e));
                showResult(false, 'Analiz başarısız. Günlüğe bakın.');
            }
            resetAnalyzeButton();
        }, 50);
    }

    /* ---- kesme ---- */

    function resetCutButton() {
        state.cutArmed = false;
        $('btnCut').textContent = '✂️ Sessizlikleri Kes (' +
            (state.lastCuts ? state.lastCuts.length : 0) + ')';
    }

    // Parti boyutları: her evalScript çağrısı kısa kalsın, Premiere donmasın.
    // Razor en yavaş işlem (player taşıma içeriyor), partisi küçük tutulur.
    var CHUNK_RAZOR = 20;
    var CHUNK_REMOVE = 60;

    function pairsStr(cutsArr) {
        var out = [];
        for (var i = 0; i < cutsArr.length; i++) {
            out.push(cutsArr[i].start + ',' + cutsArr[i].end);
        }
        return out.join(';');
    }

    function cut() {
        if (!state.lastCuts || state.lastCuts.length === 0) return;
        if (!state.cutArmed) {
            state.cutArmed = true;
            $('btnCut').textContent = '⚠️ Emin misiniz? Tekrar tıklayın';
            setTimeout(function () { if (state.cutArmed) resetCutButton(); }, 4000);
            return;
        }
        state.cutArmed = false;

        // v0.7: faz sırası bağımsız (razor multi-track + ripple'sız silme +
        // mutlak-hedefli kompaksiyon). Unlink/relink YOK — native razor linkleri
        // koruyor, kompaksiyon idempotent taşımayla çift kaymayı engelliyor.
        var cuts = state.lastCuts.slice(0);
        cuts.sort(function (a, b) { return a.start - b.start; });

        var boundaries = [];
        for (var i = 0; i < cuts.length; i++) {
            boundaries.push(cuts[i].start, cuts[i].end);
        }

        var manage = getManageMode();
        var btn = $('btnCut');
        btn.disabled = true;
        var t0 = Date.now();
        var tPhase = Date.now();
        var prog = { razored: 0, razorErr: 0, removed: 0, muted: 0, compacted: 0, compactErr: 0,
                     linked: 0, linkMiss: 0, razorMode: '', tcMode: '' };

        function phaseElapsed() {
            var s = ((Date.now() - tPhase) / 1000).toFixed(1);
            tPhase = Date.now();
            return s + ' sn';
        }
        var MANAGE_LABELS = {
            remove_close: 'sil + boşlukları kapat',
            remove_keep: 'sil, boşluk kalsın',
            mute: 'sustur',
            cutonly: 'sadece kes'
        };
        log('İşlem başladı: ' + cuts.length + ' aralık, mod: ' + MANAGE_LABELS[manage]);

        function cutFailed(msg) {
            btn.disabled = false;
            log('Kesim HATASI: ' + msg);
            showResult(false, 'Kesim yarıda kaldı. Günlüğe bakın. Timeline\'ı Ctrl+Z ile geri alın ' +
                '(her parti ayrı undo adımı olabilir, birkaç kez basın).');
            resetCutButton();
        }

        // Faz 0: yedek sequence (istenirse)
        function backupStep() {
            if (!$('makeBackup').checked) { razorStep(0); return; }
            btn.textContent = '⏳ Yedek oluşturuluyor…';
            evalJsx('ACS_backupSequence()', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') {
                    log('UYARI: yedek oluşturulamadı (' + p.slice(1).join('|') + '), devam ediliyor.');
                } else {
                    log('Yedek sequence oluşturuldu: "' + p[1] + '" kopyası Project panelinde.');
                }
                razorStep(0);
            });
        }

        // Faz 1: razor (sustur modunda yalnız ses track'leri kesilir)
        function razorStep(idx) {
            if (idx >= boundaries.length) {
                log('Razor bitti: ' + prog.razored + ' kesik (' + phaseElapsed() +
                    ', mod: ' + prog.razorMode + ')' +
                    (prog.razorErr ? ', ' + prog.razorErr + ' hata' : ''));
                // Native multi-track razor linkleri koruduğu için relink yok
                if (manage === 'cutonly') done();
                else if (manage === 'mute') muteStep(0);
                else removeStep(0);
                return;
            }
            var chunk = boundaries.slice(idx, idx + CHUNK_RAZOR);
            btn.textContent = '⏳ Razor: ' + Math.min(idx + chunk.length, boundaries.length) +
                '/' + boundaries.length;
            evalJsx('ACS_razorBatch("' + chunk.join(';') + '", "' +
                (manage === 'mute' ? 'audio' : 'all') + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { cutFailed('razor: ' + p.slice(1).join('|')); return; }
                prog.razored += parseInt(p[1], 10) || 0;
                prog.razorErr += parseInt(p[3], 10) || 0;
                if (p[5] && prog.razorMode.indexOf(p[5]) < 0) {
                    prog.razorMode += (prog.razorMode ? ' / ' : '') + p[5];
                    if (p[5].indexOf('seek') === 0) {
                        log('Not: timecode kalibrasyonu tutmadı, bu partide yavaş (seek) moda düşüldü.');
                    }
                }
                if (!prog.tcMode && p[5]) prog.tcMode = p[5].split(' ')[0];
                setTimeout(function () { razorStep(idx + CHUNK_RAZOR); }, 30);
            });
        }

        // Faz 2a: ripple'sız silme
        function removeStep(idx) {
            if (idx >= cuts.length) {
                log('Silme bitti: ' + prog.removed + ' klip silindi (' + phaseElapsed() + ')');
                if (manage === 'remove_close') compactStep();
                else done(); // remove_keep: boşluklar kalır, linkler korunur
                return;
            }
            var chunk = cuts.slice(idx, idx + CHUNK_REMOVE);
            btn.textContent = '⏳ Silme: ' + Math.min(idx + chunk.length, cuts.length) +
                '/' + cuts.length;
            evalJsx('ACS_removeBatch("' + pairsStr(chunk) + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { cutFailed('silme: ' + p.slice(1).join('|')); return; }
                prog.removed += parseInt(p[1], 10) || 0;
                setTimeout(function () { removeStep(idx + CHUNK_REMOVE); }, 30);
            });
        }

        // Faz 2b: susturma (ses kliplerini devre dışı bırak, hiçbir şey kaymaz)
        function muteStep(idx) {
            if (idx >= cuts.length) {
                log('Susturma bitti: ' + prog.muted + ' ses klibi devre dışı (' + phaseElapsed() + ')');
                done();
                return;
            }
            var chunk = cuts.slice(idx, idx + CHUNK_REMOVE);
            btn.textContent = '⏳ Susturma: ' + Math.min(idx + chunk.length, cuts.length) +
                '/' + cuts.length;
            evalJsx('ACS_muteBatch("' + pairsStr(chunk) + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { cutFailed('susturma: ' + p.slice(1).join('|')); return; }
                prog.muted += parseInt(p[1], 10) || 0;
                setTimeout(function () { muteStep(idx + CHUNK_REMOVE); }, 30);
            });
        }

        // Faz 3: kompaksiyon (link-güvenli, unlink/relink YOK).
        // Adım 1: tüm kliplerin hedef pozisyonu bir kez hesaplanır (JSX global).
        // Adım 2: her klip mevcut konumuna göre göreli taşınır (idempotent) —
        // linkli partner zaten taşıdıysa no-op olur, çift kayma imkansız.
        function compactStep() {
            btn.textContent = '⏳ Boşluklar hesaplanıyor…';
            evalJsx('ACS_compactPrepare("' + pairsStr(cuts) + '", "' + (prog.tcMode || 'floor') + '")',
                function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') {
                    log('Kompaksiyon hazırlığı HATASI: ' + p.slice(1).join('|'));
                    log('Boşluklar açık kaldı; gerekirse Ctrl+Z ile geri alın.');
                    done();
                    return;
                }
                var nTargets = parseInt(p[1], 10) || 0;
                phaseElapsed(); // hazırlık süresini ayır
                if (nTargets === 0) { log('Taşınacak klip yok.'); done(); return; }
                log('Boşluklar kapatılıyor: ' + nTargets + ' klip taşınacak…');
                compactApply(0, nTargets);
            });
        }

        function compactApply(from, total) {
            evalJsx('ACS_compactApply(' + from + ', ' + CHUNK_REMOVE + ')', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') {
                    log('Kompaksiyon HATASI: ' + p.slice(1).join('|'));
                    log('Boşluklar açık kalmış olabilir; gerekirse Ctrl+Z ile geri alın.');
                    done();
                    return;
                }
                var processed = parseInt(p[1], 10) || 0;
                prog.compacted += parseInt(p[2], 10) || 0;
                total = parseInt(p[3], 10) || total;
                prog.compactErr += parseInt(p[4], 10) || 0;
                if (p[5] && prog.compactErr && !prog.compactErrLogged) {
                    prog.compactErrLogged = 1;
                    log('Kompaksiyon ilk hata: ' + p.slice(5).join('|'));
                }
                var next = from + processed;
                btn.textContent = '⏳ Kapatma: ' + Math.min(next, total) + '/' + total;
                if (next >= total || processed === 0) {
                    log('Kompaksiyon bitti: ' + prog.compacted + ' klip taşındı' +
                        (prog.compactErr ? ', ' + prog.compactErr + ' hata' : '') +
                        ' (' + phaseElapsed() + ')');
                    done();
                } else {
                    setTimeout(function () { compactApply(next, total); }, 20);
                }
            });
        }

        function done() {
            btn.disabled = false;
            var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            var summary = 'razor=' + prog.razored;
            if (manage === 'remove_close' || manage === 'remove_keep') {
                summary += ' | silinen=' + prog.removed;
            }
            if (manage === 'remove_close') {
                summary += ' | taşınan=' + prog.compacted +
                    (prog.compactErr ? ' | taşımaHatası=' + prog.compactErr : '');
            }
            if (manage === 'mute') summary += ' | susturulan=' + prog.muted;
            summary += ' | süre=' + elapsed + 'sn';
            log('İşlem tamamlandı: ' + summary);
            showResult(true, 'İşlem tamamlandı ✓ (' + MANAGE_LABELS[manage] + ')<br>' + summary +
                '<br><i>Timeline\'ı kontrol edin. Sorun varsa Ctrl+Z (her parti ayrı adım olabilir).</i>');
            btn.style.display = 'none';
            $('manageRow').style.display = 'none';
        }

        backupStep();
    }

    function getManageMode() {
        var radios = document.getElementsByName('manage');
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
        return 'remove_close';
    }

    /* Kesim haritası: yeşil = kalan, kırmızı = kesilecek (AutoCut önizlemesi gibi) */
    function previewBarHtml(cuts, durationSec) {
        if (!durationSec || durationSec <= 0) return '';
        var spans = '';
        for (var i = 0; i < cuts.length; i++) {
            var l = cuts[i].start / durationSec * 100;
            var w = Math.max(0.15, (cuts[i].end - cuts[i].start) / durationSec * 100);
            spans += '<i style="left:' + l.toFixed(3) + '%;width:' + w.toFixed(3) + '%"></i>';
        }
        return '<div class="previewBar">' + spans + '</div>';
    }

    /* ============================================================
     * BEAT SEKMESİ (müziğe göre oyun kesimi)
     * ============================================================ */

    function renderBeatTracks(aCountsStr, vCountsStr) {
        var card = $('beatTracksCard');
        if (!aCountsStr) { card.style.display = 'none'; return; }
        var aCounts = aCountsStr.split(',');
        state.audioCounts = [];
        for (var z = 0; z < aCounts.length; z++) state.audioCounts.push(parseInt(aCounts[z], 10) || 0);
        state.videoCounts = [];
        var vArr = (vCountsStr || '').split(',');
        for (var y = 0; y < vArr.length; y++) state.videoCounts.push(parseInt(vArr[y], 10) || 0);

        var firstContent = -1;
        for (var i = 0; i < state.audioCounts.length; i++) {
            if (state.audioCounts[i] > 0 && firstContent < 0) firstContent = i;
        }
        var mh = '', gh = '';
        for (i = 0; i < state.audioCounts.length; i++) {
            var c = state.audioCounts[i];
            var label = 'A' + (i + 1) + (c > 0 ? ' (' + c + ' klip)' : ' (boş)');
            mh += '<label class="row"><input type="radio" name="beatMusic" value="' + i + '"' +
                (i === firstContent ? ' checked' : '') + '><span>' + label + '</span></label>';
            // oyun varsayılanı: müzik dışındaki dolu ses track'leri
            var gChecked = (c > 0 && i !== firstContent) ? ' checked' : '';
            gh += '<label class="row"><input type="checkbox" class="beatGame" value="' + i + '"' +
                gChecked + '><span>' + label + '</span></label>';
        }
        $('beatMusicTracks').innerHTML = mh;
        $('beatGameTracks').innerHTML = gh;
        card.style.display = 'block';
        // müzik track'i değişince CSV'den otomatik yeniden eşleştir
        var mr = document.getElementsByName('beatMusic');
        for (var q = 0; q < mr.length; q++) mr[q].addEventListener('change', autoMatchCsv);
    }

    function getBeatMusic() {
        var r = document.querySelector('input[name="beatMusic"]:checked');
        return r ? parseInt(r.value, 10) : -1;
    }

    function getBeatGame() {
        var boxes = document.querySelectorAll('.beatGame');
        var out = [];
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].checked) out.push(parseInt(boxes[i].value, 10));
        }
        return out;
    }

    function showBeatResult(ok, html) {
        var el = $('beatResult');
        el.className = 'result' + (ok ? '' : ' err');
        el.innerHTML = html;
        el.style.display = 'block';
    }

    function previewBeatBar(beats, dur) {
        if (!dur || dur <= 0) return '';
        var s = '';
        for (var i = 0; i < beats.length; i++) {
            s += '<i style="left:' + (beats[i] / dur * 100).toFixed(3) + '%;width:0.4%"></i>';
        }
        return '<div class="previewBar beat">' + s + '</div>';
    }

    function resetBeatDetect() {
        $('btnBeatDetect').disabled = false;
        $('btnBeatDetect').textContent = '🥁 Beat\'leri Bul';
    }

    function resetBeatApply() {
        state.beatArmed = false;
        $('btnBeatApply').textContent = '🎯 Oyunu Beat\'e Hizala';
    }

    /* Beat tespiti: yalnız müzik track'ini export et (diğerlerini geçici mute),
     * sonra onset/BPM analizi. */
    function beatDetect() {
        if (!fs) { log('HATA: Node.js erişimi yok.'); return; }
        var music = getBeatMusic();
        if (music < 0) { showBeatResult(false, 'Önce müzik track\'i seçin.'); return; }

        var btn = $('btnBeatDetect');
        btn.disabled = true;
        $('beatResult').style.display = 'none';
        $('btnBeatApply').style.display = 'none';
        state.lastBeats = null;
        btn.textContent = '⏳ Müzik dışa aktarılıyor…';

        evalJsx('ACS_muteForAnalysis("' + music + '")', function (res) {
            var p = res.split('|');
            if (p[0] !== 'OK') {
                resetBeatDetect();
                showBeatResult(false, 'Track ayarlanamadı: ' + p.slice(1).join('|'));
                return;
            }
            state.mutesApplied = true;
            log('Beat: yalnız A' + (music + 1) + ' (müzik) dışa aktarılıyor (diğerleri geçici mute)');
            var wav = path.join(os.tmpdir(), 'acs_beat.wav');
            var t0 = Date.now();
            evalJsx('ACS_exportAudio2("' + jsxEscape(wav) + '", "' +
                jsxEscape(PRESET_CANDIDATES.join('||')) + '")', function (r2) {
                var q = r2.split('|');
                restoreThen(function () {
                    if (q[0] !== 'OK') {
                        resetBeatDetect();
                        log('Beat export HATASI: ' + q.slice(1).join('|'));
                        showBeatResult(false, 'Müzik dışa aktarılamadı. Günlüğe bakın.');
                        return;
                    }
                    log('Müzik dışa aktarıldı (' + ((Date.now() - t0) / 1000).toFixed(1) + ' sn, ' +
                        Math.round(parseInt(q[2], 10) / 1024 / 1024) + ' MB)');
                    btn.textContent = '⏳ Beat analizi…';
                    setTimeout(function () { runBeatAnalysis(wav); }, 50);
                });
            });
        });
    }

    function runBeatAnalysis(wav) {
        try {
            var subdiv = parseFloat($('beatSubdiv').value) || 1;
            var bpmVal = parseInt($('beatBpm').value, 10);
            var r, kaynak;
            if (!isNaN(bpmVal) && bpmVal > 0) {
                // BPM biliniyor → periyot kesin, sadece fazı müziğe kilitle (güvenilir)
                r = ACSAnalyzer.alignGridToMusic(fs, wav, bpmVal, { subdivision: subdiv });
                kaynak = 'BPM ' + bpmVal + ' (tap/elle), faz ' + r.phaseSec + 's';
                log('Beat: ızgara müziğe hizalandı — ' + kaynak + ', ' + r.beats.length + ' nokta');
            } else {
                // BPM yok → otomatik tahmin (yoğun müzikte daha az isabetli)
                var opts = {
                    sensitivity: (parseInt($('beatSens').value, 10) || 50) / 100,
                    useGrid: $('beatGrid').checked,
                    subdivision: subdiv,
                    minGapSec: (parseInt($('beatMinGap').value, 10) || 120) / 1000
                };
                r = ACSAnalyzer.detectBeatsFile(fs, wav, opts);
                kaynak = 'otomatik BPM≈' + r.detectedBpm + ' (tahminî — BPM girersen daha iyi)';
                log('Beat analizi: ' + r.onsetCount + ' onset, ' + kaynak + ', ' + r.beats.length + ' nokta');
            }
            state.lastBeats = r.beats;

            if (r.beats.length === 0) {
                showBeatResult(true, 'Beat bulunamadı. BPM girip tekrar deneyin (en güvenilir yol).');
            } else {
                showBeatResult(true,
                    '<b>' + r.beats.length + ' beat</b> noktası — ' + kaynak + '<br>' +
                    previewBeatBar(r.beats, r.durationSec) +
                    'Süre: ' + fmtSec(r.durationSec));
                $('btnBeatApply').style.display = 'block';
                resetBeatApply();
            }
        } catch (e) {
            log('Beat analizi HATASI: ' + (e && e.message ? e.message : e));
            showBeatResult(false, 'Analiz başarısız. Günlüğe bakın.');
        }
        resetBeatDetect();
    }

    /* Tap tempo: kullanıcı müzik çalarken ritme tıklar → vuruş aralıklarından
     * BPM hesaplanır ve BPM alanına yazılır (faz analizde müziğe göre bulunur). */
    function onTap() {
        var now = Date.now();
        if (state.taps.length && now - state.taps[state.taps.length - 1] > 2000) {
            state.taps = []; // 2 sn ara → yeni ölçüm
        }
        state.taps.push(now);
        if (state.taps.length > 8) state.taps.shift(); // son 8 vuruş
        if (state.taps.length >= 2) {
            var iv = [];
            for (var i = 1; i < state.taps.length; i++) iv.push(state.taps[i] - state.taps[i - 1]);
            iv.sort(function (a, b) { return a - b; });
            var med = iv[Math.floor(iv.length / 2)];
            if (med > 0) {
                var bpm = Math.round(60000 / med);
                $('beatBpm').value = bpm;
                $('tapInfo').textContent = 'BPM ≈ ' + bpm + ' (' + state.taps.length + ' vuruş)';
            }
        } else {
            $('tapInfo').textContent = 'devam et… (1 vuruş)';
        }
    }

    /* ---- CSV BPM kaynağı (dış araçtan) ---- */

    function populateCsvPick(rows) {
        var sel = $('csvPick');
        if (!rows.length) { sel.style.display = 'none'; sel.innerHTML = ''; return; }
        var html = '<option value="">— CSV\'den parça seç —</option>';
        for (var i = 0; i < rows.length; i++) {
            html += '<option value="' + i + '">' +
                rows[i].label.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</option>';
        }
        sel.innerHTML = html;
        sel.style.display = 'block';
    }

    function loadCsvFromPath(p) {
        if (!fs) { log('CSV: Node erişimi yok.'); return; }
        if (!p) { log('CSV: önce dosya yolu gir.'); return; }
        try {
            var text = fs.readFileSync(p, 'utf8');
            state.csvRows = ACSAnalyzer.parseBpmCsv(text);
            if (!state.csvRows.length) {
                log('CSV: geçerli satır bulunamadı (sütun düzenini kontrol et).');
                populateCsvPick([]);
                return;
            }
            try { localStorage.setItem('hoodoo_csv_path', p); } catch (e) {}
            populateCsvPick(state.csvRows);
            log('CSV yüklendi: ' + state.csvRows.length + ' parça.');
            autoMatchCsv();
        } catch (e) {
            log('CSV okunamadı: ' + (e && e.message ? e.message : e));
        }
    }

    /* Seçili müzik track'inin dosya adına göre CSV'de otomatik eşleştir. */
    function autoMatchCsv() {
        if (!state.csvRows || !state.csvRows.length) return;
        var music = getBeatMusic();
        if (music < 0) return;
        evalJsx('ACS_getAudioClipName(' + music + ')', function (res) {
            var p = res.split('|');
            if (p[0] !== 'OK') return;
            var clip = ACSAnalyzer.normalizeName(p[2] || p[1]); // medya yolu öncelikli
            if (!clip) return;
            for (var i = 0; i < state.csvRows.length; i++) {
                var cf = ACSAnalyzer.normalizeName(state.csvRows[i].filename);
                if (cf && (cf === clip || clip.indexOf(cf) >= 0 || cf.indexOf(clip) >= 0)) {
                    $('csvPick').value = String(i);
                    $('beatBpm').value = state.csvRows[i].bpm;
                    $('tapInfo').textContent = 'CSV: ' + state.csvRows[i].bpm + ' BPM (otomatik eşleşti)';
                    log('CSV eşleşti: "' + state.csvRows[i].filename + '" → ' + state.csvRows[i].bpm + ' BPM');
                    return;
                }
            }
            log('CSV: müzik dosyası (' + clip + ') listede bulunamadı; listeden elle seçebilirsin.');
        });
    }

    function onCsvPick() {
        var i = parseInt($('csvPick').value, 10);
        if (isNaN(i) || !state.csvRows[i]) return;
        $('beatBpm').value = state.csvRows[i].bpm;
        $('tapInfo').textContent = 'CSV: ' + state.csvRows[i].bpm + ' BPM seçildi';
        log('CSV\'den seçildi: ' + state.csvRows[i].label);
    }

    function browseCsv() {
        try {
            if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
                var r = window.cep.fs.showOpenDialog(false, false, 'CSV seç', '', ['csv']);
                if (r && r.data && r.data.length) {
                    $('csvPath').value = r.data[0];
                    loadCsvFromPath(r.data[0]);
                    return;
                }
            }
        } catch (e) {}
        log('Gözat açılamadı; CSV yolunu alana yapıştırıp "Yükle"ye bas.');
    }

    /* Oyunu beat'e hizala: oyun sesindeki vuruşları bul, her birini en yakın
     * müzik beat'ine ÇEK. Yöntem: vuruştan önceki fazla süreyi sil (condense).
     * Sadece oyun ses + video etkilenir; müzik track'i hiç dokunulmaz.
     * Pipeline: razor(sınırlar) → track-özel sil → track-özel kompaksiyon. */
    function beatApply() {
        if (!state.lastBeats || state.lastBeats.length === 0) {
            showBeatResult(false, 'Önce "Beat\'leri Bul" ile müzik ritmini bulun.');
            return;
        }
        if (!state.beatArmed) {
            state.beatArmed = true;
            $('btnBeatApply').textContent = '⚠️ Emin misiniz? Tekrar tıklayın';
            setTimeout(function () { if (state.beatArmed) resetBeatApply(); }, 4000);
            return;
        }
        state.beatArmed = false;

        var music = getBeatMusic();
        var game = [];
        var sel = getBeatGame();
        for (var i = 0; i < sel.length; i++) if (sel[i] !== music) game.push(sel[i]);
        if (game.length === 0) {
            showBeatResult(false, 'En az bir oyun ses track\'i seçin (müzik hariç).');
            resetBeatApply();
            return;
        }
        var vIdx = [];
        if ($('beatCutVideo').checked) {
            for (i = 0; i < state.videoCounts.length; i++) if (state.videoCounts[i] > 0) vIdx.push(i);
        }

        var btn = $('btnBeatApply');
        btn.disabled = true;
        var t0 = Date.now();

        // 1) Oyun track'ini izole edip vuruşları (onset) bul
        btn.textContent = '⏳ Oyun sesi analiz ediliyor…';
        evalJsx('ACS_muteForAnalysis("' + game.join(',') + '")', function (res) {
            var p = res.split('|');
            if (p[0] !== 'OK') {
                btn.disabled = false;
                showBeatResult(false, 'Track ayarlanamadı: ' + p.slice(1).join('|'));
                resetBeatApply();
                return;
            }
            state.mutesApplied = true;
            var wav = path.join(os.tmpdir(), 'acs_game.wav');
            evalJsx('ACS_exportAudio2("' + jsxEscape(wav) + '", "' +
                jsxEscape(PRESET_CANDIDATES.join('||')) + '")', function (r2) {
                var q = r2.split('|');
                restoreThen(function () {
                    if (q[0] !== 'OK') {
                        btn.disabled = false;
                        log('Oyun export HATASI: ' + q.slice(1).join('|'));
                        showBeatResult(false, 'Oyun sesi dışa aktarılamadı. Günlüğe bakın.');
                        resetBeatApply();
                        return;
                    }
                    var hits;
                    try {
                        var gOpts = {
                            sensitivity: (parseInt($('beatSens').value, 10) || 50) / 100,
                            useGrid: false,
                            minGapSec: (parseInt($('beatMinGap').value, 10) || 120) / 1000,
                            mode: 'transient' // oyun vuruşları her frekansta olabilir → geniş-bant
                        };
                        hits = ACSAnalyzer.detectBeatsFile(fs, wav, gOpts).beats;
                        log('Oyun vuruşları bulundu: ' + hits.length);
                    } catch (e) {
                        btn.disabled = false;
                        log('Oyun analizi HATASI: ' + (e && e.message ? e.message : e));
                        showBeatResult(false, 'Oyun analizi başarısız.');
                        resetBeatApply();
                        return;
                    }
                    if (!hits.length) {
                        btn.disabled = false;
                        showBeatResult(false, 'Oyun sesinde vuruş bulunamadı. Hassasiyeti artırın.');
                        resetBeatApply();
                        return;
                    }
                    // 2) Hizalama planı
                    var plan = ACSAnalyzer.planBeatAlign(hits, state.lastBeats, {});
                    log('Hizalama planı: ' + plan.aligned + ' vuruş hizalanacak, ' +
                        plan.skipped + ' atlandı, ' + plan.removedSec + ' sn kırpılacak');
                    if (!plan.removeIntervals.length) {
                        btn.disabled = false;
                        showBeatResult(true, 'Hizalanacak fazlalık bulunamadı (vuruşlar zaten beat\'lere ' +
                            'yakın ya da beat\'in gerisinde — zaman eklenemez).');
                        resetBeatApply();
                        return;
                    }
                    runAlign(plan, game, vIdx, music, t0);
                });
            });
        });
    }

    function aLabel(arr) { var o = []; for (var k = 0; k < arr.length; k++) o.push(arr[k] + 1); return o.join(','); }

    /* Hizalama uygulaması: yedek → razor(sınırlar) → track-özel sil →
     * track-özel kompaksiyon. Hepsi yalnız oyun ses + video; müzik korunur. */
    function runAlign(plan, game, vIdx, music, t0) {
        var btn = $('btnBeatApply');
        var intervals = plan.removeIntervals;
        var boundaries = [];
        for (var i = 0; i < intervals.length; i++) boundaries.push(intervals[i][0], intervals[i][1]);
        var pairsAll = intervals.map(function (iv) { return iv[0] + ',' + iv[1]; }).join(';');
        var prog = { razored: 0, removed: 0, compacted: 0, tcMode: 'floor', tcSet: false };
        var CH_R = 20, CH = 60;
        log('Hizalama başladı | oyun A:[' + aLabel(game) + '] video V:[' + aLabel(vIdx) +
            '] | müzik A' + (music + 1) + ' korunuyor');

        function fail(msg) {
            btn.disabled = false;
            log('Hizalama HATASI: ' + msg);
            showBeatResult(false, 'Hizalama yarıda kaldı. Günlüğe bakın. Ctrl+Z / yedek ile geri alın.');
            resetBeatApply();
        }

        // yedek (hizalama geri dönüşü zor; her zaman al)
        btn.textContent = '⏳ Yedek alınıyor…';
        evalJsx('ACS_backupSequence()', function (rb) {
            var pb = rb.split('|');
            if (pb[0] === 'OK') log('Yedek sequence oluşturuldu: "' + pb[1] + '" kopyası.');
            else log('UYARI: yedek alınamadı (' + pb.slice(1).join('|') + '), devam ediliyor.');
            razorStep(0);
        });

        function razorStep(idx) {
            if (idx >= boundaries.length) {
                log('Razor bitti: ' + prog.razored + ' kesik (mod: ' + prog.tcMode + ')');
                removeStep(0);
                return;
            }
            var chunk = boundaries.slice(idx, idx + CH_R);
            btn.textContent = '⏳ 1/3 Kes: ' + Math.min(idx + chunk.length, boundaries.length) +
                '/' + boundaries.length;
            evalJsx('ACS_beatRazorBatch("' + chunk.join(';') + '", "' + vIdx.join(',') +
                '", "' + game.join(',') + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { fail('razor: ' + p.slice(1).join('|')); return; }
                prog.razored += parseInt(p[1], 10) || 0;
                if (!prog.tcSet && p[5]) { prog.tcMode = p[5].split(' ')[0]; prog.tcSet = true; }
                setTimeout(function () { razorStep(idx + CH_R); }, 30);
            });
        }

        function removeStep(idx) {
            if (idx >= intervals.length) {
                log('Silme bitti: ' + prog.removed + ' fazla parça silindi');
                compactPrep();
                return;
            }
            var chunk = intervals.slice(idx, idx + CH)
                .map(function (iv) { return iv[0] + ',' + iv[1]; }).join(';');
            btn.textContent = '⏳ 2/3 Sil: ' + Math.min(idx + CH, intervals.length) + '/' + intervals.length;
            evalJsx('ACS_alignRemoveBatch("' + chunk + '", "' + vIdx.join(',') +
                '", "' + game.join(',') + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { fail('sil: ' + p.slice(1).join('|')); return; }
                prog.removed += parseInt(p[1], 10) || 0;
                setTimeout(function () { removeStep(idx + CH); }, 30);
            });
        }

        function compactPrep() {
            btn.textContent = '⏳ 3/3 Kaydırma hazırlanıyor…';
            evalJsx('ACS_alignCompactPrepare("' + pairsAll + '", "' + vIdx.join(',') +
                '", "' + game.join(',') + '", "' + prog.tcMode + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { fail('kaydırma hazırlığı: ' + p.slice(1).join('|')); return; }
                var nT = parseInt(p[1], 10) || 0;
                if (!nT) { doneAlign(); return; }
                compactApply(0, nT);
            });
        }

        function compactApply(from, total) {
            evalJsx('ACS_alignCompactApply(' + from + ', ' + CH + ')', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { fail('kaydırma: ' + p.slice(1).join('|')); return; }
                var processed = parseInt(p[1], 10) || 0;
                prog.compacted += parseInt(p[2], 10) || 0;
                total = parseInt(p[3], 10) || total;
                var next = from + processed;
                btn.textContent = '⏳ 3/3 Kaydır: ' + Math.min(next, total) + '/' + total;
                if (next >= total || processed === 0) doneAlign();
                else setTimeout(function () { compactApply(next, total); }, 20);
            });
        }

        function doneAlign() {
            btn.disabled = false;
            log('Hizalama tamamlandı: razor=' + prog.razored + ' | silinen=' + prog.removed +
                ' | kaydırılan=' + prog.compacted + ' | süre=' +
                ((Date.now() - t0) / 1000).toFixed(1) + 'sn');
            showBeatResult(true, 'Hizalama tamamlandı ✓<br>' + plan.aligned +
                ' vuruş beat\'e oturtuldu, ' + plan.removedSec + ' sn kırpıldı<br>' +
                '<i>Müzik (A' + (music + 1) + ') korundu. Ctrl+Z / yedek ile geri alınabilir.</i>');
            btn.style.display = 'none';
        }
    }

    /* ---- UI bağlantıları ---- */

    $('btnAnalyze').addEventListener('click', analyze);
    $('btnCut').addEventListener('click', cut);
    $('btnBeatDetect').addEventListener('click', beatDetect);
    $('btnBeatApply').addEventListener('click', beatApply);
    $('btnTap').addEventListener('click', onTap);
    $('btnCsvLoad').addEventListener('click', function () { loadCsvFromPath($('csvPath').value.trim()); });
    $('btnCsvBrowse').addEventListener('click', browseCsv);
    $('csvPick').addEventListener('change', onCsvPick);
    $('btnRefreshBeat').addEventListener('click', function () {
        log('Track listesi yenileniyor…');
        checkConnection();
    });
    $('beatSens').addEventListener('input', function () {
        $('beatSensVal').textContent = this.value;
    });
    var beatTabs = document.querySelectorAll('.tab');
    for (var bt = 0; bt < beatTabs.length; bt++) {
        beatTabs[bt].addEventListener('click', function () {
            var t = this.dataset.tab;
            var all = document.querySelectorAll('.tab');
            for (var j = 0; j < all.length; j++) {
                if (all[j].dataset.tab === t) all[j].classList.add('active');
                else all[j].classList.remove('active');
            }
            $('tabCut').style.display = (t === 'cut') ? '' : 'none';
            $('tabBeat').style.display = (t === 'beat') ? '' : 'none';
        });
    }
    $('btnRefreshTracks').addEventListener('click', function () {
        log('Track listesi yenileniyor…');
        checkConnection();
    });
    $('btnCopyLog').addEventListener('click', function () {
        var ta = document.createElement('textarea');
        ta.value = $('log').textContent;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        log('Günlük panoya kopyalandı.');
    });

    // Şablon chipleri
    var chips = document.querySelectorAll('.chip');
    for (var c = 0; c < chips.length; c++) {
        chips[c].addEventListener('click', function () {
            applyMode(this.dataset.mode);
        });
    }
    // Alan elle değişirse yerleşik şablon seçimi kalkar (özel kalır)
    var fieldIds = ['pMinSilence', 'pMinSpeech', 'pKeepAfter', 'pKeepBefore'];
    for (var f = 0; f < fieldIds.length; f++) {
        $(fieldIds[f]).addEventListener('input', onFieldEdit);
    }
    $('btnSavePreset').addEventListener('click', saveActivePreset);

    // Eşik kaydırıcısı: elle oynatınca otomatik kapanır
    $('thresholdSlider').addEventListener('input', function () {
        $('thresholdValue').textContent = this.value + ' dB';
        if ($('autoThreshold').checked) {
            $('autoThreshold').checked = false;
            log('Eşik elle ayarlandı: ' + this.value + ' dB (otomatik kapatıldı)');
        }
    });

    /* ---- güncelleme kontrolü ---- */
    function checkForUpdate() {
        if (typeof ACSUpdate === 'undefined') return;
        if (!ACSUpdate.configured) {
            log('Güncelleme kontrolü kapalı (update.js içinde GitHub kullanıcı adı ayarlanmamış).');
            return;
        }
        ACSUpdate.check(ACS_VERSION, function (info, err) {
            if (err) { log('Güncelleme kontrolü atlandı: ' + err); return; }
            if (info && info.newer) {
                log('GÜNCELLEME VAR: v' + info.latest + ' (mevcut v' + ACS_VERSION + ')');
                var bar = $('updateBar');
                bar.innerHTML = '🔔 Yeni sürüm: <b>v' + info.latest + '</b> (sen: v' + ACS_VERSION +
                    ') <button id="btnUpdate">İndir</button>';
                bar.style.display = 'flex';
                $('btnUpdate').addEventListener('click', function () {
                    csInterface.openURLInDefaultBrowser(info.url);
                });
            } else {
                log('Sürüm güncel: v' + ACS_VERSION);
            }
        });
    }

    /* ---- başlangıç ---- */

    log('HooDoo Cut yüklendi. Sürüm ' + ACS_VERSION);
    if (!nodeRequire) log('HATA: Node.js erişimi yok!');
    else if (!fs) log('HATA: fs modülü yüklenemedi!');
    else log('Node.js hazır: ' + (typeof process !== 'undefined' ? process.version : '?'));
    if (typeof ACSAnalyzer === 'undefined') log('HATA: analyzer.js yüklenemedi!');
    if (fs && !fs.existsSync(EPR_PATH)) log('UYARI: EPR preset dosyası bulunamadı: ' + EPR_PATH);
    loadCustomPresets();
    if (CUSTOM_PRESETS.ozel1 || CUSTOM_PRESETS.ozel2) {
        log('Özel şablonlar yüklendi' +
            (CUSTOM_PRESETS.ozel1 ? ' [Özel 1]' : '') +
            (CUSTOM_PRESETS.ozel2 ? ' [Özel 2]' : ''));
    }
    applyMode('olculu');
    checkConnection();
    checkForUpdate();
    // hatırlanan CSV yolunu yükle
    try {
        var savedCsv = localStorage.getItem('hoodoo_csv_path');
        if (savedCsv) { $('csvPath').value = savedCsv; loadCsvFromPath(savedCsv); }
    } catch (e) {}
})();
