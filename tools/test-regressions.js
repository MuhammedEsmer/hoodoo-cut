'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fixture } = require('./host-fixture');
const analyzer = require('../com.hoodoocut/client/js/analyzer');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
function stereoWav(inverse, silentRight) {
    const rate = 48000, frames = rate * 2, b = Buffer.alloc(44 + frames * 4);
    b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
    b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28);
    b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(frames * 4, 40);
    for (let i = 0; i < frames; i++) {
        const value = Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 13000);
        b.writeInt16LE(value, 44 + i * 4);
        b.writeInt16LE(silentRight ? 0 : (inverse ? -value : value), 46 + i * 4);
    }
    return b;
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hoodoo-regression-'));
try {
    test('stereo opposite phase preserves audible speech', () => {
        const p = path.join(temp, 'stereo.wav'); fs.writeFileSync(p, stereoWav(true));
        assert.strictEqual(analyzer.analyzeFile(fs, p, 'olculu', { thresholdDb: -40 }).cuts.length, 0);
    });
    test('single active stereo channel retains its level', () => {
        const a = path.join(temp, 'both.wav'), b = path.join(temp, 'left.wav');
        fs.writeFileSync(a, stereoWav(false)); fs.writeFileSync(b, stereoWav(false, true));
        const both = analyzer.computeWindowDb(fs, a, 20, { hpHz: 120, lpHz: 5000 });
        const left = analyzer.computeWindowDb(fs, b, 20, { hpHz: 120, lpHz: 5000 });
        assert(Math.abs(both.db[20] - left.db[20]) < 0.01);
    });
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
test('remove never consumes adjacent speech frames', () => {
    const { host, stats } = fixture([[28 / 30, 1], [1, 2], [2, 62 / 30]]);
    assert.strictEqual(host.ACS_removeBatch('1,2'), 'OK|2');
    assert.strictEqual(stats.removed, 2);
});
test('mute never disables adjacent speech frames', () => {
    const { host, seq } = fixture([[28 / 30, 1], [1, 2], [2, 62 / 30]]);
    assert.strictEqual(host.ACS_muteBatch('1,2'), 'OK|1');
    assert.strictEqual(seq.audioTracks[0].items[0].disabled, false);
    assert.strictEqual(seq.audioTracks[0].items[2].disabled, false);
});
test('analysis context rejects same-name different sequence and clip movement', () => {
    const { host, seq } = fixture([[0, 1], [1, 2]]);
    const original = host.ACS_getAnalysisContext().split('|')[1];
    seq.sequenceID = 'sequence-2';
    assert(host.ACS_beginEdit(original).startsWith('ERR|'));
    seq.sequenceID = 'sequence-1'; seq.audioTracks[0].items[0].move(1);
    assert(host.ACS_beginEdit(original).startsWith('ERR|'));
});
test('prepared deletion scans once and deletes stable references in chunks', () => {
    const { host, stats } = fixture([[0, 1], [1, 2], [2, 3], [3, 4]]);
    assert.strictEqual(host.ACS_prepareClipAction('1,2;3,4', 'remove'), 'OK|4');
    const reads = stats.reads;
    assert.strictEqual(host.ACS_applyClipAction(0, 2), 'OK|2|2|4');
    assert.strictEqual(host.ACS_applyClipAction(2, 2), 'OK|2|2|4');
    assert.strictEqual(stats.reads - reads, 8); // verify only the four targets
    assert.strictEqual(stats.removed, 4);
});
test('failed deletion is reported and later targets remain intact', () => {
    const { host, seq } = fixture([[1, 2], [3, 4]], 0, 1);
    seq.audioTracks[0].items[1].failRemove = true;
    host.ACS_prepareClipAction('1,2;3,4', 'remove');
    assert(host.ACS_applyClipAction(0, 2).startsWith('ERR|'));
    assert.strictEqual(seq.audioTracks[0].items.length, 2);
});
test('Premiere boolean true deletion result completes every target and chunk', () => {
    const { host, seq, stats } = fixture([[1, 2], [3, 4]], 0, 1);
    for (const item of seq.audioTracks[0].items) {
        const remove = item.remove;
        item.remove = function () { remove(); return true; };
    }
    assert.strictEqual(host.ACS_prepareClipAction('1,2;3,4', 'remove'), 'OK|2');
    assert.strictEqual(host.ACS_applyClipAction(0, 1), 'OK|1|1|2');
    assert.strictEqual(host.ACS_applyClipAction(1, 1), 'OK|1|1|2');
    assert.strictEqual(stats.removed, 2);
});
test('boolean false deletion result stops before later targets', () => {
    const { host, seq, stats } = fixture([[1, 2], [3, 4]], 0, 1);
    seq.audioTracks[0].items[1].remove = () => false;
    host.ACS_prepareClipAction('1,2;3,4', 'remove');
    assert(host.ACS_applyClipAction(0, 2).startsWith('ERR|'));
    assert.strictEqual(stats.removed, 0);
});
test('sequence switch cancels a prepared action before mutation', () => {
    const { host, seq, stats } = fixture([[1, 2]]);
    const sig = host.ACS_getAnalysisContext().split('|')[1];
    assert.strictEqual(host.ACS_beginEdit(sig), 'OK');
    host.ACS_prepareClipAction('1,2', 'remove');
    host.app.project.activeSequence = Object.assign({}, seq, { sequenceID: 'other' });
    assert(host.ACS_applyClipAction(0, 2).startsWith('ERR|'));
    assert.strictEqual(stats.removed, 0);
});
test('frame alignment preserves speech at integer and fractional frame rates', () => {
    for (const fps of [24, 25, 30, 60, 24000 / 1001, 30000 / 1001]) {
        const cuts = analyzer.alignCuts([{ start: 1.013, end: 2.027 }, { start: 2.027, end: 2.04 }], fps);
        assert(cuts.length > 0);
        assert(cuts[0].start >= 1.013 - 1e-9);
        assert(cuts[0].end <= 2.04 + 1e-9);
        for (const cut of cuts) {
            assert(Math.abs(cut.start * fps - Math.round(cut.start * fps)) < 1e-8);
            assert(Math.abs(cut.end * fps - Math.round(cut.end * fps)) < 1e-8);
        }
    }
    assert.strictEqual(analyzer.alignCuts([{ start: 1.01, end: 1.02 }], 30).length, 0);
});
test('compaction stops when the active sequence changes', () => {
    const { host, seq } = fixture([[2, 3]]);
    host.ACS_beginEdit(host.ACS_getAnalysisContext().split('|')[1]);
    host.ACS_compactPrepare('1,2', 'floor');
    host.app.project.activeSequence = Object.assign({}, seq, { sequenceID: 'other' });
    assert(host.ACS_compactApply(0, 60).startsWith('ERR|'));
    assert.strictEqual(seq.videoTracks[0].items[0].start.seconds, 2);
});
test('compaction reports a move that silently fails', () => {
    const { host, seq } = fixture([[2, 3]], 0, 1);
    seq.audioTracks[0].items[0].move = () => {};
    host.ACS_compactPrepare('1,2', 'floor');
    assert(host.ACS_compactApply(0, 60).startsWith('ERR|'));
});
test('mute restore targets the original tracks after a sequence switch', () => {
    const { host, seq } = fixture([[0, 1]], 0, 2);
    host.ACS_muteForAnalysis('0');
    assert.strictEqual(seq.audioTracks[1].isMuted(), true);
    const other = fixture([[0, 1]], 0, 2).seq;
    other.audioTracks[1].setMute(1);
    host.app.project.activeSequence = other;
    assert(host.ACS_restoreMutes().startsWith('OK|'));
    assert.strictEqual(seq.audioTracks[1].isMuted(), false);
    assert.strictEqual(other.audioTracks[1].isMuted(), true);
});
test('failed mute restoration is reported and can be retried', () => {
    const { host, seq } = fixture([[0, 1]], 0, 2);
    host.ACS_muteForAnalysis('0');
    const tr = seq.audioTracks[1], setter = tr.setMute;
    tr.setMute = () => {};
    assert(host.ACS_restoreMutes().startsWith('ERR|'));
    tr.setMute = setter;
    assert(host.ACS_restoreMutes().startsWith('OK|'));
    assert.strictEqual(tr.isMuted(), false);
});
test('unfinished WAV export is rejected instead of analyzed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoodoo-truncated-'));
    try {
        const p = path.join(dir, 'partial.wav'); fs.writeFileSync(p, stereoWav(false).subarray(0, 144));
        assert.throws(() => analyzer.analyzeFile(fs, p, 'olculu'), /WAV/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('backup clone failure never reports success', () => {
    const { host, seq } = fixture([[0, 1]]); seq.clone = () => false;
    assert(host.ACS_backupSequence().startsWith('ERR|'));
});
test('same-name backup reopens the original sequence by identity', () => {
    const { host, seq } = fixture([[0, 1]]);
    seq.clone = () => { host.app.project.activeSequence = { name: seq.name, sequenceID: 'clone' }; return true; };
    host.app.project.openSequence = id => { assert.strictEqual(id, seq.sequenceID); host.app.project.activeSequence = seq; };
    assert(host.ACS_backupSequence().startsWith('OK|'));
    assert.strictEqual(host.app.project.activeSequence, seq);
});
test('locked populated track stops editing before razor', () => {
    const { host, seq } = fixture([[0, 1]]);
    seq.videoTracks[0].isLocked = () => true;
    assert(host.ACS_beginEdit(host.ACS_getAnalysisContext().split('|')[1], 'remove_close').startsWith('ERR|'));
});
test('per-track razor errors stop the host batch immediately', () => {
    const { host, seq } = fixture([[0, 3]], 0, 1);
    let calls = 0;
    host.app.enableQE = () => {};
    host.Time = function () { this.seconds = 0; this.ticks = '0'; };
    seq.setPlayerPosition = () => {};
    host.qe = { project: { getActiveSequence: () => ({ CTI: { timecode: '00:00:01:00' },
        getAudioTrackAt: () => ({ razor() { calls++; throw new Error('razor failed'); } }) }) } };
    assert(host.ACS_razorBatch('1;2', 'audio').startsWith('ERR|'));
    assert.strictEqual(calls, 1);
});
test('host avoids ES3 reserved words as property names (ExtendScript rejects the whole file)', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../com.hoodoocut/host/index.jsx'), 'utf8');
    const words = 'abstract|boolean|byte|char|class|const|debugger|double|enum|export|extends|final|float|goto|' +
        'implements|import|int|interface|long|native|package|private|protected|public|short|static|super|' +
        'synchronized|throws|transient|volatile';
    const hits = src.split('\n').map((line, i) => [i + 1, line])
        .filter(([, line]) => new RegExp('\\.(' + words + ')\\b|(^|[{,])\\s*(' + words + ')\\s*:').test(line));
    assert.deepStrictEqual(hits, []);
});
test('razor seeks to exact frame ticks so non-integer fps cannot land one frame early', () => {
    const { host, seq } = fixture([[0, 3]], 1, 1);
    const positions = [];
    host.app.enableQE = () => {};
    // Float seconds -> ticks conversion that rounds just below the frame boundary.
    host.Time = function () { this.seconds = 0; Object.defineProperty(this, 'ticks',
        { get: () => String(Math.floor(this.seconds * 254016000000) - 1) }); };
    seq.setPlayerPosition = ticks => positions.push(ticks);
    host.qe = { project: { getActiveSequence: () => ({ CTI: { timecode: 'display-mismatch' }, razor() {} }) } };
    assert(host.ACS_razorBatch('1;2', 'all').startsWith('OK|'));
    const frameTicks = parseFloat(seq.timebase);
    assert.deepStrictEqual(positions, [String(30 * frameTicks), String(30 * frameTicks), String(60 * frameTicks)]);
});
test('compaction preparation reports unreadable clip timing', () => {
    const { host, seq } = fixture([[2, 3]], 0, 1);
    seq.audioTracks[0].items[0] = { get start() { throw new Error('timing unavailable'); } };
    assert(host.ACS_compactPrepare('1,2', 'floor').startsWith('ERR|'));
});
test('float WAV rejects non-finite samples', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoodoo-float-'));
    try {
        const p = path.join(dir, 'nan.wav'), b = stereoWav(false);
        b.writeUInt16LE(3, 20); b.writeUInt16LE(32, 34); b.writeUInt16LE(8, 32);
        b.writeUInt32LE(384000, 28); b.writeFloatLE(NaN, 44); fs.writeFileSync(p, b);
        assert.throws(() => analyzer.analyzeFile(fs, p, 'olculu'), /WAV/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('unreadable mute state cannot falsely complete recovery', () => {
    const { host, seq } = fixture([[0, 1]], 0, 2);
    host.ACS_muteForAnalysis('0');
    const tr = seq.audioTracks[1], getter = tr.isMuted;
    tr.isMuted = () => { throw new Error('state unavailable'); };
    assert(host.ACS_restoreMutes().startsWith('ERR|'));
    tr.isMuted = getter;
    assert(host.ACS_restoreMutes().startsWith('OK|'));
    assert.strictEqual(tr.isMuted(), false);
});
test('QE lock state is required when the DOM omits isLocked', () => {
    const { host, seq } = fixture([[0, 1]]);
    delete seq.videoTracks[0].isLocked;
    host.app.enableQE = () => {};
    host.qe = { project: { getActiveSequence: () => ({ getVideoTrackAt: () => ({ isLocked: () => true }) }) } };
    const res = host.ACS_getAnalysisContext(); assert(res.startsWith('OK|'));
    assert(host.ACS_beginEdit(res.split('|')[1], 'remove_close').startsWith('ERR|'));
    delete host.qe;
    assert(host.ACS_getAnalysisContext().startsWith('ERR|'));
});
process.exitCode = failed ? 1 : 0;
