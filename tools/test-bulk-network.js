'use strict';
const assert = require('assert');
const { createLocalRequest } = require('../com.hoodoocut.bulk/network');
(async () => {
    const calls = [];
    const request = createLocalRequest(async (url, options) => {
        calls.push({ url, options });
        return { status: 200, ok: true };
    });
    for (const endpoint of ['/hello', '/poll', '/result']) await request(endpoint, { method: 'POST' });
    assert(calls.every(call => call.url.startsWith('http://127.0.0.1:51373/') && call.options.redirect === 'error'));
    console.log('PASS bridge requests use only fixed loopback origin and refuse redirects');
    for (const endpoint of ['https://example.com', '//example.com', '/hello?redirect=https://example.com', '/other', '/hello/../other']) {
        await assert.rejects(request(endpoint), /endpoint/);
    }
    assert.strictEqual(calls.length, 3);
    console.log('PASS external URLs and unrecognized routes never reach fetch');
})().catch(err => { console.error(err); process.exitCode = 1; });
