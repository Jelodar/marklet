const { describe, it, afterEach } = require('node:test');
const assert = require('assert');
const { Highlighter } = require('../content/highlighter.js');
const { CONSTANTS } = require('../utils/consts.js');

global.CONSTANTS = CONSTANTS;
global.window = { location: { href: 'http://example.com' } };
global.SharedUtils = {
    normalizeUrl: (url) => url,
    normalizePageData: (page, url) => ({ url: url || '', highlights: [], drawings: [], ...(page || {}) })
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
        const existing = [{ start: 10, end: 20, color: 'yellow', text: 'old' }];
        const newOne = { start: 10, end: 20, color: 'yellow', text: 'new' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.deepStrictEqual(result, [{ start: 10, end: 20, color: 'yellow', text: 'new' }]);
    });

    it('should split existing interval when overlapped in the middle', () => {
        const existing = [{ start: 0, end: 30, color: 'yellow', text: 'old' }];
        const newOne = { start: 10, end: 20, color: 'green', text: 'new' };
        const result = hl.flattenIntervals(existing, newOne);
        
        
        assert.strictEqual(result.length, 3);
        assert.deepStrictEqual(result[0], { start: 0, end: 10, color: 'yellow', text: null });
        assert.deepStrictEqual(result[1], { start: 10, end: 20, color: 'green', text: 'new' });
        assert.deepStrictEqual(result[2], { start: 20, end: 30, color: 'yellow', text: null });
    });

    it('should merge adjacent intervals of same color', () => {
        const existing = [{ start: 0, end: 10, color: 'yellow', text: 'old' }];
        const newOne = { start: 10, end: 20, color: 'yellow', text: 'new' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.deepStrictEqual(result, [{ start: 0, end: 20, color: 'yellow', text: null }]);
    });

    it('should NOT merge adjacent intervals of different color', () => {
        const existing = [{ start: 0, end: 10, color: 'yellow', text: 'old' }];
        const newOne = { start: 10, end: 20, color: 'green', text: 'new' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(result[0], { start: 0, end: 10, color: 'yellow', text: 'old' });
        assert.deepStrictEqual(result[1], { start: 10, end: 20, color: 'green', text: 'new' });
    });

    it('should handle complex overlapping', () => {
        
        
        
        
        const existing = [
            { start: 0, end: 10, color: 'yellow' },
            { start: 20, end: 30, color: 'yellow' }
        ];
        const newOne = { start: 5, end: 25, color: 'yellow' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.deepStrictEqual(result, [{ start: 0, end: 30, color: 'yellow', text: null }]);
    });

    it('should handle complex overlapping with different colors', () => {
        
        
        
        const existing = [
            { start: 0, end: 10, color: 'yellow' },
            { start: 20, end: 30, color: 'yellow' }
        ];
        const newOne = { start: 5, end: 25, color: 'green' };
        const result = hl.flattenIntervals(existing, newOne);
        assert.strictEqual(result.length, 3);
        assert.deepStrictEqual(result[0], { start: 0, end: 5, color: 'yellow', text: null });
        assert.deepStrictEqual(result[1], { start: 5, end: 25, color: 'green' }); 
        assert.deepStrictEqual(result[2], { start: 25, end: 30, color: 'yellow', text: null });
    });
});
