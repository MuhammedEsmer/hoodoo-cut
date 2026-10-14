/*
 * Basic Pitch panel paketi: entry.js -> com.hoodoocut/client/lib/basicpitch/basicpitch.js
 * + model/ (TF.js grafik modeli) + tfjs WASM ikilileri.
 * Kullanim: cd tools/basicpitch && npm install && node build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const out = path.join(__dirname, '..', '..', 'com.hoodoocut', 'client', 'lib', 'basicpitch');
const nm = path.join(__dirname, 'node_modules');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'model'), { recursive: true });

// basic-pitch tam '@tensorflow/tfjs' ister; yalnız core + converter kullanıyor (concat, expandDims,
// signal.frame, slice, tensor, zeros, loadGraphModel). MIDI yazımı (@tonejs/midi) kullanılmıyor.
const shims = {
    name: 'shims',
    setup(b) {
        b.onResolve({ filter: /^@tensorflow\/tfjs$/ }, () => ({ path: 'tfjs-shim', namespace: 'shim' }));
        b.onResolve({ filter: /^@tonejs\/midi$/ }, () => ({ path: 'empty', namespace: 'shim' }));
        b.onLoad({ filter: /^tfjs-shim$/, namespace: 'shim' }, () => ({ resolveDir: __dirname, loader: 'js',
            contents: "require('@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops');" +
                "module.exports = Object.assign({}, require('@tensorflow/tfjs-core'), { loadGraphModel: require('@tensorflow/tfjs-converter').loadGraphModel });" }));
        b.onLoad({ filter: /^empty$/, namespace: 'shim' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
    }
};

esbuild.build({
    entryPoints: [path.join(__dirname, 'entry.js')],
    // ESM girişleri: tensör zincir işlemleri (x.slice …) aynı tfjs-core örneğine kaydedilsin
    bundle: true, platform: 'node', format: 'cjs', target: 'node15', minify: true, mainFields: ['module', 'main'],
    outfile: path.join(out, 'basicpitch.js'), plugins: [shims], logLevel: 'warning',
    banner: { js: '/* HooDoo Cut: Spotify Basic Pitch (Apache-2.0) + TensorFlow.js (Apache-2.0) paketi. Kaynak: tools/basicpitch */' }
}).then(() => {
    const mdir = path.join(nm, '@spotify', 'basic-pitch', 'model');
    fs.readdirSync(mdir).forEach(f => fs.copyFileSync(path.join(mdir, f), path.join(out, 'model', f)));
    const wdir = path.join(nm, '@tensorflow', 'tfjs-backend-wasm', 'dist');
    fs.readdirSync(wdir).filter(f => f.endsWith('.wasm')).forEach(f => fs.copyFileSync(path.join(wdir, f), path.join(out, f)));
    let total = 0;
    (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else total += fs.statSync(p).size; }); })(out);
    console.log('basicpitch paketi: ' + out + ' (' + (total / 1048576).toFixed(1) + ' MB)');
}).catch(e => { console.error(e); process.exit(1); });
