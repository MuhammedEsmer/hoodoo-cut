/*
 * Nefes modeli panel paketi -> com.hoodoocut/client/lib/respiro/
 *   respiro-en.onnx  Respiro-en (MIT, github.com/ydqmkkx/Respiro-en), ONNX: huggingface.co/pbTechLab/respiro-en-onnx
 *   ort.js + ort-wasm-simd-threaded.wasm  ONNX Runtime Web (MIT), WASM, tek iş parçacığı
 *   (ort.js: WASM yükleyicisi gömülü "bundle" sürümü, CJS'e çevrilmiş. Yükleyiciyi sonradan import()
 *   eden Node girişi CEP 12 panelinde sayfayı çökertti; .wasm dosyası env.wasm.wasmBinary ile verilir.)
 * Kullanim: cd tools/respiro && npm install && node build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const MODEL_URL = 'https://huggingface.co/pbTechLab/respiro-en-onnx/resolve/main/respiro-en.onnx';
const MODEL_SHA256 = '3ccc55d4130b2465f8a7975178a30317d45babb7de5e7b3533fae1810c9b7138';
const out = path.join(__dirname, '..', '..', 'com.hoodoocut', 'client', 'lib', 'respiro');
const dist = path.join(__dirname, 'node_modules', 'onnxruntime-web', 'dist');

(async () => {
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    await esbuild.build({
        entryPoints: [path.join(dist, 'ort.wasm.bundle.min.mjs')],
        bundle: true, platform: 'node', format: 'cjs', target: 'node16', minify: true,
        outfile: path.join(out, 'ort.js'), logLevel: 'error',
        banner: { js: '/* HooDoo Cut: ONNX Runtime Web (MIT), WASM bundle. Kaynak: tools/respiro */' }
    });
    fs.copyFileSync(path.join(dist, 'ort-wasm-simd-threaded.wasm'), path.join(out, 'ort-wasm-simd-threaded.wasm'));
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error('Model indirilemedi: HTTP ' + res.status);
    const model = Buffer.from(await res.arrayBuffer());
    const sha = crypto.createHash('sha256').update(model).digest('hex');
    if (sha !== MODEL_SHA256) throw new Error('Model SHA-256 uyuşmuyor: ' + sha);
    fs.writeFileSync(path.join(out, 'respiro-en.onnx'), model);
    let total = 0;
    fs.readdirSync(out).forEach(f => { total += fs.statSync(path.join(out, f)).size; });
    console.log('respiro paketi: ' + out + ' (' + (total / 1048576).toFixed(1) + ' MB)');
})().catch(e => { console.error(e); process.exit(1); });
