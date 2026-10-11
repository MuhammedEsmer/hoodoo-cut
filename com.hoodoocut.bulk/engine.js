'use strict';

function sequenceID(value) {
    return String(value).replace(/[{}]/g, '').toLowerCase();
}

function nativePath(value) {
    // UXP on Windows returns extended paths; CEP returns ordinary paths.
    return value.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\(?=[a-z]:\\)/i, '');
}

async function activeContext(ppro) {
    const project = await ppro.Project.getActiveProject();
    const sequence = project && await project.getActiveSequence();
    if (!sequence) throw new Error('Aktif sequence yok');
    return { project, sequence, projectPath: nativePath(project.path), sequenceID: sequenceID(sequence.guid.toString()) };
}

async function removePlan(ppro, plan) {
    const started = Date.now();
    const context = await activeContext(ppro);
    if (context.projectPath !== nativePath(plan.projectPath) || context.sequenceID !== sequenceID(plan.sequenceID)) {
        throw new Error('Proje veya sequence degisti');
    }
    let dirty = false;
    const listeners = [];
    function watch(target, event) {
        const handler = () => { dirty = true; };
        ppro.EventManager.addEventListener(target, event, handler, false);
        listeners.push({ target, event, handler });
    }
    watch(context.project, ppro.Constants.ProjectEvent.DIRTY);
    try {
    const targets = [], tracks = new Map(), trackRefs = new Map(), keys = new Set(), timings = [];
    for (const wanted of plan.targets) {
        if ((wanted.g !== 0 && wanted.g !== 1) || !Number.isInteger(wanted.t) || wanted.t < 0 ||
            ![wanted.s, wanted.e, wanted.inPoint, wanted.outPoint].every(Number.isFinite) || wanted.e <= wanted.s) {
            throw new Error('Gecersiz hedef');
        }
        const key = wanted.g + ':' + wanted.t;
        if (!tracks.has(key)) {
            const t0 = Date.now();
            const track = await (wanted.g === 0 ? context.sequence.getVideoTrack(wanted.t) :
                context.sequence.getAudioTrack(wanted.t));
            const events = wanted.g === 0 ? ppro.Constants.VideoTrackEvent : ppro.Constants.AudioTrackEvent;
            watch(track, events.TRACK_CHANGED); watch(track, events.LOCK_CHANGED);
            const items = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
            const snapshots = await Promise.all(items.map(async item => {
                const times = await Promise.all([item.getStartTime(), item.getEndTime()]);
                return { item, s: times[0].seconds, e: times[1].seconds };
            }));
            tracks.set(key, snapshots);
            trackRefs.set(key, track);
            timings.push({ track: (wanted.g === 0 ? 'V' : 'A') + (wanted.t + 1), scanMs: Date.now() - t0 });
        }
        const matches = tracks.get(key).filter(sn => ['s', 'e'].every(
            field => Math.abs(sn[field] - wanted[field]) <= 0.000001));
        if (matches.length !== 1) throw new Error('Hedef klip degisti veya bulunamadi: ' + key);
        if (keys.has(matches[0].item)) throw new Error('Tekrar eden hedef');
        const item = matches[0].item;
        const source = await item.getProjectItem();
        const clipSource = ppro.ClipProjectItem.cast(source);
        const details = await Promise.all([item.getInPoint(), item.getOutPoint(),
            clipSource ? clipSource.getMediaFilePath() : Promise.resolve('')]);
        if (Math.abs(details[0].seconds - wanted.inPoint) > 0.000001 ||
            Math.abs(details[1].seconds - wanted.outPoint) > 0.000001 || nativePath(details[2]) !== nativePath(wanted.mediaPath) ||
            source.name !== wanted.sourceName) throw new Error('Hedef kaynak degisti: ' + key);
        keys.add(item); targets.push(item);
    }
    const finalContext = await activeContext(ppro);
    if (finalContext.projectPath !== context.projectPath || finalContext.sequenceID !== context.sequenceID) {
        throw new Error('Aktif sequence degisti');
    }
    const prepareMs = Date.now() - started;
    if (!targets.length) return { removed: 0, prepareMs, commitMs: 0, timings };
    const commitStart = Date.now();
    let committed = false;
    context.project.lockedAccess(() => {
        if (dirty) throw new Error('Timeline hazirlik sirasinda degisti');
        const created = ppro.TrackItemSelection.createEmptySelection(selection => {
            for (const item of targets) {
                if (!selection.addItem(item, true)) throw new Error('Hedef secime eklenemedi');
            }
            // Selection/action/transaction must remain synchronous within this callback.
            const editor = ppro.SequenceEditor.getEditor(context.sequence);
            committed = context.project.executeTransaction(compound => {
                if (!compound.addAction(editor.createRemoveItemsAction(selection, false, ppro.Constants.MediaType.ANY, false))) {
                    throw new Error('Silme action transaction icine eklenemedi');
                }
            }, 'HooDoo Cut: toplu silme (' + targets.length + ' klip)');
        });
        if (!created) throw new Error('UXP secimi olusturulamadi');
        if (committed) {
            for (const [key, track] of trackRefs) {
                const expected = tracks.get(key).length - plan.targets.filter(wanted => wanted.g + ':' + wanted.t === key).length;
                if (track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false).length !== expected) {
                    throw new Error('Silme sonucu dogrulanamadi: ' + key + '; timeline ve Ctrl+Z durumunu kontrol edin');
                }
            }
        }
    });
    if (!committed) throw new Error('Toplu silme transaction basarisiz');
    return { removed: targets.length, prepareMs, commitMs: Date.now() - commitStart, timings };
    } finally {
        listeners.forEach(listener => ppro.EventManager.removeEventListener(listener.target, listener.event, listener.handler));
    }
}

module.exports = { removePlan, activeContext };
