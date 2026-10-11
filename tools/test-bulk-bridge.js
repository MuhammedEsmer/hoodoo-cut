'use strict';
const assert = require('assert');
const createBridge = require('../com.hoodoocut/client/js/bulk-bridge');
(async () => {
    const bridge = createBridge(0);
    await new Promise(resolve => bridge.server.on('listening', resolve));
    const base = 'http://127.0.0.1:' + bridge.server.address().port;
    try {
        const token = (await (await fetch(base + '/hello')).json()).token;
        const request = (url, value, auth = token) => fetch(base + url, { method: 'POST', headers: {
            'Content-Type': 'application/json', 'X-HooDoo-Token': auth }, body: JSON.stringify(value) });
        assert(!bridge.ready());
        assert.strictEqual((await request('/poll', {}, 'wrong')).status, 403);
        assert.strictEqual((await fetch(base + '/hello', { headers: { Origin: 'https://evil.example' } })).status, 403);
        console.log('PASS origin and capability checks');
        await request('/poll', { projectPath: 'test', sequenceID: 'abc' });
        assert(bridge.ready());
        let finished;
        const completion = new Promise(resolve => bridge.submit({ targets: [1, 2, 3] }, (err, result) => {
            finished = { err, result }; resolve();
        }));
        const first = await (await request('/poll', {})).json();
        assert(first.job); const second = await (await request('/poll', {})).json();
        assert.strictEqual(second.job, null); console.log('PASS job claimed only once');
        assert.strictEqual((await request('/result', { id: 'wrong' })).status, 409); assert(!finished);
        await request('/result', { id: first.job.id, result: { removed: 3 } }); await completion;
        assert(!finished.err); assert.strictEqual(finished.result.removed, 3);
        assert.strictEqual((await request('/result', { id: first.job.id, result: {} })).status, 200);
        console.log('PASS result identity and idempotent acknowledgement');
    } finally { bridge.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
