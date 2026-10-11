'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
async function receiptRecovery(retryStatus) {
    let removals = 0, polls = 0, results = 0;
    const context = vm.createContext({
        require: name => name === 'premierepro' ? {} : name === './network' ? require('../com.hoodoocut.bulk/network') :
            name === './manifest.json' ? require('../com.hoodoocut.bulk/manifest.json') : {
            activeContext: async () => ({ projectPath: 'test', sequenceID: 'abc' }),
            removePlan: async () => { removals++; return { removed: 3, commitMs: 1 }; }
        },
        document: { getElementById: () => ({ textContent: '' }) },
        setTimeout() {},
        fetch: async (url) => {
            if (url.endsWith('/hello')) return { ok: true, json: async () => ({ token: 'token' }) };
            if (url.endsWith('/poll')) {
                polls++;
                return { ok: true, json: async () => ({ job: polls === 1 ? { id: 'one', plan: {} } : null }) };
            }
            results++;
            if (results === 1) throw new Error('Acknowledgement connection lost');
            return { ok: retryStatus === 200, status: retryStatus, json: async () => ({}) };
        }
    });
    const source = fs.readFileSync(path.join(__dirname, '../com.hoodoocut.bulk/main.js'), 'utf8');
    vm.runInContext(source.replace(/poll\(\);\s*$/, 'globalThis.runPoll = poll;'), context);
    await context.runPoll(); await context.runPoll();
    assert.strictEqual(removals, 1); assert.strictEqual(polls, 2); assert.strictEqual(results, 2);
}
(async () => {
    await receiptRecovery(200); console.log('PASS lost result acknowledgement recovers without another deletion');
    await receiptRecovery(409); console.log('PASS expired result receipt is retired and polling resumes');
})().catch(err => { console.error(err); process.exitCode = 1; });
