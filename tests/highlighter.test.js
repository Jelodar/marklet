const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('Highlighter Restoration', () => {
    let appMock;
    let highlighter;

    beforeEach(() => {
        document.body.innerHTML = '<div>Target Text</div><div>Another Text</div>';
        appMock = {
            shadowHost: document.createElement('div'),
            hasHighlights: false,
            pauseObserver: mock.fn(),
            resumeObserver: mock.fn(),
            updateObserverState: mock.fn(),
            ui: { trackRecentColor: mock.fn(), hideSelectionToolbar: mock.fn() }
        };
        highlighter = new Highlighter(appMock);
    });

    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should restore highlight if text matches exactly', async () => {
        const url = 'http://localhost';
        const highlights = [{
            id: '1',
            url,
            color: '#FFFF00',
            text: 'Target Text',
            anchor: { startPath: 'DIV[0]/#text[0]', startOffset: 0, endPath: 'DIV[0]/#text[0]', endOffset: 11 },
            start: 0,
            docLength: 20
        }];

        chrome.storage.local.get = mock.fn((keys, cb) => {
            const res = { pages: { [url]: { highlights } } };
            if (cb) cb(res);
            return Promise.resolve(res);
        });

        await highlighter.loadHighlights();

        const marks = document.querySelectorAll('.marklet-highlight');
        assert.strictEqual(marks.length, 1);
        assert.strictEqual(marks[0].textContent, 'Target Text');
    });

    it('should NOT restore highlight if text does not match stored text', async () => {
        document.body.innerHTML = '<div>Changed Text</div><div>Another Text</div>';

        const url = 'http://localhost';
        const highlights = [{
            id: '1',
            url,
            color: '#FFFF00',
            text: 'Target Text',
            anchor: { startPath: 'DIV[0]/#text[0]', startOffset: 0, endPath: 'DIV[0]/#text[0]', endOffset: 11 },
            start: 0,
            docLength: 20
        }];

        chrome.storage.local.get = mock.fn((keys, cb) => {
            const res = { pages: { [url]: { highlights } } };
            if (cb) cb(res);
            return Promise.resolve(res);
        });

        await highlighter.loadHighlights();

        const marks = document.querySelectorAll('.marklet-highlight');
        assert.strictEqual(marks.length, 0);
    });

    it('should restore highlight if text matches despite whitespace differences', async () => {
        document.body.innerHTML = '<div>  Target   Text  </div>';

        const url = 'http://localhost';
        const highlights = [{
            id: '1',
            url,
            color: '#FFFF00',
            text: 'Target Text',
            anchor: { startPath: 'DIV[0]/#text[0]', startOffset: 2, endPath: 'DIV[0]/#text[0]', endOffset: 15 },
            start: 2,
            docLength: 30
        }];

        chrome.storage.local.get = mock.fn((keys, cb) => {
            const res = { pages: { [url]: { highlights } } };
            if (cb) cb(res);
            return Promise.resolve(res);
        });

        await highlighter.loadHighlights();

        const marks = document.querySelectorAll('.marklet-highlight');
        assert.strictEqual(marks.length, 1);
        assert.strictEqual(marks[0].textContent, 'Target   Text');
    });

    it('should show edit toolbar after applying highlight', async () => {
        document.body.innerHTML = '<div>Target Text</div>';
        const range = document.createRange();
        const textNode = document.body.firstChild.firstChild;
        range.setStart(textNode, 0);
        range.setEnd(textNode, 6); 

        
        appMock.ui.showEditToolbar = mock.fn();
        appMock.ui.hideSelectionToolbar = mock.fn();
        appMock.ui.trackRecentColor = mock.fn();

        
        const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;
        Range.prototype.getBoundingClientRect = () => ({ left: 10, top: 10, width: 50, height: 20 });

        
        chrome.storage.local.get = mock.fn((keys) => Promise.resolve({ pages: {} }));
        chrome.storage.local.set = mock.fn(() => Promise.resolve());

        try {
            await highlighter.applyHighlight(range, '#FF0000');
        } finally {
            Range.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        }

        
        assert.strictEqual(appMock.ui.showEditToolbar.mock.calls.length, 1, 'showEditToolbar should be called once');
        const args = appMock.ui.showEditToolbar.mock.calls[0].arguments;
        assert.strictEqual(args[0], 35); 
        assert.strictEqual(args[1], 10); 
        assert.ok(args[2], 'Should provide an ID');

        assert.strictEqual(appMock.ui.hideSelectionToolbar.mock.calls.length, 0, 'hideSelectionToolbar should not be called if edit toolbar is shown');
    });
});
