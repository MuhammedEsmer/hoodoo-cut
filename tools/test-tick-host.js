/*
 * Tık ritmi host düzenlemesi (ACS_tickRetime) — Premiere olmadan.
 * Razor sonrası parçalar: [0,1.1] (tık1 + parçası), ara1 [1.1,1.8] (kısalır),
 * [1.8,1.9] (tık2 parçası), ara2 [1.9,2.2] (uzar), kuyruk [2.2,3]. 30 fps.
 */
'use strict';
const assert = require('assert');
const { fixture } = require('./host-fixture');
const TICKS = 254016000000;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
const PIECES = [[0, 1.1], [1.1, 1.8], [1.8, 1.9], [1.9, 2.2], [2.2, 3]];
const GAPS = '1.1,1.8,0.4,1.75;1.9,2.2,0.4,0.75';

function setup(speedCap) {
    const f = fixture(PIECES, 1, 2);
    const tracks = [f.seq.videoTracks[0], f.seq.audioTracks[0], f.seq.audioTracks[1]];
    const log = [];
    function checkTrack(track, label) {
        const list = track.items.map(it => [it.start.seconds, it.end.seconds]).sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < list.length; i++) {
            if (list[i - 1][1] > list[i][0] + 1e-6) throw new Error('cakisma (' + label + '): ' + JSON.stringify(list));
        }
    }
    tracks.forEach((track, ti) => track.items.forEach(item => {
        let s = item.start.seconds, e = item.end.seconds, speed = 1;
        Object.defineProperty(item, 'start', { get: () => ({ seconds: s }), configurable: true });
        Object.defineProperty(item, 'end', { get: () => ({ seconds: e }), configurable: true,
            set: t => { e = parseFloat(t.ticks) / TICKS; log.push('end'); checkTrack(track, 'end'); } });
        item.move = d => { s += d; e += d; log.push('move'); checkTrack(track, 'move'); };
        item.getSpeed = () => speed;
        item.isSpeedReversed = () => false;
        // Canlı: Premiere yüksek hızları sessizce sınırlıyor (ör. 3.64 -> 3.2773); süre değişmiyor.
        item.__setSpeed = v => { speed = speedCap ? Math.min(v, speedCap[ti]) : v; log.push('speed'); };
    }));
    f.host.Time = function () { this.ticks = '0'; };
    f.host.app.enableQE = () => {};
    const qeTrack = track => ({ get numItems() { return track.items.length; },
        getItemAt: k => ({ type: 'Clip', start: { secs: track.items[k].start.seconds },
            setSpeed: v => { track.items[k].__setSpeed(v); return true; } }) });
    f.host.qe = { project: { getActiveSequence: () => ({
        getVideoTrackAt: i => qeTrack(f.seq.videoTracks[i]), getAudioTrackAt: i => qeTrack(f.seq.audioTracks[i]) }) } };
    return { f, tracks, log };
}
const layout = track => track.items.map(it => [+it.start.seconds.toFixed(4), +it.end.seconds.toFixed(4), it.getSpeed()])
    .sort((a, b) => a[0] - b[0]);

test('retimes gaps on every track without overlaps and lands clicks on the grid', () => {
    const { f, tracks } = setup();
    const res = f.host.ACS_tickRetime(GAPS);
    assert(res.startsWith('OK|'), res);
    const want = [[0, 1.1, 1], [1.1, 1.5, 1.75], [1.5, 1.6, 1], [1.6, 2, 0.75], [2, 2.8, 1]];
    tracks.forEach(track => assert.deepStrictEqual(layout(track), want));
});
test('shrinking pieces are trimmed before their speed changes', () => {
    const { f, log } = setup();
    f.host.ACS_tickRetime(GAPS);
    // İlk iki işlem V1 ara1: önce end, sonra hız.
    assert.deepStrictEqual(log.slice(0, 2), ['end', 'speed']);
});
test('a piece that does not match razor boundaries stops before any edit', () => {
    const { f, log } = setup();
    const res = f.host.ACS_tickRetime('1.15,1.8,0.4,1.625');
    assert(/razor/i.test(res), res);
    assert.strictEqual(log.length, 0);
});
test('a speed Premiere caps below the plan keeps the grid and is reported, not failed', () => {
    const { f, tracks } = setup([1.6, 1.6, 1.6]);
    const res = f.host.ACS_tickRetime(GAPS);
    assert(res.startsWith('OK|'), res);
    assert.strictEqual(res.split('|')[4], '1'); // ara1 (1.75 istendi) sınırlandı
    assert.deepStrictEqual(layout(tracks[0]).map(r => r.slice(0, 2)), [[0, 1.1], [1.1, 1.5], [1.5, 1.6], [1.6, 2], [2, 2.8]]);
});
test('a gap capped to different speeds on different tracks is a sync error', () => {
    const { f } = setup([1.6, 1.6, 1.4]);
    assert(/senkron/i.test(f.host.ACS_tickRetime(GAPS)));
});
test('locked tracks (e.g. music) are left untouched by the retime', () => {
    const { f, tracks } = setup();
    tracks[2].isLocked = () => true; // A2 = kilitli müzik track'i
    const before = layout(tracks[2]);
    const res = f.host.ACS_tickRetime(GAPS);
    assert(res.startsWith('OK|'), res);
    assert.deepStrictEqual(layout(tracks[2]), before);
    assert.deepStrictEqual(layout(tracks[0]), [[0, 1.1, 1], [1.1, 1.5, 1.75], [1.5, 1.6, 1], [1.6, 2, 0.75], [2, 2.8, 1]]);
});
test('tick edit session accepts locked tracks; other modes still refuse them', () => {
    const { f, tracks } = setup();
    tracks[2].isLocked = () => true;
    const ctx = f.host.ACS_getAnalysisContext().split('|')[1];
    assert.strictEqual(f.host.ACS_beginEdit(ctx, 'tick'), 'OK');
    assert(f.host.ACS_beginEdit(ctx, 'remove_close').startsWith('ERR|'));
});
test('a zero-target gap deletes that piece on every track and closes up the rest', () => {
    const { f, tracks } = setup();
    const res = f.host.ACS_tickRetime('1.1,1.8,0,0');
    assert(res.startsWith('OK|'), res);
    const want = [[0, 1.1, 1], [1.1, 1.2, 1], [1.2, 1.5, 1], [1.5, 2.3, 1]];
    tracks.forEach(track => assert.deepStrictEqual(layout(track), want));
});
test('a freeze gap slows the video piece and removes its audio (no stretched sound)', () => {
    const { f, tracks } = setup();
    const res = f.host.ACS_tickRetime('1.8,1.9,0.5,0.2,f');
    assert(res.startsWith('OK|'), res);
    assert.deepStrictEqual(layout(tracks[0]), [[0, 1.1, 1], [1.1, 1.8, 1], [1.8, 2.3, 0.2], [2.3, 2.6, 1], [2.6, 3.4, 1]]);
    [tracks[1], tracks[2]].forEach(track =>
        assert.deepStrictEqual(layout(track), [[0, 1.1, 1], [1.1, 1.8, 1], [2.3, 2.6, 1], [2.6, 3.4, 1]]));
    assert(f.host.ACS_tickRetime('1.8,1.9,0.5,0.2,x').startsWith('ERR|'));
});
test('invalid gap data is rejected', () => {
    const { f } = setup();
    assert(f.host.ACS_tickRetime('1.8,1.1,0.4,1').startsWith('ERR|'));
    assert(f.host.ACS_tickRetime('').startsWith('ERR|'));
});
function markerSetup() {
    const f = fixture([[0, 3]]);
    const list = [{ name: 'kullanici', start: 0.5 }];
    f.seq.markers = {
        getFirstMarker: () => list[0],
        getNextMarker: m => list[list.indexOf(m) + 1],
        createMarker: s => { const m = { name: '', start: s }; list.push(m); return m; },
        deleteMarker: m => { list.splice(list.indexOf(m), 1); }
    };
    return { f, list };
}
test('tick markers replace previous HooDoo markers and keep user markers', () => {
    const { f, list } = markerSetup();
    assert.strictEqual(f.host.ACS_setTickMarkers('1;1.5'), 'OK|2');
    assert.strictEqual(f.host.ACS_setTickMarkers('2;2.5;3'), 'OK|3');
    assert.deepStrictEqual(list.map(m => [m.name, m.start]),
        [['kullanici', 0.5], ['HooDoo tik', 2], ['HooDoo tik', 2.5], ['HooDoo tik', 3]]);
    assert.strictEqual(f.host.ACS_clearTickMarkers(), 'OK|3');
    assert.deepStrictEqual(list.map(m => m.name), ['kullanici']);
});
if (failed) process.exitCode = 1;
