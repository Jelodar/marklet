const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('DOMUtils Edge Cases', () => {
    
    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle getPath for detached node', () => {
        const div = document.createElement('div');
        const path = DOMUtils.getPath(div);
        assert.strictEqual(path, "DIV[0]");
    });

    it('should handle resolvePath for invalid path', () => {
        const el = DOMUtils.resolvePath("INVALID[0]");
        assert.strictEqual(el, null);
    });

    it('should handle resolvePath for path index out of bounds', () => {
        const el = DOMUtils.resolvePath("BODY[0]/DIV[999]");
        assert.strictEqual(el, null);
    });

    it('should find fallback range with fuzzy match', () => {
        document.body.textContent = "Hello beautiful world";
        
        const fullText = "Hello beautiful world";
        const range = DOMUtils.findFallbackRange("beautiful", fullText, 6, 21, 0);
        
        assert.ok(range);
        assert.strictEqual(range.toString(), "beautiful");
    });

    it('should return null if fallback cannot be found', () => {
        document.body.textContent = "Hello world";
        const range = DOMUtils.findFallbackRange("missing", "Hello world", 0, 11, 0);
        assert.strictEqual(range, null);
    });
});
