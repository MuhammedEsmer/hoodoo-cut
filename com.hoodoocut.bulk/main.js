'use strict';
const ppro = require('premierepro');
const { removePlan, activeContext } = require('./engine');
const { createLocalRequest } = require('./network');
const request = createLocalRequest(fetch);
const version = require('./manifest.json').version;
let token = null, receipt = null;
const status = text => { document.getElementById('status').textContent = 'Motor ' + version + '\n' + text; };

async function post(path, value) {
    const response = await request(path, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-HooDoo-Token': token
    }, body: JSON.stringify(value) });
    if (path === '/result' && response.status === 409) {
        status('Eski iş sonucu emekliye ayrıldı. Timeline durumunu kontrol edin.');
        return {};
    }
    if (!response.ok) throw new Error('Kopru HTTP ' + response.status);
    return response.json();
}

async function poll() {
    try {
        if (!token) {
            const response = await request('/hello');
            if (!response.ok) throw new Error('Kopru acilamadi');
            token = (await response.json()).token;
        }
        // Retry only the result receipt, never the editing operation.
        if (receipt) { await post('/result', receipt); receipt = null; }
        const context = await activeContext(ppro);
        const response = await post('/poll', { projectPath: context.projectPath, sequenceID: context.sequenceID });
        if (response.job) {
            status('Toplu silme uygulanıyor…');
            receipt = { id: response.job.id };
            try {
                receipt.result = await removePlan(ppro, response.job.plan);
                status(receipt.result.removed + ' klip tek işlemde silindi.\nNative silme: ' + receipt.result.commitMs + ' ms');
            } catch (err) { receipt.error = String(err); status(receipt.error); }
            await post('/result', receipt); receipt = null;
        } else { status('Toplu motor hazır.\nKesimi HooDoo Cut panelinden başlatın.'); }
    } catch (err) {
        token = null;
        status('HooDoo Cut bağlantısı bekleniyor.\n' + String(err));
    } finally { setTimeout(poll, 750); }
}
poll();
