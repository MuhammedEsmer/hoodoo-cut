'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const root = path.resolve(__dirname, '..');
const oldSource = cp.execFileSync('C:/Program Files/Git/cmd/git.exe',
    ['show', '749a6ea:com.hoodoocut/client/js/analyzer.js'], { cwd: root, encoding: 'utf8' });
const context = vm.createContext({ module: { exports: {} }, Buffer });
vm.runInContext(oldSource, context);
const baseline = context.module.exports;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoodoo-analyzer-bench-'));
try {
    const rate = 48000, seconds = 120, frames = rate * seconds;
    const buffer = Buffer.alloc(44 + frames * 4);
    buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(2, 22);
    buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 4, 28);
    buffer.writeUInt16LE(4, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
    buffer.writeUInt32LE(frames * 4, 40);
    for (let i = 0; i < frames; i++) {
        const v = Math.round(Math.sin(i * 2 * Math.PI * 440 / rate) * 13000);
        buffer.writeInt16LE(v, 44 + i * 4); buffer.writeInt16LE(v, 46 + i * 4);
    }
    const file = path.join(dir, 'stereo.wav'); fs.writeFileSync(file, buffer);
    const runs = { baseline: [], current: [] };
    // Same VM compilation boundary for both versions; alternate to reduce order bias.
    const nowContext = vm.createContext({ module: { exports: {} }, Buffer });
    vm.runInContext(fs.readFileSync(path.join(root, 'com.hoodoocut/client/js/analyzer.js'), 'utf8'), nowContext);
    const now = nowContext.module.exports;
    for (let run = 0; run < 6; run++) {
        for (const [name, analyzer] of run % 2 ? [['current', now], ['baseline', baseline]] : [['baseline', baseline], ['current', now]]) {
            const start = process.hrtime.bigint();
            const result = analyzer.computeWindowDb(fs, file, 20, { hpHz: 120, lpHz: 5000 });
            if (result.db.length !== 6000) throw new Error('Unexpected window count');
            if (run > 0) runs[name].push(Number(process.hrtime.bigint() - start) / 1e6);
        }
    }
    console.log(JSON.stringify({ kind: 'Node CPU + local WAV read; no Premiere export',
        node: process.version, seconds, rate, channels: 2, baselineCommit: '749a6ea', runs }, null, 2));
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
