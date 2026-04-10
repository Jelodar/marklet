const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('Highlighter Restoration', () => {
    let appMock;
    let highlighter;

    beforeEach(() => {
        mockStorage.clear();
        document.body.innerHTML = '<div>Target Text</div><div>Another Text</div>';
        appMock = {
            shadowHost: document.createElement('div'),
            hasHighlights: false,
            pauseObserver: mock.fn(),
            resumeObserver: mock.fn(),
            updateObserverState: mock.fn(),
            ui: { trackRecentColor: mock.fn(), hideSelectionToolbar: mock.fn() },
            isSavable: true
        };
        highlighter = new Highlighter(appMock);
    });

    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should restore highlight if text matches exactly', async () => {
        const url = SharedUtils.normalizeUrl(window.location.href);
        const highlights = [{
            id: '1',
            url,
            color: '#FFFF00',
            text: 'Target Text',
            anchor: { startPath: 'DIV[0]/#text[0]', startOffset: 0, endPath: 'DIV[0]/#text[0]', endOffset: 11 },
            start: 0,
            docLength: 20
        }];

        await tinyIDB.set(url, { highlights, url });

        await highlighter.loadHighlights();

        const marks = document.querySelectorAll('.marklet-highlight');
        assert.strictEqual(marks.length, 1);
        assert.strictEqual(marks[0].textContent, 'Target Text');
    });

    it('should NOT restore highlight if text does not match stored text', async () => {
        document.body.innerHTML = '<div>Changed Text</div><div>Another Text</div>';

        const url = SharedUtils.normalizeUrl(window.location.href);
        const highlights = [{
            id: '1',
            url,
            color: '#FFFF00',
            text: 'Target Text',
            anchor: { startPath: 'DIV[0]/#text[0]', startOffset: 0, endPath: 'DIV[0]/#text[0]', endOffset: 11 },
            start: 0,
            docLength: 20
        }];

        await tinyIDB.set(url, { highlights, url });

        await highlighter.loadHighlights();

        const marks = document.querySelectorAll('.marklet-highlight');
        assert.strictEqual(marks.length, 0);
    });

    it('should restore highlight if text matches despite whitespace differences', async () => {
        document.body.innerHTML = '<div>  Target   Text  </div>';

        const url = SharedUtils.normalizeUrl(window.location.href);
        const highlights = [{
            id: '1',
            url,
            color: '#FFFF00',
            text: '  Target   Text  ',
            anchor: { startPath: 'DIV[0]/#text[0]', startOffset: 2, endPath: 'DIV[0]/#text[0]', endOffset: 15 },
            start: 2,
            docLength: 30
        }];

        await tinyIDB.set(url, { highlights, url });

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

describe('Highlighter.isEditable', () => {
    let highlighter;

    beforeEach(() => {
        highlighter = new Highlighter({ init: () => {}, shadow: {}, shadowHost: {}, pauseObserver: () => {}, resumeObserver: () => {}, updateObserverState: () => {}, ui: {} });
    });

    it('should identify normal input as editable', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        assert.strictEqual(highlighter.isEditable(input), true);
        input.remove();
    });

    it('should identify readonly input as NOT editable when allowReadonly is true (default)', () => {
        const input = document.createElement('input');
        input.readOnly = true;
        document.body.appendChild(input);
        highlighter.allowReadonly = true;
        assert.strictEqual(highlighter.isEditable(input), false);
        input.remove();
    });

    it('should identify readonly input as editable when allowReadonly is false', () => {
        const input = document.createElement('input');
        input.readOnly = true;
        document.body.appendChild(input);
        highlighter.allowReadonly = false;
        assert.strictEqual(highlighter.isEditable(input), true);
        input.remove();
    });

    it('should identify contentEditable as editable', () => {
        const div = document.createElement('div');
        div.setAttribute('contenteditable', 'true');
        document.body.appendChild(div);
        assert.strictEqual(highlighter.isEditable(div), true);
        div.remove();
    });
});
