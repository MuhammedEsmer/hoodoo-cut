'use strict';
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
// Adobe's packager does not need developer mode or a running host to archive a plugin.
const PackageCommand = require('../dist/uxp-packager/node_modules/@adobe/uxp-devtools-core/src/core/client/plugin/actions/PluginPackageCommand');
const manifest = path.join(root, 'com.hoodoocut.bulk', 'manifest.json');
const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
if (parsed.host.app !== 'premierepro' || parsed.manifestVersion !== 5 || !/^\d+\.\d+\.\d+$/.test(parsed.version)) {
    throw new Error('Invalid bulk plugin manifest');
}
new PackageCommand(null, { manifest, packageDir: path.join(root, 'dist'), apps: ['premierepro'] }).package()
    .then(results => {
        if (!results.every(result => result.success)) throw new Error(JSON.stringify(results));
        console.log('Packaged: dist/' + parsed.id + '_premierepro.ccx');
    }).catch(err => { console.error(err); process.exitCode = 1; });
