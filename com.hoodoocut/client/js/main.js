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

    var ACS_VERSION = '0.9.8.0'; // manifest.xml ile ayni
    var bulkBridge = null;

    var $ = function (id) { return document.getElementById(id); };
    var state = { lastCuts: null, cutArmed: false, mutesApplied: false,
                  busy: false, planContext: null, fps: null, wavPath: null, tickPlan: null };

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
        state.busy = false;
        $('btnCut').disabled = false;
        if (state.wavPath) {
            try { if (fs.existsSync(state.wavPath)) fs.unlinkSync(state.wavPath); }
            catch (e) { log('Gecici WAV temizlenemedi: ' + e.message); }
            state.wavPath = null;
        }
        btn.disabled = false;
        btn.textContent = getWorkMode() === 'tick' ? '🎵 Tıkları Bul' : '🔍 Analiz Et';
    }

    function exportFailed(msg) {
        state.lastCuts = null;
        state.planContext = null;
        resetAnalyzeButton();
        log('Export HATASI: ' + msg);
        showResult(false, 'Ses dışa aktarılamadı. Günlüğe bakın.');
    }

    /* ---- analiz akışı ---- */

    function analyze() {
        if (state.busy) return;
        if (!fs) {
            log('HATA: Node.js erişimi yok. Manifest CEFCommandLine ayarlarını kontrol edin.');
            return;
        }
        if (getWorkMode() === 'tick' && getScope() !== 'selection') {
            showResult(false, 'Tık ritmi yalnız seçili cliplerde çalışır: kapsamı "Seçili clipler" yapın ' +
                've timeline\'da inşaat bölümünü seçin.');
            return;
        }
        var btn = $('btnAnalyze');
        state.busy = true;
        state.planContext = null;
        $('btnCut').disabled = true;
        btn.disabled = true;
        $('analysisResult').style.display = 'none';
        $('btnCut').style.display = 'none';
        $('manageRow').style.display = 'none';
        $('backupRow').style.display = 'none';
        state.lastCuts = null;
        state.tickPlan = null;

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
                doExport(ranges, audioSel, p[2]);
            });
        } else {
            doExport(null, audioSel);
        }
    }

    /* Mute uygulandıysa ne olursa olsun geri al, sonra devam et */
    function restoreThen(cb) {
        if (!state.mutesApplied) { cb(); return; }
        evalJsx('ACS_restoreMutes()', function (res) {
            if (res.split('|')[0] !== 'OK') {
                exportFailed('Mute geri yuklenemedi: ' + res.split('|').slice(1).join('|'));
                return;
            }
            state.mutesApplied = false;
            log('Track mute durumları eski haline döndürüldü.');
            cb();
        });
    }

    function doExport(selRanges, audioSel, selectionContext) {
        if (state.mutesApplied) {
            restoreThen(function () { doExport(selRanges, audioSel, selectionContext); });
            return;
        }
        // Her analiz taze ses kullanir; klip sayisi ve sure efektleri tanimlamaz.
        evalJsx('ACS_getAnalysisContext()', function (envRes) {
            var ep = envRes.split('|');
            if (ep[0] !== 'OK') { exportFailed(ep.slice(1).join('|')); return; }
            if (selectionContext && ep[1] !== selectionContext) {
                exportFailed('Secim okunduktan sonra sequence degisti. Tekrar analiz edin.'); return;
            }
            state.planContext = ep[1];
            state.fps = parseFloat(ep[2]);
            state.wavPath = path.join(os.tmpdir(), 'hoodoo_audio_' + Date.now() + '_' +
                Math.random().toString(36).slice(2) + '.wav');
            var btn = $('btnAnalyze');
            if (audioSel !== 'all') {
                btn.textContent = '⏳ Ses track\'leri ayarlanıyor…';
                state.mutesApplied = true;
                evalJsx('ACS_muteForAnalysis("' + audioSel + '")', function (res) {
                    var p = res.split('|');
                    if (p[0] !== 'OK') {
                        restoreThen(function () { exportFailed('track seçimi uygulanamadı: ' + p.slice(1).join('|')); });
                        return;
                    }
                    state.mutesApplied = true;
                    if ((parseInt(p[2], 10) || 0) > 0) {
                        restoreThen(function () { exportFailed(p[2] + ' track mute edilemedi.'); });
                        return;
                    }
                    var names = audioSel.split(',').map(function (x) { return 'A' + (parseInt(x, 10) + 1); });
                    log('Analiz sesi: ' + names.join(', ') + ' (diğerleri geçici mute)');
                    exportNow(selRanges);
                });
            } else {
                exportNow(selRanges);
            }
        });
    }

    function exportNow(selRanges) {
        var btn = $('btnAnalyze');
        btn.textContent = '⏳ Ses dışa aktarılıyor…';
        var wavPath = state.wavPath;
        var t0 = Date.now();
        var script = 'ACS_exportAudio2("' + jsxEscape(wavPath) + '", "' +
            jsxEscape(PRESET_CANDIDATES.join('||')) + '")';

        evalJsx(script, function (res) {
            var p = res.split('|');
            if (p[0] === 'OK') {
                log('Ses dışa aktarıldı (' + ((Date.now() - t0) / 1000).toFixed(1) + ' sn, ' +
                    Math.round(parseInt(p[2], 10) / 1024 / 1024) + ' MB, ' + p[3] + ')');
                restoreThen(function () { verifyExportContext(wavPath, selRanges); });
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
                    restoreThen(function () { verifyExportContext(wavPath, selRanges); });
                });
            });
        });
    }

    function verifyExportContext(wavPath, selRanges) {
        evalJsx('ACS_getAnalysisContext()', function (res) {
            var p = res.split('|');
            if (p[0] !== 'OK' || p[1] !== state.planContext) {
                exportFailed('Ses aktarilirken timeline degisti. Tekrar analiz edin.');
                return;
            }
            runAnalysis(wavPath, selRanges);
        });
    }

    function runAnalysis(wavPath, selRanges) {
        if (getWorkMode() === 'tick') { runTickAnalysis(wavPath, selRanges); return; }
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
                cuts = ACSAnalyzer.alignCuts(cuts, state.fps);
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
                    $('backupRow').style.display = 'block';
                    resetCutButton();
                }
            } catch (e) {
                state.lastCuts = null;
                state.planContext = null;
                log('Analiz HATASI: ' + (e && e.message ? e.message : e));
                showResult(false, 'Analiz başarısız. Günlüğe bakın.');
            }
            resetAnalyzeButton();
        }, 50);
    }

    /* ---- tık ritmi ---- */

    function getWorkMode() {
        var radios = document.getElementsByName('workMode');
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value;
        return 'silence';
    }

    function numField(id, fallback, min) {
        var v = parseFloat($(id).value);
        return isNaN(v) || v < min ? fallback : v;
    }

    /* BPM girildiyse aralık BPM ve vuruş bölümünden hesaplanır. */
    function getTickOpts() {
        var interval = numField('tickInterval', 0.5, 0.02);
        var bpm = numField('tickBpm', 0, 0);
        if (bpm > 0) interval = ACSTickPlan.intervalFromBpm(bpm, parseFloat($('tickBeats').value) || 1);
        return { fps: state.fps, interval: interval, holdFrames: Math.round(numField('tickHold', 3, 0)),
            // Tek blok sesinin iki tepesi ~60 ms arayla gelebiliyor; 100 ms alti ikisini ayri tik sayar.
            relDb: numField('tickRel', 12, 1), minGap: Math.max(100, numField('tickMinGap', 200, 0)) / 1000,
            minSpeed: numField('tickMinSpeed', 50, 1) / 100, maxSpeed: numField('tickMaxSpeed', 400, 100) / 100,
            target: $('tickTarget').value === 'melody' ? 'melody' : 'grid', musicTrack: $('tickMusicTrack').value };
    }

    function applyWorkMode() {
        var tick = getWorkMode() === 'tick', melody = $('tickTarget').value === 'melody';
        $('tickSettings').style.display = tick ? 'block' : 'none';
        $('thresholdCard').style.display = tick ? 'none' : '';
        $('templateCard').style.display = tick ? 'none' : '';
        $('tickMusicField').style.display = melody ? '' : 'none';
        var gridFields = document.querySelectorAll('.tickGridField');
        for (var i = 0; i < gridFields.length; i++) gridFields[i].style.display = melody ? 'none' : '';
        if (!state.busy) $('btnAnalyze').textContent = tick ? '🎵 Tıkları Bul' : '🔍 Analiz Et';
    }

    function tickAnalysisFailed(e) {
        state.tickPlan = null;
        state.planContext = null;
        log('Tık analizi HATASI: ' + (e && e.message ? e.message : e));
        showResult(false, 'Tık analizi başarısız. Günlüğe bakın.');
        resetAnalyzeButton();
    }

    function runTickAnalysis(wavPath, selRanges) {
        $('btnAnalyze').textContent = '⏳ Tıklar aranıyor…';
        setTimeout(function () {
            var opts, onsets;
            try {
                opts = getTickOpts();
                onsets = ACSAnalyzer.detectOnsets(fs, wavPath, selRanges, { relDb: opts.relDb, minGap: opts.minGap });
            } catch (e) { tickAnalysisFailed(e); return; }
            if (opts.target !== 'melody') {
                try { finishTickAnalysis(onsets, ACSTickPlan.planTicks(onsets, opts), opts); }
                catch (e2) { tickAnalysisFailed(e2); }
                return;
            }
            var rs = Infinity, re = -Infinity;
            selRanges.forEach(function (r) { rs = Math.min(rs, r[0]); re = Math.max(re, r[1]); });
            exportMusic(opts.musicTrack, function (err, musicWav) {
                if (err) { tickAnalysisFailed(err); return; }
                try {
                    // Bölge en fazla 1/minSpeed kat uzayabilir; sonrasındaki notalar da gerekir.
                    // Riff: tempo ızgarasında perde değişimleri (piyano riff'i gibi melodi notaları).
                    var riff = ACSAnalyzer.detectRiffNotes(fs, musicWav, [rs, re + (re - rs) / opts.minSpeed + 5]);
                    log('Müzik melodisi: ' + riff.notes.length + ' nota, tempo ' + (riff.bpm ? riff.bpm.toFixed(1) : '?') +
                        ' BPM (A' + (parseInt(opts.musicTrack, 10) + 1) + ')' +
                        (riff.names.length ? ', ilk notalar ' + riff.names.slice(0, 6).join(' ') : ''));
                    finishTickAnalysis(onsets, ACSTickPlan.alignToNotes(onsets, riff.notes, {
                        fps: opts.fps, holdFrames: opts.holdFrames, minSpeed: opts.minSpeed,
                        maxSpeed: opts.maxSpeed, regionStart: rs }), opts);
                } catch (e3) { tickAnalysisFailed(e3); }
                try { if (fs.existsSync(musicWav)) fs.unlinkSync(musicWav); } catch (e4) {}
            });
        }, 50);
    }

    /* Melodi hedefi: yalnız müzik track'inin sesi ayrı WAV'a aktarılır (diğerleri geçici mute). */
    function exportMusic(trackIdx, cb) {
        var musicWav = state.wavPath.replace(/\.wav$/i, '') + '-muzik.wav';
        $('btnAnalyze').textContent = '⏳ Müzik notaları çıkarılıyor…';
        evalJsx('ACS_muteForAnalysis("' + trackIdx + '")', function (res) {
            var p = res.split('|');
            if (p[0] !== 'OK' || (parseInt(p[2], 10) || 0) > 0) { cb(new Error('Müzik track\'i ayarlanamadı: ' + res)); return; }
            state.mutesApplied = true;
            evalJsx('ACS_exportAudio2("' + jsxEscape(musicWav) + '", "' + jsxEscape(PRESET_CANDIDATES.join('||')) + '")', function (r2) {
                restoreThen(function () {
                    if (r2.split('|')[0] !== 'OK') { cb(new Error('Müzik dışa aktarılamadı: ' + r2)); return; }
                    cb(null, musicWav);
                });
            });
        });
    }

    function finishTickAnalysis(onsets, plan, opts) {
        state.tickPlan = plan.gaps.length ? plan : null;
        // Silinecek parçalar (hız 0) ve donan kareler hız aralığına girmez.
        var speeds = plan.gaps.filter(function (g) { return g.speed > 0 && !g.freeze; }).map(function (g) { return g.speed; });
        if (!speeds.length) speeds = [1];
        var melody = opts.target === 'melody';
        var natural = ACSTickPlan.medianInterval(onsets);
        var naturalNote = !melody && natural ? 'Doğal tık aralığı ≈ ' + natural.toFixed(2) + ' sn' +
            (natural / opts.interval > 2 || opts.interval / natural > 2
                ? ' — girilen aralık (' + opts.interval.toFixed(2) + ' sn) bundan çok farklı, hızlar sınıra takılabilir.' : '') : '';
        log('Tık analizi: ' + onsets.length + ' tık, ' + plan.merged + (melody ? ' tık düştü, ' + plan.skipped + ' nota atlandı, ' : ' birleşti, ') +
            plan.gaps.length + ' ara' + (melody ? ', hedef müzik melodisi' : ', aralık ' + opts.interval.toFixed(3) + ' sn') +
            (plan.limited ? ', ' + plan.limited + ' ara hız sınırında' : '') + (natural ? ', doğal aralık ' + natural.toFixed(3) + ' sn' : ''));
        evalJsx('ACS_setTickMarkers("' + plan.clicks.join(';') + '")', function (res) {
            if (res.split('|')[0] !== 'OK') log('Tık marker\'ları konamadı: ' + res);
        });
        if (!state.tickPlan) {
            showResult(true, 'Ritme oturtulacak en az iki tık bulunamadı (' + onsets.length + ' tık' +
                (melody ? ', notalara uyan eşleşme yok' : '') + '). Hassasiyeti artırın ya da bölgeyi genişletin.');
        } else {
            showResult(true, '<b>' + plan.clicks.length + ' tık</b> — ' + plan.gaps.length + ' ara yeniden zamanlanacak' +
                (melody ? ' (her tık bir müzik notasına)' : '') + '<br>' +
                'Hız: %' + Math.round(Math.min.apply(null, speeds) * 100) + ' – %' +
                Math.round(Math.max.apply(null, speeds) * 100) + ' · süre değişimi ' +
                (plan.deltaSec >= 0 ? '+' : '') + plan.deltaSec.toFixed(2) + ' sn<br>' +
                (melody ? (plan.merged ? plan.merged + ' fazla tık; aralarından ' + plan.cutSec.toFixed(1) + ' sn kesilecek. ' : '') +
                    (plan.freezes ? 'Uzun nota aralarında ' + plan.freezes + ' yerde görüntü donacak (toplam ' + plan.frozenSec.toFixed(1) + ' sn). ' : '') +
                    (plan.visible ? plan.visible + ' fazla tık görünür kalacak. ' : '') +
                    plan.skipped + ' nota tıksız geçti. '
                    : (plan.merged ? plan.merged + ' yakın tık öncekine katıldı. ' : '')) +
                (plan.limited ? plan.limited + ' arada hız sınırı aşıldı, fazlası kesilecek. ' : '') +
                'Tıklar timeline\'da marker olarak işaretli.' + (naturalNote ? '<br>' + naturalNote : ''));
            $('btnCut').style.display = 'block';
            $('backupRow').style.display = 'block';
            resetCutButton();
        }
        resetAnalyzeButton();
    }

    function tickApply() {
        var plan = state.tickPlan, btn = $('btnCut'), t0 = Date.now();
        state.busy = true;
        $('btnAnalyze').disabled = true;
        btn.disabled = true;
        var mutationStarted = false;
        function finish(ok, msg) {
            evalJsx('ACS_endEdit()', function () {});
            state.busy = false;
            state.tickPlan = null;
            state.planContext = null;
            $('btnAnalyze').disabled = false;
            btn.disabled = false;
            btn.style.display = 'none';
            $('backupRow').style.display = 'none';
            log(msg);
            showResult(ok, ok ? msg : 'İşlem durduruldu. Günlüğe bakın.' + (mutationStarted
                ? '<br>Timeline\'da değişiklik yapılmış olabilir; gerekirse Ctrl+Z ya da yedek sequence.'
                : '<br>Değişiklik yapılmadı. Yeniden analiz edin.'));
            resetCutButton();
        }
        function fail(msg) { finish(false, 'Tık ritmi HATASI: ' + msg); }
        function razorStep(idx) {
            if (idx >= plan.boundaries.length) { retime(); return; }
            var chunk = plan.boundaries.slice(idx, idx + CHUNK_RAZOR);
            btn.textContent = '⏳ Razor: ' + Math.min(idx + chunk.length, plan.boundaries.length) + '/' + plan.boundaries.length;
            mutationStarted = true;
            evalJsx('ACS_razorBatch("' + chunk.join(';') + '", "all")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK' || (parseInt(p[3], 10) || 0) > 0) { fail('razor: ' + p.slice(1).join('|')); return; }
                setTimeout(function () { razorStep(idx + CHUNK_RAZOR); }, 30);
            });
        }
        function retime() {
            btn.textContent = '⏳ Ritme oturtuluyor…';
            var gaps = plan.gaps.map(function (g) {
                return [g.start, g.end, g.target, g.speed].join(',') + (g.freeze ? ',f' : '');
            }).join(';');
            evalJsx('ACS_tickRetime("' + gaps + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { fail(p.slice(1).join('|')); return; }
                evalJsx('ACS_clearTickMarkers()', function () {});
                var capped = parseInt(p[4], 10) || 0, deleted = parseInt(p[5], 10) || 0;
                finish(true, 'Ritme oturtuldu: ' + plan.gaps.length + ' ara, ' + p[1] + ' hız değişimi, ' + p[2] +
                    ' taşıma' + (deleted ? ', ' + deleted + ' parça silindi' : '') +
                    ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' sn)' +
                    (capped ? '. ' + capped + ' arada Premiere hızı sınırladı; tıklar yine hedef anlarında, aranın sonu biraz kısaldı.' : ''));
            });
        }
        log('Tık ritmi başladı: ' + plan.gaps.length + ' ara, ' + plan.boundaries.length + ' razor sınırı');
        evalJsx('ACS_beginEdit("' + jsxEscape(state.planContext) + '", "tick")', function (res) {
            if (res.split('|')[0] !== 'OK') { fail(res.split('|').slice(1).join('|')); return; }
            if (!$('makeBackup').checked) { razorStep(0); return; }
            btn.textContent = '⏳ Yedek oluşturuluyor…';
            evalJsx('ACS_backupSequence()', function (r2) {
                var p2 = r2.split('|');
                if (p2[0] !== 'OK') { fail('yedek: ' + p2.slice(1).join('|')); return; }
                log('Yedek sequence oluşturuldu: "' + p2[1] + '" kopyası Project panelinde.');
                razorStep(0);
            });
        });
    }

    /* ---- kesme ---- */

    function resetCutButton() {
        state.cutArmed = false;
        $('btnCut').textContent = state.tickPlan
            ? '🎯 Ritme Oturt (' + state.tickPlan.gaps.length + ' ara)'
            : '✂️ Sessizlikleri Kes (' + (state.lastCuts ? state.lastCuts.length : 0) + ')';
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
        if (state.busy) return;
        if (!state.tickPlan && (!state.lastCuts || state.lastCuts.length === 0)) return;
        if (!state.cutArmed) {
            state.cutArmed = true;
            $('btnCut').textContent = '⚠️ Emin misiniz? Tekrar tıklayın';
            setTimeout(function () { if (state.cutArmed) resetCutButton(); }, 4000);
            return;
        }
        state.cutArmed = false;
        if (state.tickPlan) { tickApply(); return; }

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
        var useBulk = manage.indexOf('remove_') === 0 && $('deleteEngine').value === 'bulk';
        var btn = $('btnCut');
        state.busy = true;
        $('btnAnalyze').disabled = true;
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

        var mutationStarted = false;
        function cutFailed(msg) {
            evalJsx('ACS_endEdit()', function () {});
            state.busy = false;
            state.lastCuts = null;
            state.planContext = null;
            $('btnAnalyze').disabled = false;
            btn.disabled = false;
            btn.style.display = 'none';
            $('manageRow').style.display = 'none';
            $('backupRow').style.display = 'none';
            log('Kesim HATASI: ' + msg);
            showResult(false, 'İşlem durduruldu. Günlüğe bakın.' + (mutationStarted
                ? '<br>Timeline\'da değişiklik yapılmış olabilir. Gerekirse Ctrl+Z ile geri alın ' +
                  '(her parti ayrı undo adımı olabilir).'
                : '<br>Kesim başlamadı. Yeniden analiz edin.'));
            resetCutButton();
        }

        // Faz 0: yedek sequence (istenirse)
        function backupStep() {
            if (!$('makeBackup').checked) { razorStep(0); return; }
            btn.textContent = '⏳ Yedek oluşturuluyor…';
            evalJsx('ACS_backupSequence()', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') {
                    cutFailed('yedek: ' + p.slice(1).join('|'));
                    return;
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
                else prepareClipAction(manage === 'mute' ? 'mute' : 'remove');
                return;
            }
            var chunk = boundaries.slice(idx, idx + CHUNK_RAZOR);
            btn.textContent = '⏳ Razor: ' + Math.min(idx + chunk.length, boundaries.length) +
                '/' + boundaries.length;
            mutationStarted = true;
            evalJsx('ACS_razorBatch("' + chunk.join(';') + '", "' +
                (manage === 'mute' ? 'audio' : 'all') + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { cutFailed('razor: ' + p.slice(1).join('|')); return; }
                if ((parseInt(p[3], 10) || 0) > 0) {
                    cutFailed('razor: ' + p[3] + ' hata; ' + p[4]); return;
                }
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
        function prepareClipAction(action) {
            btn.textContent = '⏳ Klipler hazırlanıyor…';
            evalJsx('ACS_prepareClipAction("' + pairsStr(cuts) + '", "' + action + '")', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { cutFailed('klip hazırlığı: ' + p.slice(1).join('|')); return; }
                var total = parseInt(p[1], 10) || 0;
                log('Tek taramada hazırlanan klip: ' + total);
                if (useBulk) { bulkRemove(total); return; }
                applyClipAction(0, total, action);
            });
        }

        function bulkRemove(total) {
            evalJsx('ACS_getBulkPlan()', function (res) {
                if (res.indexOf('OK|') !== 0) { cutFailed(res); return; }
                try {
                    var lines = res.split('\n'), header = lines.shift().split('|');
                    var plan = { projectPath: decodeURIComponent(header[1]), sequenceID: decodeURIComponent(header[2]),
                        targets: lines.filter(function (line) { return line.length > 0; }).map(function (line) {
                            var fields = line.split(','), n = fields.slice(0, 6).map(Number);
                            return { g: n[0], t: n[1], s: n[2], e: n[3], inPoint: n[4], outPoint: n[5],
                                mediaPath: decodeURIComponent(fields[6]), sourceName: decodeURIComponent(fields[7]) };
                        }) };
                    if (plan.targets.length !== total) throw new Error('Toplu plan sayısı uyuşmuyor');
                    // Boşluk kapatma: motor aynı native işlemde ripple yapıp konumları doğrular.
                    if (manage === 'remove_close') {
                        plan.ripple = true;
                        plan.cuts = cuts.map(function (c) { return { start: c.start, end: c.end }; });
                    }
                    btn.textContent = '⏳ Toplu silme: ' + total + ' klip…';
                    log('Toplu UXP silme: tüm video/ses hedefleri tek işlemde, undo korunuyor.');
                    bulkBridge.submit(plan, function (err, result) {
                        if (err) { cutFailed(String(err)); return; }
                        if (!result || result.removed !== total || !Array.isArray(result.timings) ||
                            !isFinite(result.prepareMs) || !isFinite(result.commitMs)) {
                            cutFailed('Toplu motor sonucu uyuşmuyor'); return;
                        }
                        prog.removed = result.removed;
                        result.timings.forEach(function (timing) {
                            log('UXP ' + timing.track + ' tarama: ' + timing.scanMs + ' ms');
                        });
                        log('UXP hazırlık: ' + result.prepareMs + ' ms | native silme: ' + result.commitMs + ' ms');
                        if (manage === 'remove_close' && result.rippled === true) {
                            prog.rippled = true;
                            log('Ripple: boşluklar aynı işlemde kapandı, ' + result.verified +
                                ' klibin konumu doğrulandı (' + phaseElapsed() + ')');
                            done();
                            return;
                        }
                        if (manage === 'remove_close') log('Not: toplu motor ripple desteklemiyor; klasik boşluk kapatma kullanılıyor.');
                        applyClipAction(total, total, 'remove');
                    });
                } catch (err) { cutFailed(String(err)); }
            });
        }

        function applyClipAction(from, total, action) {
            if (from >= total) {
                if (action === 'mute') log('Susturma bitti: ' + prog.muted + ' ses klibi (' + phaseElapsed() + ')');
                else log('Silme bitti: ' + prog.removed + ' klip silindi (' + phaseElapsed() + ')');
                if (manage === 'remove_close') compactStep();
                else done();
                return;
            }
            btn.textContent = '⏳ ' + (action === 'mute' ? 'Susturma' : 'Silme') + ': ' + from + '/' + total;
            var batchStarted = Date.now();
            evalJsx('ACS_applyClipAction(' + from + ', ' + CHUNK_REMOVE + ')', function (res) {
                var p = res.split('|');
                if (p[0] !== 'OK') { cutFailed('klip işlemi: ' + p.slice(1).join('|')); return; }
                var processed = parseInt(p[1], 10) || 0;
                if (processed <= 0) { cutFailed('klip partisi ilerlemedi'); return; }
                if (action === 'mute') prog.muted += parseInt(p[2], 10) || 0;
                else prog.removed += parseInt(p[2], 10) || 0;
                log('CEP parti ' + (from + 1) + '–' + (from + processed) + ': ' +
                    (Date.now() - batchStarted) + ' ms');
                setTimeout(function () { applyClipAction(from + processed, total, action); }, 30);
            });
        }

        // Faz 2b: susturma (ses kliplerini devre dışı bırak, hiçbir şey kaymaz)

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
                    cutFailed('kompaksiyon hazırlığı: ' + p.slice(1).join('|'));
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
                    cutFailed('kompaksiyon: ' + p.slice(1).join('|'));
                    return;
                }
                var processed = parseInt(p[1], 10) || 0;
                prog.compacted += parseInt(p[2], 10) || 0;
                total = parseInt(p[3], 10) || total;
                prog.compactErr += parseInt(p[4], 10) || 0;
                if (prog.compactErr || processed <= 0) {
                    cutFailed('kompaksiyon: ' + (p[5] || 'parti ilerlemedi')); return;
                }
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
            evalJsx('ACS_endEdit()', function () {});
            state.busy = false;
            state.lastCuts = null;
            state.planContext = null;
            $('btnAnalyze').disabled = false;
            btn.disabled = false;
            var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            var summary = 'razor=' + prog.razored;
            if (manage === 'remove_close' || manage === 'remove_keep') {
                summary += ' | silinen=' + prog.removed;
            }
            if (manage === 'remove_close' && prog.rippled) {
                summary += ' | boşluklar=ripple';
            } else if (manage === 'remove_close') {
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
            $('backupRow').style.display = 'none';
        }

        function beginEdit() {
            evalJsx('ACS_beginEdit("' + jsxEscape(state.planContext) + '", "' + manage + '")', function (res) {
            if (res.split('|')[0] !== 'OK') { cutFailed(res.split('|').slice(1).join('|')); return; }
            backupStep();
            });
        }
        if (useBulk) {
            if (!bulkBridge || !bulkBridge.ready()) {
                cutFailed('Toplu motor bağlı değil. Plugins menüsünden HooDoo Cut Toplu Motor panelini açın.');
                return;
            }
            evalJsx('ACS_getBulkIdentity()', function (res) {
                var p = res.split('|'), context = bulkBridge.context();
                if (p[0] !== 'OK' || decodeURIComponent(p[1]) !== context.projectPath ||
                    decodeURIComponent(p[2]).replace(/[{}]/g, '').toLowerCase() !== context.sequenceID) {
                    cutFailed('Toplu motor farklı proje/sequence görüyor. Panel bağlantısını bekleyip yeniden analiz edin.');
                    return;
                }
                beginEdit();
            });
        } else beginEdit();
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

    /* ---- UI bağlantıları ---- */

    $('btnAnalyze').addEventListener('click', analyze);
    $('btnCut').addEventListener('click', cut);
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
    // Çalışma modu: sessizlik kesme / tık ritmi
    var workModes = document.getElementsByName('workMode');
    for (var w = 0; w < workModes.length; w++) workModes[w].addEventListener('change', applyWorkMode);
    $('tickTarget').addEventListener('change', applyWorkMode);
    applyWorkMode();

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

    /* ---- güncelleme kontrolü + otomatik kurulum ---- */
    function setUpdateBar(html) { var b = $('updateBar'); b.innerHTML = html; b.style.display = 'flex'; }

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
                setUpdateBar('🔔 Yeni sürüm: <b>v' + info.latest + '</b> (sen: v' + ACS_VERSION +
                    ') <button id="btnUpdate">Güncelle</button>');
                $('btnUpdate').addEventListener('click', function () { startSelfUpdate(info); });
            } else {
                log('Sürüm güncel: v' + ACS_VERSION);
            }
        });
    }

    /* PowerShell string literal (tek tırnak, içteki tırnağı kaçır) */
    function psStr(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

    /* indir + çıkar + kurulum klasörünü güncelle (PowerShell) */
    function updaterScript(zipUrl, installDir) {
        return [
            '$ErrorActionPreference = "Stop"',
            '$url = ' + psStr(zipUrl),
            '$dst = ' + psStr(installDir),
            '[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12',
            '$tmp = Join-Path $env:TEMP ("hoodoo_upd_" + [guid]::NewGuid().ToString("N"))',
            'New-Item -ItemType Directory -Force $tmp | Out-Null',
            '$zip = Join-Path $tmp "pkg.zip"',
            'Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing',
            'Expand-Archive -Path $zip -DestinationPath $tmp -Force',
            '$srcExt = Join-Path $tmp "com.hoodoocut"',
            'if (-not (Test-Path $srcExt)) { throw "pakette com.hoodoocut yok" }',
            'Copy-Item -Path (Join-Path $srcExt "*") -Destination $dst -Recurse -Force',
            'Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue',
            'Write-Output "DONE"'
        ].join("\r\n");
    }

    function startSelfUpdate(info) {
        if (!info.zip) { // otomatik kurulum paketi yok → sayfayı aç
            log('Otomatik kurulum paketi (zip) bulunamadı; indirme sayfası açılıyor.');
            csInterface.openURLInDefaultBrowser(info.page);
            return;
        }
        if (!fs || !nodeRequire) { csInterface.openURLInDefaultBrowser(info.page); return; }

        var installDir = csInterface.getSystemPath(SystemPath.EXTENSION);
        // Geliştirme koruması: kurulum yolu junction ise (dev) otomatik güncelleme yapma
        var isLink = false;
        try { fs.readlinkSync(installDir); isLink = true; } catch (e) {}
        if (isLink) {
            log('Geliştirme modu (junction) — otomatik güncelleme atlandı. "git pull" kullan.');
            setUpdateBar('🔧 Geliştirme modu (junction): otomatik güncelleme kapalı.');
            return;
        }
        var cp;
        try { cp = nodeRequire('child_process'); } catch (e) {
            csInterface.openURLInDefaultBrowser(info.page); return;
        }

        setUpdateBar('⏳ Güncelleniyor… v' + info.latest + ' indiriliyor');
        log('Otomatik güncelleme başladı (' + info.zip + ')');

        var psPath = path.join(os.tmpdir(), 'hoodoo_update.ps1');
        try { fs.writeFileSync(psPath, updaterScript(info.zip, installDir), 'utf8'); }
        catch (e) { log('Güncelleyici yazılamadı: ' + e.message); setUpdateBar('⚠️ Güncelleme başarısız.'); return; }

        var cmd = 'powershell -ExecutionPolicy Bypass -NoProfile -File "' + psPath + '"';
        cp.exec(cmd, { timeout: 180000, windowsHide: true }, function (err, stdout, stderr) {
            if (err) {
                log('Güncelleme HATASI: ' + (((stderr || '') + '').trim() || err.message));
                setUpdateBar('⚠️ Güncelleme başarısız — <button id="btnUpd2">sayfayı aç</button>');
                var b = $('btnUpd2');
                if (b) b.addEventListener('click', function () { csInterface.openURLInDefaultBrowser(info.page); });
                return;
            }
            log('Güncelleme tamamlandı: v' + info.latest + ' kuruldu.');
            setUpdateBar('✅ v' + info.latest + ' kuruldu — Premiere\'i yeniden başlatın.');
        });
    }

    /* ---- başlangıç ---- */

    if (nodeRequire) {
        try {
            bulkBridge = nodeRequire(extPath + '/client/js/bulk-bridge.js')(51373, function (err) {
                log('Toplu motor köprüsü açılamadı: ' + String(err));
            });
            window.addEventListener('unload', function () { bulkBridge.close(); });
        } catch (err) { log('Toplu motor yüklenemedi: ' + String(err)); }
    }

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
})();
