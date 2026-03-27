const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const { Highlighter } = require('../content/highlighter.js');
const { DOMUtils } = require('../content/dom_utils.js');
const SharedUtils = require('../utils/shared.js');

global.DOMUtils = DOMUtils;
global.SharedUtils = SharedUtils;


const dom = new JSDOM('<!DOCTYPE html><body><div id="content">Hello World</div></body>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.Range = dom.window.Range;
global.Range.prototype.getBoundingClientRect = () => ({ width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10 });
global.NodeFilter = dom.window.NodeFilter;
global.Element = dom.window.Element;
global.ShadowRoot = dom.window.ShadowRoot;
global.crypto = { randomUUID: () => 'uuid-' + Math.random() };


global.chrome = {
    runtime: {
        id: 'test-id'
    },
    storage: {
        local: {
            get: mock.fn(async () => ({ pages: {} })),
            set: mock.fn(async () => {})
        },
        onChanged: { addListener: () => {} }
    }
};

class TestHighlighter extends Highlighter {
    constructor() {
        super({ 
            ui: { trackRecentColor: () => {}, hideSelectionToolbar: () => {}, showEditToolbar: () => {} }, 
            pauseObserver: () => {}, 
            resumeObserver: () => {}, 
            updateObserverState: () => {},
            hasHighlights: false 
        });
    }
    async loadHighlights() {} 
}

describe('Highlighter Integration', () => {
    let hl;
    let container;

    beforeEach(() => {
        container = document.getElementById('content');
        container.innerHTML = 'Hello World';
        
        chrome.storage.local.get.mock.restore();
        chrome.storage.local.set.mock.restore();
        chrome.storage.local.get = mock.fn(async () => ({ pages: { 'http://localhost': { highlights: [] } } }));
        chrome.storage.local.set = mock.fn(async () => {});
        
        hl = new TestHighlighter();
    });

    afterEach(async () => {
        DOMUtils.stripHighlights();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should merge overlapping highlights of same color', async () => {
        
        const range1 = document.createRange();
        range1.setStart(container.firstChild, 0);
        range1.setEnd(container.firstChild, 5);
        await hl.applyHighlight(range1, 'yellow');

        
        let calls = chrome.storage.local.set.mock.calls;
        let lastCall = calls[calls.length - 1];
        let pages = lastCall.arguments[0].pages;
        let highlights = pages['http://localhost'].highlights;
        assert.strictEqual(highlights.length, 1);
        assert.strictEqual(highlights[0].start, 0);
        assert.strictEqual(highlights[0].text, 'Hello');

        
        chrome.storage.local.get = mock.fn(async () => ({ pages }));

        
        const mark = container.querySelector('.marklet-highlight');
        const rangeOverlap = document.createRange();
        rangeOverlap.setStart(mark.firstChild, 1);
        rangeOverlap.setEnd(mark.firstChild, 5);
        
        await hl.applyHighlight(rangeOverlap, 'yellow');
        
        
        calls = chrome.storage.local.set.mock.calls;
        lastCall = calls[calls.length - 1];
        pages = lastCall.arguments[0].pages;
        highlights = pages['http://localhost'].highlights;
        
        assert.strictEqual(highlights.length, 1);
        assert.strictEqual(highlights[0].start, 0);
        assert.strictEqual(highlights[0].text, 'Hello');
    });

    it('should merge adjacent highlights of same color', async () => {
        
        const range1 = document.createRange();
        range1.setStart(container.firstChild, 0);
        range1.setEnd(container.firstChild, 5);
        await hl.applyHighlight(range1, 'yellow');
        
        let calls = chrome.storage.local.set.mock.calls;
        let pages = calls[calls.length - 1].arguments[0].pages;
        chrome.storage.local.get = mock.fn(async () => ({ pages }));

        
        
        let textNode;
        for (let n of container.childNodes) {
            if (n.nodeType === 3 && n.textContent === ' World') {
                textNode = n;
                break;
            }
        }
        
        const range2 = document.createRange();
        range2.setStart(textNode, 0);
        range2.setEnd(textNode, 6); 
        
        await hl.applyHighlight(range2, 'yellow');
        
        calls = chrome.storage.local.set.mock.calls;
        pages = calls[calls.length - 1].arguments[0].pages;
        let highlights = pages['http://localhost'].highlights;
        
        
        assert.strictEqual(highlights.length, 1);
        assert.strictEqual(highlights[0].start, 0);
        assert.strictEqual(highlights[0].text, 'Hello World');
    });

    it('should split existing highlight when inserting different color inside', async () => {
        
        const range1 = document.createRange();
        range1.setStart(container.firstChild, 0);
        range1.setEnd(container.firstChild, 11);
        await hl.applyHighlight(range1, 'yellow');
        
        let calls = chrome.storage.local.set.mock.calls;
        let pages = calls[calls.length - 1].arguments[0].pages;
        chrome.storage.local.get = mock.fn(async () => ({ pages }));

        
        
        const mark = container.querySelector('.marklet-highlight');
        const range2 = document.createRange();
        range2.setStart(mark.firstChild, 1);
        range2.setEnd(mark.firstChild, 5);
        
        await hl.applyHighlight(range2, 'green');
        
        calls = chrome.storage.local.set.mock.calls;
        pages = calls[calls.length - 1].arguments[0].pages;
        let highlights = pages['http://localhost'].highlights;
        
        
        assert.strictEqual(highlights.length, 3);
        
        highlights.sort((a, b) => a.start - b.start);
        
        assert.strictEqual(highlights[0].start, 0);
        assert.strictEqual(highlights[0].text, 'H');
        assert.strictEqual(highlights[0].color, 'yellow');
        
        assert.strictEqual(highlights[1].start, 1);
        assert.strictEqual(highlights[1].text, 'ello');
        assert.strictEqual(highlights[1].color, 'green');
        
        assert.strictEqual(highlights[2].start, 5);
        assert.strictEqual(highlights[2].text, ' World'); 
        assert.strictEqual(highlights[2].color, 'yellow');
    });
});
