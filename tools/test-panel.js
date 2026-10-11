'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const { fixture } = require('./host-fixture');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
function panel(responses = {}, manage = 'remove_keep') {
    const { host } = fixture([[1, 2]]);
    const signature = host.ACS_getAnalysisContext ? host.ACS_getAnalysisContext().split('|')[1] : 'context';
    const elements = {}, calls = [], timers = [];
    function element(id) {
        return elements[id] || (elements[id] = { style: {}, textContent: '', innerHTML: '', value: '300',
            checked: false, disabled: false, addEventListener() {}, querySelectorAll: () => [] });
    }
    const document = { getElementById: element, querySelectorAll: () => [],
        getElementsByName: name => name === 'manage' ? [{ checked: true, value: manage }] : [] };
    element('makeBackup');
    function CSInterface() {}
    CSInterface.prototype.getSystemPath = () => path.resolve(__dirname, '../com.hoodoocut');
    CSInterface.prototype.evalScript = (script, cb) => {
        const name = script.slice(0, script.indexOf('(')); calls.push(name);
        if (Object.prototype.hasOwnProperty.call(responses, name)) {
            cb(typeof responses[name] === 'function' ? responses[name](script, host) : responses[name]);
        }
        else if (name === 'ACS_razorBatch') cb('OK|2|0|0||floor seqrazor');
        else if (name === 'ACS_backupSequence') cb('OK|Test');
        else cb(vm.runInContext(script, host));
    };
    const context = vm.createContext({ CSInterface, SystemPath: { EXTENSION: 'extension' }, require,
        document, setTimeout: (fn, ms) => { timers.push({ fn, ms }); }, clearTimeout() {},
        Date, console, ACSAnalyzer: require('../com.hoodoocut/client/js/analyzer') });
    // Expose the closure only in the test VM; skip startup network/connection effects.
    const source = fs.readFileSync(path.join(__dirname, '../com.hoodoocut/client/js/main.js'), 'utf8')
        .replace('    /* ---- başlangıç ---- */',
            '    this.panelTest = { cut: cut, analyze: analyze, doExport: doExport, restoreThen: restoreThen, state: state, setBulkBridge: function (bridge) { bulkBridge = bridge; } }; return;');
    // IIFE is strict; use the VM global instead of its undefined `this`.
    vm.runInContext(source.replace('this.panelTest =', 'globalThis.panelTest ='), context);
    context.panelTest.state.lastCuts = [{ start: 1, end: 2 }];
    context.panelTest.state.planContext = signature;
    function start() { context.panelTest.cut(); context.panelTest.cut(); }
    function drain() {
        let guard = 200;
        while (timers.some(t => t.ms < 1000) && guard-- > 0) {
            const i = timers.findIndex(t => t.ms < 1000); timers.splice(i, 1)[0].fn();
        }
        assert(guard > 0, 'panel job must terminate');
    }
    return { api: context.panelTest, elements, calls, start, drain, element };
}
test('missing bulk engine stops before razor', () => {
    const p = panel(); p.element('deleteEngine').value = 'bulk'; p.start(); p.drain();
    assert(!p.calls.includes('ACS_razorBatch'));
    assert(p.elements.log.textContent.includes('Toplu motor bağlı değil'));
});

test('bulk path submits mixed targets without individual CEP deletion', () => {
    let submitted;
    const p = panel({ ACS_getBulkIdentity: 'OK|C%3A%5Ctest.prproj|sequence-1',
        ACS_getBulkPlan: 'OK|C%3A%5Ctest.prproj|sequence-1\n0,0,1,2,1,2,source.wav,\n1,0,1,2,1,2,source.wav,' });
    p.element('deleteEngine').value = 'bulk';
    p.api.setBulkBridge({ ready: () => true, context: () => ({ projectPath: 'C:\\test.prproj', sequenceID: 'sequence-1' }),
        submit: (plan, cb) => { submitted = plan; cb(null, { removed: 2, prepareMs: 3, commitMs: 4, timings: [] }); } });
    p.start(); p.drain();
    assert.strictEqual(submitted.targets.length, 2);
    assert(!p.calls.includes('ACS_applyClipAction'));
    assert(p.elements.log.textContent.includes('İşlem tamamlandı'));
});

test('stale analysis stops before backup and razor', () => {
    const p = panel({ ACS_beginEdit: 'ERR|Timeline degisti' }); p.start(); p.drain();
    assert(!p.calls.includes('ACS_razorBatch'));
    assert(!p.elements.log.textContent.includes('İşlem tamamlandı'));
    assert(p.elements.analysisResult.innerHTML.includes('Kesim başlamadı'));
});
test('requested backup failure stops before razor', () => {
    const p = panel({ ACS_backupSequence: 'ERR|clone failed' }); p.elements.makeBackup.checked = true;
    p.start(); p.drain(); assert(!p.calls.includes('ACS_razorBatch'));
});
test('razor errors prevent any deletion', () => {
    const p = panel({ ACS_razorBatch: 'OK|1|0|1|razor failed|floor seqrazor' }); p.start(); p.drain();
    assert(!p.calls.includes('ACS_removeBatch')); assert(!p.calls.includes('ACS_prepareClipAction'));
});
test('prepared clip worklist is used once by the panel', () => {
    const p = panel(); p.start(); p.drain();
    assert.strictEqual(p.calls.filter(n => n === 'ACS_prepareClipAction').length, 1);
    assert.strictEqual(p.calls.filter(n => n === 'ACS_applyClipAction').length, 1);
    assert(!p.calls.includes('ACS_removeBatch'));
    assert(p.elements.log.textContent.includes('İşlem tamamlandı'));
    assert.strictEqual(p.api.state.lastCuts, null);
});
test('compaction preparation failure never reports completion', () => {
    const p = panel({ ACS_compactPrepare: 'ERR|move plan failed' }, 'remove_close'); p.start(); p.drain();
    assert(!p.elements.log.textContent.includes('İşlem tamamlandı'));
});
test('mute restore failure prevents analysis callback', () => {
    const p = panel({ ACS_restoreMutes: 'ERR|restore failed' });
    p.api.state.mutesApplied = true; let called = false;
    p.api.restoreThen(() => { called = true; }); assert.strictEqual(called, false);
    assert(p.elements.log.textContent.includes('restore failed'));
});
test('busy panel cannot start another analysis', () => {
    const p = panel(); p.api.state.busy = true; p.api.analyze();
    assert.strictEqual(p.calls.length, 0);
});
function writeExport(script) {
    const wavPath = JSON.parse(script.slice(script.indexOf('(') + 1, script.indexOf(', ')));
    const frames = 4 * 48000, b = Buffer.alloc(44 + frames * 2);
    b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(frames * 2, 40);
    for (let i = 0; i < frames; i++) {
        if (i < 48000 || i >= 3 * 48000) b.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 48000) * 13000), 44 + i * 2);
    }
    fs.writeFileSync(wavPath, b);
    return wavPath;
}
test('repeated analyses export fresh unique audio and clean temporary WAVs', () => {
    const paths = [];
    const p = panel({ ACS_exportAudio2: script => {
        paths.push(writeExport(script)); return 'OK|path|384044|preset0';
    } });
    p.element('thresholdSlider').value = '-40';
    for (let i = 0; i < 2; i++) {
        p.api.state.busy = true; p.api.doExport(null, 'all'); p.drain();
        assert(p.api.state.lastCuts.length > 0);
        assert.strictEqual(p.api.state.busy, false);
        assert.strictEqual(p.api.state.wavPath, null);
    }
    assert.strictEqual(paths.length, 2); assert.notStrictEqual(paths[0], paths[1]);
    assert(paths.every(f => !fs.existsSync(f)));
});
test('timeline changed during export discards the analysis', () => {
    let wavPath;
    const p = panel({ ACS_exportAudio2: (script, host) => {
        wavPath = writeExport(script);
        host.app.project.activeSequence.audioTracks[0].items[0].move(1);
        return 'OK|path|384044|preset0';
    } });
    p.api.state.busy = true; p.api.doExport(null, 'all'); p.drain();
    assert.strictEqual(p.api.state.lastCuts, null);
    assert(p.elements.log.textContent.includes('timeline degisti'));
    assert(!fs.existsSync(wavPath));
});
test('selection context from another sequence is rejected before export', () => {
    const p = panel(); p.api.state.busy = true;
    p.api.doExport([[1, 2]], 'all', 'another-sequence-context'); p.drain();
    assert(!p.calls.includes('ACS_exportAudio2'));
    assert.strictEqual(p.api.state.lastCuts, null);
});
process.exitCode = failed ? 1 : 0;
