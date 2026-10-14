'use strict';
// Gecici QE setSpeed tanisi (ACS_speedProbe) — Premiere olmadan.
const assert = require('assert');
const { fixture } = require('./host-fixture');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}

function probeFixture(selectCount) {
    const f = fixture([[1, 2], [2, 3]]);
    const items = f.seq.videoTracks[0].items;
    let speed = 1;
    items[0].getSpeed = () => speed;
    Object.defineProperty(items[0], 'duration', { get: () => ({ seconds: 1 / speed }) });
    f.seq.getSelection = () => items.slice(0, selectCount);
    const calls = [];
    const qeItem = { type: 'Clip', start: { secs: 1 },
        reflect: { methods: [{ name: 'setSpeed', arguments: [
            { name: 'speed', dataType: 'number' }, { name: 'tc', dataType: 'string' },
            { name: 'reverse', dataType: 'boolean' }] }, { name: 'remove', arguments: [] }] },
        setSpeed(...args) { calls.push(args); speed = args[0]; return true; } };
    f.host.app.enableQE = () => {};
    f.host.qe = { project: { getActiveSequence: () => ({ getVideoTrackAt: () => ({ numItems: 2,
        getItemAt: i => i === 0 ? { type: 'Empty', start: { secs: 0 } } : qeItem }) }) } };
    return { f, calls };
}

test('inspect only reports setSpeed signature without editing', () => {
    const { f, calls } = probeFixture(1);
    const res = f.host.ACS_speedProbe('');
    assert(res.startsWith('OK|'), res);
    assert(res.includes('speed:number, tc:string, reverse:boolean'), res);
    assert.strictEqual(calls.length, 0);
});
test('apply builds arguments from the reflected signature and reports before/after', () => {
    const { f, calls } = probeFixture(1);
    const res = f.host.ACS_speedProbe('0.5');
    assert.deepStrictEqual(calls, [[0.5, '', false]]);
    assert(/once:.*V1#1 hiz=1 sure=1/.test(res) && /sonra:.*V1#1 hiz=0.5 sure=2/.test(res), res);
});
test('linked selection applies to the video clip and reports every selected part', () => {
    const { f, calls } = probeFixture(2);
    const res = f.host.ACS_speedProbe('0.5');
    assert.deepStrictEqual(calls, [[0.5, '', false]]);
    assert(/secili 2 parca/.test(res) && /V1#1/.test(res) && /V1#2/.test(res), res);
});
test('requires a selected clip', () => {
    const { f, calls } = probeFixture(0);
    assert(/klip secin/i.test(f.host.ACS_speedProbe('0.5')));
    assert.strictEqual(calls.length, 0);
});
if (failed) process.exitCode = 1;
