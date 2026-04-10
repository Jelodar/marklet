const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('assert');
require('./test-setup.js');

class TestHighlighter extends Highlighter {
    constructor() {
        super({ 
            ui: { trackRecentColor: () => {}, hideSelectionToolbar: () => {}, showEditToolbar: () => {} }, 
            pauseObserver: () => {}, 
            resumeObserver: () => {}, 
            updateObserverState: () => {},
            hasHighlights: false,
            isSavable: true
        });
    }
    async loadHighlights() {} 
}

describe('Highlighter Integration', () => {
    let hl;
    let container;

    beforeEach(() => {
        container = document.getElementById('content');
        if (!container) {
            container = document.createElement('div');
            container.id = 'content';
            document.body.appendChild(container);
        }
        container.innerHTML = 'Hello World';
        
        tinyIDB.get = mock.fn(async () => ({ highlights: [], url: 'http://localhost' }));
        tinyIDB.set = mock.fn(async () => {});
        
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

        
        let calls = tinyIDB.set.mock.calls;
        let lastCall = calls[calls.length - 1];
        let page = lastCall.arguments[1];
        let highlights = page.highlights;
        assert.strictEqual(highlights.length, 1);
        assert.strictEqual(highlights[0].start, 0);
        assert.strictEqual(highlights[0].text, 'Hello');

        
        tinyIDB.get = mock.fn(async () => page);

        
        const mark = container.querySelector('.marklet-highlight');
        const rangeOverlap = document.createRange();
        rangeOverlap.setStart(mark.firstChild, 1);
        rangeOverlap.setEnd(mark.firstChild, 5);
        
        await hl.applyHighlight(rangeOverlap, 'yellow');
        
        
        calls = tinyIDB.set.mock.calls;
        lastCall = calls[calls.length - 1];
        page = lastCall.arguments[1];
        highlights = page.highlights;
        
        assert.strictEqual(highlights.length, 1);
        assert.strictEqual(highlights[0].start, 0);
        assert.strictEqual(highlights[0].text, 'Hello');
    });

    it('should merge adjacent highlights of same color', async () => {
        
        const range1 = document.createRange();
        range1.setStart(container.firstChild, 0);
        range1.setEnd(container.firstChild, 5);
        await hl.applyHighlight(range1, 'yellow');
        
        let calls = tinyIDB.set.mock.calls;
        let page = calls[calls.length - 1].arguments[1];
        tinyIDB.get = mock.fn(async () => page);

        
        
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
        
        calls = tinyIDB.set.mock.calls;
        page = calls[calls.length - 1].arguments[1];
        let highlights = page.highlights;
        
        
        assert.strictEqual(highlights.length, 1);
        assert.strictEqual(highlights[0].start, 0);
        assert.strictEqual(highlights[0].text, 'Hello World');
    });

    it('should split existing highlight when inserting different color inside', async () => {
        
        const range1 = document.createRange();
        range1.setStart(container.firstChild, 0);
        range1.setEnd(container.firstChild, 11);
        await hl.applyHighlight(range1, 'yellow');
        
        let calls = tinyIDB.set.mock.calls;
        let page = calls[calls.length - 1].arguments[1];
        tinyIDB.get = mock.fn(async () => page);

        
        
        const mark = container.querySelector('.marklet-highlight');
        const range2 = document.createRange();
        range2.setStart(mark.firstChild, 1);
        range2.setEnd(mark.firstChild, 5);
        
        await hl.applyHighlight(range2, 'green');
        
        calls = tinyIDB.set.mock.calls;
        page = calls[calls.length - 1].arguments[1];
        let highlights = page.highlights;
        
        
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
