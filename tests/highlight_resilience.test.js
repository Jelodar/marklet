const { describe, it, beforeEach, afterEach } = require('node:test');
require('../tests/test-setup.js');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const storage = {};
global.chrome.storage.local.get = async (keys) => {
    if (typeof keys === 'string') return { [keys]: storage[keys] };
    if (Array.isArray(keys)) {
        const res = {};
        keys.forEach(k => res[k] = storage[k]);
        return res;
    }
    return storage;
};
global.chrome.storage.local.set = async (items) => {
    Object.assign(storage, items);
};

describe('Reproduction: Highlight Shift on Content Change', () => {
    let marklet;
    let dom;

    beforeEach(() => {
        for (const key in storage) delete storage[key];
        
        dom = new JSDOM('<!DOCTYPE html><body><div id="content">The quick brown fox jumps over the lazy dog.</div></body>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.Node = dom.window.Node;
        global.NodeFilter = dom.window.NodeFilter;
        global.Element = dom.window.Element;
        global.Range = dom.window.Range;
        global.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
        global.Range.prototype.getClientRects = () => [];
        global.Selection = dom.window.Selection;
        global.window.getSelection = () => ({
            getRangeAt: () => {},
            removeAllRanges: () => {},
            addRange: () => {},
            isCollapsed: false,
            toString: () => "",
            rangeCount: 0
        });

        delete require.cache[require.resolve('../content/highlighter.js')];
        delete require.cache[require.resolve('../content/marklet.js')];
        delete require.cache[require.resolve('../content/dom_utils.js')];
        
        global.DOMUtils = require('../content/dom_utils.js').DOMUtils;
        const { Marklet } = require('../content/marklet.js');
        
        marklet = new Marklet();
        marklet.initAll(); 
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should corrupt existing highlights when content shifts if fallback is missing', async () => {
        const contentDiv = document.getElementById('content');
        
        const textNode = contentDiv.firstChild;
        const range1 = document.createRange();
        range1.setStart(textNode, 4);
        range1.setEnd(textNode, 9);
        
        global.window.getSelection = () => ({
            getRangeAt: () => range1,
            removeAllRanges: () => {},
            isCollapsed: false,
            toString: () => "quick",
            rangeCount: 1
        });

        await marklet.highlighter.applyHighlight(range1, "yellow");
        
        let pages = storage.pages;
        assert.ok(pages['http://localhost'], 'Page should be in storage');
        assert.strictEqual(pages['http://localhost'].highlights.length, 1);
        assert.strictEqual(pages['http://localhost'].highlights[0].text, 'quick');
        
        document.body.innerHTML = '<div id="content">The very quick brown fox jumps over the lazy dog.</div>';
        const newTextNode = document.getElementById('content').firstChild;
        
        const range2 = document.createRange();
        range2.setStart(newTextNode, 15);
        range2.setEnd(newTextNode, 20);
        
        global.window.getSelection = () => ({
            getRangeAt: () => range2,
            removeAllRanges: () => {},
            isCollapsed: false,
            toString: () => "brown",
            rangeCount: 1
        });
        
        await marklet.highlighter.applyHighlight(range2, "green");
        
        pages = storage.pages;
        const highlights = pages['http://localhost'].highlights;
        
        const quickHl = highlights.find(h => h.color === 'yellow');
        
        assert.ok(quickHl, 'Highlight was lost');
        
        if (quickHl.start === 4) {
             const range = DOMUtils.getRangeFromOffsets(quickHl.start, quickHl.end);
             assert.strictEqual(quickHl.start, 9, 'Highlight should have moved to offset 9');
        }
        
        assert.strictEqual(quickHl.text, 'quick', 'Highlight text drifted');
    });
});
