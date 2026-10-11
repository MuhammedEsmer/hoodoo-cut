'use strict';
const assert = require('assert');
const { removePlan } = require('../com.hoodoocut.bulk/engine');

function fixture() {
    const stats = { actions: 0, transactions: 0, deleted: [], locked: false, selectionAlive: false };
    const items = [0, 1, 1].map((g, i) => ({
        g, t: g ? i - 1 : 0,
        getStartTime: async () => ({ seconds: 1 }), getEndTime: async () => ({ seconds: 2 }),
        getInPoint: async () => ({ seconds: 10 }), getOutPoint: async () => ({ seconds: 11 }),
        getProjectItem: async () => ({ name: 'source', getMediaFilePath: async () => 'source.wav' })
    }));
    const track = item => ({ getTrackItems: () => stats.deleted.includes(item) ? [] : [item] });
    const seq = { guid: { toString: () => '{ABC}' },
        getVideoTrack: async () => track(items[0]), getAudioTrack: async i => track(items[i + 1]) };
    const project = { path: 'C:\\test.prproj', getActiveSequence: async () => seq,
        lockedAccess: fn => { stats.locked = true; try { fn(); } finally { stats.locked = false; } },
        executeTransaction: fn => { assert(stats.locked); stats.transactions++; fn({ addAction: a => { stats.deleted = a; return true; } }); return true; } };
    const ppro = { Project: { getActiveProject: async () => project },
        Constants: { TrackItemType: { CLIP: 1 }, MediaType: { ANY: 'any' }, ProjectEvent: { DIRTY: 'dirty' },
            VideoTrackEvent: { TRACK_CHANGED: 'changed', LOCK_CHANGED: 'lock' }, AudioTrackEvent: { TRACK_CHANGED: 'changed', LOCK_CHANGED: 'lock' } },
        ClipProjectItem: { cast: source => source },
        EventManager: { addEventListener: (target, event, handler) => { if (event === 'dirty') stats.dirty = handler; }, removeEventListener() {} },
        TrackItemSelection: { createEmptySelection: fn => {
            stats.selectionAlive = true;
            const selected = [];
            try { fn({ addItem: it => { selected.push(it); return true; }, selected }); }
            finally { stats.selectionAlive = false; }
            return true;
        } },
        SequenceEditor: { getEditor: () => ({ createRemoveItemsAction: (selection, ripple, media, shift) => {
            assert(stats.selectionAlive && stats.locked); assert.strictEqual(ripple, false);
            assert.strictEqual(media, 'any'); assert.strictEqual(shift, false); stats.actions++;
            return selection.selected;
        } }) } };
    const plan = { projectPath: project.path, sequenceID: 'abc', targets: items.map(it =>
        ({ g: it.g, t: it.t, s: 1, e: 2, inPoint: 10, outPoint: 11, mediaPath: 'source.wav', sourceName: 'source' })) };
    return { stats, ppro, plan, items, project };
}

(async () => {
    let f = fixture();
    let result = await removePlan(f.ppro, f.plan);
    assert.strictEqual(result.removed, 3); assert.strictEqual(f.stats.actions, 1);
    assert.strictEqual(f.stats.transactions, 1); assert.deepStrictEqual(f.stats.deleted, f.items);
    console.log('PASS mixed V1 A1 A2: one action, one transaction, callback lifetime');
    f = fixture();
    f.project.path = '\\\\?\\' + f.plan.projectPath;
    result = await removePlan(f.ppro, f.plan);
    assert.strictEqual(result.removed, 3);
    const { activeContext } = require('../com.hoodoocut.bulk/engine');
    assert.strictEqual((await activeContext(f.ppro)).projectPath, f.plan.projectPath);
    console.log('PASS native extended project path matches CEP and heartbeat');
    f = fixture();
    f.project.path = String.raw`\\?\UNC\server\share\test.prproj`;
    f.plan.projectPath = String.raw`\\server\share\test.prproj`;
    result = await removePlan(f.ppro, f.plan);
    assert.strictEqual(result.removed, 3);
    console.log('PASS extended UNC project path matches CEP');
    f = fixture();
    f.items.forEach(item => { item.getProjectItem = async () => ({ name: 'source',
        getMediaFilePath: async () => String.raw`\\?\C:\media\source.wav` }); });
    f.plan.targets.forEach(target => { target.mediaPath = String.raw`C:\media\source.wav`; });
    result = await removePlan(f.ppro, f.plan);
    assert.strictEqual(result.removed, 3);
    console.log('PASS native extended media path matches CEP');
    f = fixture(); f.project.path = String.raw`\\?\C:\other.prproj`;
    await assert.rejects(removePlan(f.ppro, f.plan), /Proje/i);
    assert.strictEqual(f.stats.actions, 0);
    console.log('PASS different project still stops before mutation');
    f = fixture(); f.plan.sequenceID = 'other';
    await assert.rejects(removePlan(f.ppro, f.plan), /sequence/i); assert.strictEqual(f.stats.actions, 0);
    console.log('PASS wrong sequence stops before mutation');
    f = fixture(); f.plan.targets[2].inPoint = 99;
    await assert.rejects(removePlan(f.ppro, f.plan), /hedef/i); assert.strictEqual(f.stats.actions, 0);
    console.log('PASS changed source stops all tracks before mutation');
    f = fixture(); f.plan.targets.push(f.plan.targets[0]);
    await assert.rejects(removePlan(f.ppro, f.plan), /tekrar/i); assert.strictEqual(f.stats.actions, 0);
    console.log('PASS duplicate targets rejected');
    f = fixture(); f.project.executeTransaction = () => false;
    await assert.rejects(removePlan(f.ppro, f.plan), /transaction/i);
    console.log('PASS failed transaction is not success');
    f = fixture(); f.project.executeTransaction = fn => { fn({ addAction: () => false }); return true; };
    await assert.rejects(removePlan(f.ppro, f.plan), /action/i);
    console.log('PASS rejected compound action is not success');
    f = fixture(); f.items[2].getInPoint = async () => { f.stats.dirty(); return { seconds: 10 }; };
    await assert.rejects(removePlan(f.ppro, f.plan), /Timeline/i); assert.strictEqual(f.stats.actions, 0);
    console.log('PASS timeline mutation during async preparation cancels deletion');
    f = fixture(); f.plan.targets[0].mediaPath = 'replacement.wav';
    await assert.rejects(removePlan(f.ppro, f.plan), /Hedef/i); assert.strictEqual(f.stats.actions, 0);
    console.log('PASS same timing with different media is rejected');
    f = fixture(); f.project.executeTransaction = fn => { fn({ addAction: () => true }); return true; };
    await assert.rejects(removePlan(f.ppro, f.plan), /dogrulanamadi/i);
    console.log('PASS silently unchanged native timeline is not reported as deleted');
    f = fixture(); f.plan.targets = [];
    result = await removePlan(f.ppro, f.plan); assert.strictEqual(result.removed, 0);
    assert.strictEqual(f.stats.actions, 0); console.log('PASS empty plan has no transaction');
})().catch(err => { console.error(err); process.exitCode = 1; });
