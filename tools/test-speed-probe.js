'use strict';
// Gecici QE setSpeed tanisi (ACS_speedProbe) — Premiere olmadan.
const assert = require('assert');
const { fixture } = require('./host-fixture');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}

// V1 ve A1'de 1-2 sn klip; selected: secili parca sayisi (V1, A1 sirasiyla).
function probeFixture(selected) {
    const f = fixture([[1, 2], [2, 3]]);
    const parts = [f.seq.videoTracks[0].items[0], f.seq.audioTracks[0].items[0]];
    parts[0].nodeId = 'v0'; parts[1].nodeId = 'a0';
    const calls = [];
    const qeTracks = parts.map((part, i) => {
        let speed = 1;
        part.getSpeed = () => speed;
        Object.defineProperty(part, 'duration', { get: () => ({ seconds: 1 / speed }) });
        const qeItem = { type: 'Clip', start: { secs: 1 },
            reflect: { methods: [{ name: 'setSpeed', arguments: [
                { name: 'p0', dataType: 'number' }, { name: 'p1', dataType: 'string' },
                { name: 'p2', dataType: 'boolean' }, { name: 'p3', dataType: 'boolean' },
                { name: 'p4', dataType: 'boolean' }] }, { name: 'remove', arguments: [] }] },
            setSpeed(...args) { calls.push([i].concat(args)); speed = args[0]; return true; } };
        return { numItems: 2, getItemAt: k => k === 0 ? { type: 'Empty', start: { secs: 0 } } : qeItem };
    });
    f.seq.getSelection = () => parts.slice(0, selected);
    f.host.app.enableQE = () => {};
    f.host.qe = { project: { getActiveSequence: () => ({
        getVideoTrackAt: () => qeTracks[0], getAudioTrackAt: () => qeTracks[1] }) } };
    return { f, calls };
}

test('inspect only reports setSpeed signature without editing', () => {
    const { f, calls } = probeFixture(1);
    const res = f.host.ACS_speedProbe('');
    assert(res.startsWith('OK|'), res);
    assert(res.includes('p0:number, p1:string, p2:boolean, p3:boolean, p4:boolean'), res);
    assert.strictEqual(calls.length, 0);
});
test('apply builds arguments from the reflected signature and reports before/after', () => {
    const { f, calls } = probeFixture(1);
    const res = f.host.ACS_speedProbe('0.5');
    assert.deepStrictEqual(calls, [[0, 0.5, '', false, false, false]]);
    assert(/once:.*V1#1 hiz=1 sure=1/.test(res) && /sonra:.*V1#1 hiz=0.5 sure=2/.test(res), res);
});
test('linked selection applies speed to every selected part', () => {
    const { f, calls } = probeFixture(2);
    const res = f.host.ACS_speedProbe('0.5');
    assert.deepStrictEqual(calls, [[0, 0.5, '', false, false, false], [1, 0.5, '', false, false, false]]);
    assert(/secili 2 parca/.test(res) && /sonra:.*V1#1 hiz=0.5.*A1#1 hiz=0.5/.test(res), res);
});
test('"r" suffix sets the last boolean (ripple candidate) to true', () => {
    const { f, calls } = probeFixture(2);
    f.host.ACS_speedProbe('0.5 r');
    assert.deepStrictEqual(calls, [[0, 0.5, '', false, false, true], [1, 0.5, '', false, false, true]]);
});
test('"d" flag sends the target duration (duration / speed) as timecode in the string slot', () => {
    const { f, calls } = probeFixture(1);
    const res = f.host.ACS_speedProbe('0.5 d');
    assert.deepStrictEqual(calls, [[0, 0.5, '00:00:02:00', false, false, false]], res);
});
test('requires a selected clip', () => {
    const { f, calls } = probeFixture(0);
    assert(/klip secin/i.test(f.host.ACS_speedProbe('0.5')));
    assert.strictEqual(calls.length, 0);
});
if (failed) process.exitCode = 1;
