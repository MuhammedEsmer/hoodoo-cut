'use strict';

// Premiere 26.x can reject installed plugins' loopback domain allowlists.
// The manifest uses the documented "all" compatibility form; runtime access
// remains restricted to these three local bridge routes, without redirects.
function createLocalRequest(fetchImpl) {
    return async function localRequest(endpoint, options) {
        if (!['/hello', '/poll', '/result'].includes(endpoint)) throw new Error('Invalid bridge endpoint');
        return fetchImpl('http://127.0.0.1:51373' + endpoint,
            Object.assign({}, options, { redirect: 'error' }));
    };
}

module.exports = { createLocalRequest };
