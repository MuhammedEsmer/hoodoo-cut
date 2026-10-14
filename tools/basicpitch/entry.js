/*
 * HooDoo Cut - Basic Pitch (Spotify, Apache-2.0) panel paketi.
 * transcribe(22050 Hz mono Float32Array) -> Promise<[{ t, d, p, a }]> (sn, sn, MIDI, genlik 0-1).
 * Arka uç sırası: wasm (hızlı, CPU) -> webgl -> cpu. Model dosyaları paketin yanındaki model/ klasöründe.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-core');
require('@tensorflow/tfjs-backend-cpu');
require('@tensorflow/tfjs-backend-webgl');
const wasm = require('@tensorflow/tfjs-backend-wasm');
const { loadGraphModel } = require('@tensorflow/tfjs-converter');
const bp = require('@spotify/basic-pitch');

let ready = null, backendName = null, model = null;

function loadModel(dir) {
    const mj = JSON.parse(fs.readFileSync(path.join(dir, 'model.json'), 'utf8')), specs = [], bufs = [];
    mj.weightsManifest.forEach(function (g) {
        specs.push.apply(specs, g.weights);
        g.paths.forEach(function (p) { bufs.push(fs.readFileSync(path.join(dir, p))); });
    });
    const all = Buffer.concat(bufs);
    return loadGraphModel({ load: function () {
        return Promise.resolve({ modelTopology: mj.modelTopology, format: mj.format, generatedBy: mj.generatedBy,
            convertedBy: mj.convertedBy, weightSpecs: specs, weightData: all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) });
    } });
}

function init(baseDir) {
    if (ready) return ready;
    ready = (async function () {
        wasm.setWasmPaths(baseDir.replace(/\\/g, '/') + '/');
        for (const name of ['wasm', 'webgl', 'cpu']) {
            try { if (await tf.setBackend(name)) { await tf.ready(); backendName = name; break; } } catch (e) { /* sonraki */ }
        }
        model = await loadModel(path.join(baseDir, 'model'));
        return backendName;
    })();
    return ready;
}

async function transcribe(samples, opts) {
    opts = opts || {};
    await init(opts.baseDir || __dirname);
    const basic = new bp.BasicPitch(Promise.resolve(model)), frames = [], onsets = [], contours = [];
    await basic.evaluateModel(samples, function (f, o, c) { frames.push.apply(frames, f); onsets.push.apply(onsets, o); contours.push.apply(contours, c); },
        opts.onProgress || function () {});
    const notes = bp.noteFramesToTime(bp.addPitchBendsToNoteEvents(contours,
        bp.outputToNotesPoly(frames, onsets, opts.onsetThresh || 0.5, opts.frameThresh || 0.3, opts.minNoteLen || 5)));
    return notes.map(function (n) { return { t: n.startTimeSeconds, d: n.durationSeconds, p: n.pitchMidi, a: n.amplitude }; })
        .sort(function (x, y) { return x.t - y.t; });
}

module.exports = { transcribe: transcribe, init: init, backend: function () { return backendName; } };
