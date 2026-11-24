/*
 * Nefes kısma host düzenlemesi (ACS_duckBreaths) — Premiere olmadan.
 * Sahte Volume > Level parametresi anahtar kareleri klibin medya zamanında tutar; değer ölçeği
 * Premiere'deki gibi 10^((dB-15)/20) (0 dB = 0.17782794).
 */
'use strict';
const assert = require('assert');
const { fixture } = require('./host-fixture');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
const ZERO_DB = Math.pow(10, -15 / 20);

function levelParam(value) {
    const keys = new Map();
    let varying = false;
    const at = t => {
        const ts = [...keys.keys()].sort((a, b) => a - b);
        if (!ts.length) return value;
        if (t <= ts[0]) return keys.get(ts[0]);
        if (t >= ts[ts.length - 1]) return keys.get(ts[ts.length - 1]);
        for (let i = 1; i < ts.length; i++) {
            if (t <= ts[i]) {
                const a = ts[i - 1], b = ts[i];
                return keys.get(a) + (keys.get(b) - keys.get(a)) * (t - a) / (b - a);
            }
        }
    };
    return {
        keys, interp: new Map(),
        isTimeVarying: () => varying, setTimeVarying(v) { varying = v; },
        getValue: () => value, getValueAtTime: at, getValueAtKey: t => keys.get(t),
        getKeys() { return [...keys.keys()].map(s => ({ seconds: s })); },
        addKey(t) { if (!varying) throw new Error('not time varying'); if (!keys.has(t)) keys.set(t, at(t)); },
        setValueAtKey(t, v) { if (!keys.has(t)) throw new Error('no key at ' + t); keys.set(t, v); },
        setInterpolationTypeAtKey(t, type) { this.interp.set(t, type); }
    };
}
function withVolume(item, param, matchName = 'Internal Volume Stereo') {
    const props = [{ displayName: 'Bypass' }, param]; props.numItems = 2;
    const comps = [{ matchName, properties: props }]; comps.numItems = 1;
    item.components = comps;
    return param;
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a breath inside a clip gets four linear keys in media time, -12 dB in the middle', () => {
    const f = fixture([[10, 20]]);
    const clip = f.seq.audioTracks[0].items[0];
    clip.inPoint = { seconds: 100 };                 // klip kaynağın 100. saniyesinden başlıyor
    const p = withVolume(clip, levelParam(ZERO_DB));
    assert.strictEqual(f.host.ACS_duckBreaths('12,12.4', '0', '12'), 'OK|1');
    const ts = [...p.keys.keys()].sort((a, b) => a - b);
    [102, 102.02, 102.38, 102.4].forEach((t, i) => assert(near(ts[i], t), ts.join(',')));
    const g = Math.pow(10, -12 / 20);
    assert(near(p.keys.get(ts[0]), ZERO_DB) && near(p.keys.get(ts[3]), ZERO_DB));
    assert(near(p.keys.get(ts[1]), ZERO_DB * g) && near(p.keys.get(ts[2]), ZERO_DB * g));
    assert([...p.interp.values()].every(v => v === 0) && p.interp.size === 4);
});

test('mute sets the breath to zero and keeps existing automation around it', () => {
    const f = fixture([[0, 10]]);
    const p = withVolume(f.seq.audioTracks[0].items[0], levelParam(ZERO_DB));
    p.setTimeVarying(true); p.keys.set(0, 0.1); p.keys.set(10, 0.3);   // kullanıcının seviye eğrisi
    assert.strictEqual(f.host.ACS_duckBreaths('5,5.5', 'all', 'mute'), 'OK|1');
    assert(near(p.keys.get(5), 0.2) && near(p.keys.get(5.5), 0.21));
    assert.strictEqual(p.keys.get(5.02), 0); assert.strictEqual(p.keys.get(5.48), 0);
    assert(near(p.keys.get(0), 0.1) && near(p.keys.get(10), 0.3));
});

test('an existing key inside the breath is lowered too', () => {
    const f = fixture([[0, 10]]);
    const p = withVolume(f.seq.audioTracks[0].items[0], levelParam(ZERO_DB));
    p.setTimeVarying(true); p.keys.set(5.2, 0.5);
    f.host.ACS_duckBreaths('5,5.5', '0', '6');
    assert(near(p.keys.get(5.2), 0.5 * Math.pow(10, -6 / 20)));
});

test('only selected, unlocked audio tracks change; breaths across a clip edge are clamped', () => {
    const f = fixture([[0, 3], [3, 6]], 1, 3);
    const tracks = f.seq.audioTracks;
    const ps = tracks.map(tr => tr.items.map(it => withVolume(it, levelParam(ZERO_DB))));
    tracks[1].isLocked = () => true;
    assert.strictEqual(f.host.ACS_duckBreaths('2.8,3.3', '0,1', '20'), 'OK|2');
    assert.deepStrictEqual([...ps[0][0].keys.keys()].map(t => +t.toFixed(3)), [2.8, 2.82, 2.98, 3]);
    assert.deepStrictEqual([...ps[0][1].keys.keys()].map(t => +t.toFixed(3)), [3, 3.02, 3.28, 3.3]);
    assert.strictEqual(ps[1][0].keys.size + ps[2][0].keys.size, 0);   // kilitli A2, seçilmeyen A3
});

test('too short overlaps are skipped and bad values are rejected', () => {
    const f = fixture([[0, 3]]);
    const p = withVolume(f.seq.audioTracks[0].items[0], levelParam(ZERO_DB));
    assert.strictEqual(f.host.ACS_duckBreaths('2.97,3.5', '0', '12'), 'OK|0');
    assert.strictEqual(p.keys.size, 0);
    assert(f.host.ACS_duckBreaths('1,1.5', '0', '0').startsWith('ERR|'));
    assert(f.host.ACS_duckBreaths('1,1.5', '0', 'x').startsWith('ERR|'));
});

if (failed) process.exitCode = 1;
