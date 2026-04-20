const { describe, it, afterEach } = require('node:test');
const assert = require('assert');
const { Highlighter } = require('../content/highlighter.js');
const { CONSTANTS } = require('../utils/consts.js');

global.CONSTANTS = CONSTANTS;
global.window = { location: { href: 'http://example.com' } };
global.SharedUtils = {
    normalizeUrl: (url) => url,
    normalizePageData: (page, url) => ({ url: url || '', highlights: [], drawings: [], ...(page || {}) }),
    getDefaultHighlightColor: () => '#ffff00'
};

class MockHighlighter extends Highlighter {
    constructor() {
        super({ ui: {}, pauseObserver: () => {}, resumeObserver: () => {}, isSavable: true });
        this.app = { ui: {}, pauseObserver: () => {}, resumeObserver: () => {}, isSavable: true };
    }
    init() {} 
}

describe('Highlighter Interval Merging', () => {
    const hl = new MockHighlighter();

    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should overwrite existing interval completely covered by new one', () => {
        const existing = [{ start: 10, end: 20, color: 'yellow', text: 'old', id: 'old-id' }];
        const newOne = { start: 10, end: 20, color: 'yellow', text: 'new', id: 'new-id' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].start, 10);
        assert.strictEqual(result[0].end, 20);
        assert.strictEqual(result[0].color, 'yellow');
        assert.strictEqual(result[0].text, 'new');
    });

    it('should split existing interval when overlapped in the middle', () => {
        const existing = [{ start: 0, end: 30, color: 'yellow', text: 'old', id: 'old-id' }];
        const newOne = { start: 10, end: 20, color: 'green', text: 'new', id: 'new-id' };
        const result = hl.flattenIntervals(existing, newOne);
        
        assert.strictEqual(result.length, 3);
        assert.strictEqual(result[0].start, 0);
        assert.strictEqual(result[0].end, 10);
        assert.strictEqual(result[0].color, 'yellow');
        
        assert.strictEqual(result[1].start, 10);
        assert.strictEqual(result[1].end, 20);
        assert.strictEqual(result[1].color, 'green');
        
        assert.strictEqual(result[2].start, 20);
        assert.strictEqual(result[2].end, 30);
        assert.strictEqual(result[2].color, 'yellow');
    });

    it('should merge adjacent intervals of same color', () => {
        const existing = [{ start: 0, end: 10, color: 'yellow', text: 'old', id: 'id1' }];
        const newOne = { start: 10, end: 20, color: 'yellow', text: 'new', id: 'id2' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].start, 0);
        assert.strictEqual(result[0].end, 20);
        assert.strictEqual(result[0].color, 'yellow');
    });

    it('should NOT merge adjacent intervals of different color', () => {
        const existing = [{ start: 0, end: 10, color: 'yellow', text: 'old', id: 'id1' }];
        const newOne = { start: 10, end: 20, color: 'green', text: 'new', id: 'id2' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].start, 0);
        assert.strictEqual(result[0].end, 10);
        assert.strictEqual(result[0].color, 'yellow');
        assert.strictEqual(result[1].start, 10);
        assert.strictEqual(result[1].end, 20);
        assert.strictEqual(result[1].color, 'green');
    });

    it('should handle complex overlapping', () => {
        const existing = [
            { start: 0, end: 10, color: 'yellow', id: 'id1' },
            { start: 20, end: 30, color: 'yellow', id: 'id2' }
        ];
        const newOne = { start: 5, end: 25, color: 'yellow', id: 'id3' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].start, 0);
        assert.strictEqual(result[0].end, 30);
        assert.strictEqual(result[0].color, 'yellow');
    });

    it('should handle complex overlapping with different colors', () => {
        const existing = [
            { start: 0, end: 10, color: 'yellow', id: 'id1' },
            { start: 20, end: 30, color: 'yellow', id: 'id2' }
        ];
        const newOne = { start: 5, end: 25, color: 'green', id: 'id3' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.strictEqual(result.length, 3);
        assert.strictEqual(result[0].start, 0);
        assert.strictEqual(result[0].end, 5);
        assert.strictEqual(result[0].color, 'yellow');
        assert.strictEqual(result[1].start, 5);
        assert.strictEqual(result[1].end, 25);
        assert.strictEqual(result[1].color, 'green');
        assert.strictEqual(result[2].start, 25);
        assert.strictEqual(result[2].end, 30);
        assert.strictEqual(result[2].color, 'yellow');
    });
});
