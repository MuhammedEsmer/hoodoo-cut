'use strict';
const { fixture } = require('./host-fixture');
const path = require('path');
const cp = require('child_process');
const mode = process.argv[2] === 'prepared';
const baselineSource = mode ? null : cp.execFileSync('C:/Program Files/Git/cmd/git.exe',
    ['show', '749a6ea:com.hoodoocut/host/index.jsx'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
const intervals = Array.from({ length: 367 }, (_, i) => [i * 10 + 1, i * 10 + 2]);
const ranges = intervals.flatMap(([s, e]) => [[s - 1, s], [s, e], [e, e + 8]]);
function measure(prepared) {
    const { host, stats } = fixture(ranges, 3, 3, baselineSource);
    const start = process.hrtime.bigint();
    if (prepared) {
        const result = host.ACS_prepareClipAction(intervals.map(i => i.join(',')).join(';'), 'remove');
        if (!result.startsWith('OK|')) throw new Error(result);
        const total = Number(result.split('|')[1]);
        for (let i = 0; i < total; i += 60) {
            const res = host.ACS_applyClipAction(i, 60);
            if (!res.startsWith('OK|')) throw new Error(res);
        }
    } else {
        for (let i = 0; i < intervals.length; i += 60) {
            const res = host.ACS_removeBatch(intervals.slice(i, i + 60).map(i => i.join(',')).join(';'));
            if (!res.startsWith('OK|')) throw new Error(res);
        }
    }
    return { milliseconds: Number(process.hrtime.bigint() - start) / 1e6, ...stats };
}
const runs = Array.from({ length: 7 }, () => measure(mode));
console.log(JSON.stringify({ kind: 'mock Premiere DOM; no Adobe runtime timing', mode: mode ? 'prepared' : 'legacy',
    baselineCommit: '749a6ea', intervals: 367, videoTracks: 3, audioTracks: 3, clipsPerTrack: ranges.length, runs }, null, 2));
