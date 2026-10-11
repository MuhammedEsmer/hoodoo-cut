'use strict';
const http = require('http');
const crypto = require('crypto');

module.exports = function createBridge(port, onError) {
    const token = crypto.randomBytes(32).toString('hex');
    let seen = 0, context = null, pending = null, stopped = false, acknowledged = null;
    const server = http.createServer((req, res) => {
        function reply(status, body) {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        }
        // No CORS; browser origins cannot read the capability or submit work/results.
        if (req.headers.origin || req.headers.host !== '127.0.0.1:' + server.address().port) {
            reply(403, { error: 'origin' }); return;
        }
        if (req.method === 'GET' && req.url === '/hello') { reply(200, { token }); return; }
        if (req.headers['x-hoodoo-token'] !== token) { reply(403, { error: 'token' }); return; }
        if (req.method !== 'POST' || !['/poll', '/result'].includes(req.url)) { reply(404, {}); return; }
        let body = '', oversized = false;
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) { oversized = true; req.destroy(); }
        });
        req.on('end', () => {
            if (oversized) return;
            let value;
            try { value = JSON.parse(body); } catch (_) { reply(400, {}); return; }
            if (!value || typeof value !== 'object' || Array.isArray(value)) { reply(400, {}); return; }
            if (req.url === '/poll') {
                seen = Date.now(); context = value;
                let job = null;
                if (pending && !pending.claimed) { pending.claimed = true; job = { id: pending.id, plan: pending.plan }; }
                reply(200, { job });
            } else {
                if (value.id === acknowledged) { reply(200, {}); return; }
                if (!pending || !pending.claimed || value.id !== pending.id) { reply(409, {}); return; }
                const current = pending; pending = null; acknowledged = value.id; clearTimeout(current.timer);
                reply(200, {}); current.cb(value.error ? new Error(value.error) : null, value.result);
            }
        });
    });
    server.on('error', err => { stopped = true; if (onError) onError(err); });
    server.listen(port === undefined ? 51373 : port, '127.0.0.1');
    return {
        server,
        ready: () => !stopped && !pending && seen > Date.now() - 5000 && context && context.sequenceID,
        context: () => context,
        submit: (plan, cb) => {
            if (stopped || pending || seen <= Date.now() - 5000) { cb(new Error('Toplu motor bagli degil')); return; }
            const id = crypto.randomBytes(16).toString('hex');
            pending = { id, plan, cb, claimed: false };
            pending.timer = setTimeout(() => {
                if (!pending || pending.id !== id) return;
                pending = null;
                cb(new Error('Toplu motor yaniti gelmedi. Timeline durumunu kontrol edin; islem otomatik tekrarlanmaz.'));
            }, 300000);
        },
        close: () => {
            stopped = true;
            if (pending) { clearTimeout(pending.timer); const cb = pending.cb; pending = null; cb(new Error('Panel kapandi')); }
            server.close();
        }
    };
};
