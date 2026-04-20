const { describe, it, beforeEach, afterEach } = require('node:test');
require('../tests/test-setup.js');
const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Reproduction: Highlight Shift on Content Change', () => {
    let marklet;
    let dom;

    beforeEach(() => {
        mockStorage.clear();
        
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
        
        const url = SharedUtils.normalizeUrl('http://localhost/');
        const page = mockStorage.get(`idb:${url}`);
        assert.ok(page, 'Page should be in storage');
        assert.strictEqual(page.highlights.length, 1);
        assert.strictEqual(page.highlights[0].text, 'quick');
        
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
        
        const pageAfter = mockStorage.get(`idb:${url}`);
        const highlights = pageAfter.highlights;
        
        const quickHl = highlights.find(h => h.color === 'yellow');
        
        assert.ok(quickHl, 'Highlight was lost');
        
        if (quickHl.start === 4) {
             assert.strictEqual(quickHl.start, 9, 'Highlight should have moved to offset 9');
        }
        
        assert.strictEqual(quickHl.text, 'quick', 'Highlight text drifted');
    });

    it('should NOT lose unresolved highlights when applying a new one', async () => {
        const url = SharedUtils.normalizeUrl('http://localhost/');
        
        document.body.innerHTML = '<div id="content">Part 1. Part 2.</div>';
        const contentDiv = document.getElementById('content');
        const textNode = contentDiv.firstChild;
        const range1 = document.createRange();
        range1.setStart(textNode, 0);
        range1.setEnd(textNode, 6);
        
        await marklet.highlighter.applyHighlight(range1, "yellow");
        
        let page = mockStorage.get(`idb:${url}`);
        assert.strictEqual(page.highlights.length, 1);
        const id1 = page.highlights[0].id;

        document.body.innerHTML = '<div id="content">Something else. Part 2.</div>';
        
        const newTextNode = document.getElementById('content').firstChild;
        const range2 = document.createRange();
        range2.setStart(newTextNode, 15);
        range2.setEnd(newTextNode, 21);
        
        global.window.getSelection = () => ({
            getRangeAt: () => range2,
            removeAllRanges: () => {},
            isCollapsed: false,
            toString: () => "Part 2",
            rangeCount: 1
        });

        await marklet.highlighter.applyHighlight(range2, "green");
        
        page = mockStorage.get(`idb:${url}`);
        assert.strictEqual(page.highlights.length, 2, 'Should have 2 highlights (1 resolved, 1 unresolved)');
        assert.ok(page.highlights.find(h => h.id === id1), 'Original unresolved highlight should be preserved');
    });
});
