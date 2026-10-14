'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const TICKS = 254016000000;

function fixture(ranges, videoCount = 1, audioCount = 1, hostSource) {
    const stats = { reads: 0, removed: 0 };
    function track() {
        let muted = false;
        const items = ranges.map(([s, e], i) => {
            const item = {
                nodeId: String(i), inPoint: { seconds: s }, outPoint: { seconds: e },
                disabled: false, projectItem: { nodeId: 'media', getMediaPath: () => 'source.wav' },
                remove() {
                    if (item.failRemove) throw new Error('remove failed');
                    const index = items.indexOf(item);
                    if (index < 0) throw new Error('stale reference');
                    items.splice(index, 1); stats.removed++;
                    return 0;
                },
                move(delta) { s += delta; e += delta; }
            };
            Object.defineProperties(item, {
                start: { get() { stats.reads++; return { seconds: s }; }, configurable: true },
                end: { get() { stats.reads++; return { seconds: e }; }, configurable: true }
            });
            return item;
        });
        const clips = new Proxy({}, { get(_, key) { return key === 'numItems' ? items.length : items[key]; } });
        return { clips, items, isLocked: () => false, isMuted: () => muted,
            setMute(value) { muted = arguments.length ? !!value : !muted; } };
    }
    function tracks(count) { const result = Array.from({ length: count }, track); result.numTracks = count; return result; }
    const seq = { sequenceID: 'sequence-1', name: 'Test', timebase: String(TICKS / 30),
        end: String(4000 * TICKS), videoTracks: tracks(videoCount), audioTracks: tracks(audioCount) };
    const context = vm.createContext({ app: { project: { name: 'Test', path: 'test.prproj', activeSequence: seq } } });
    vm.runInContext(hostSource || fs.readFileSync(path.join(__dirname, '../com.hoodoocut/host/index.jsx'), 'utf8'), context);
    return { host: context, seq, stats };
}
module.exports = { fixture };
