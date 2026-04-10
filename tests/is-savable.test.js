const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Savability Logic', () => {
    let marklet;

    beforeEach(() => {
        document.body.innerHTML = '';
        chrome.storage.local.get.mock.restore();
        chrome.storage.local.get = mock.fn(async () => ({ extensionEnabled: true, enableByDefault: true }));
        chrome.storage.local.set.mock.restore();
        chrome.storage.local.set = mock.fn(async () => {});
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should identify blob URLs as non-savable', () => {
        assert.strictEqual(SharedUtils.isSavable('blob:http://localhost/uuid'), false);
    });

    it('should identify data URLs as non-savable', () => {
        assert.strictEqual(SharedUtils.isSavable('data:text/plain,hello'), false);
    });

    it('should identify http URLs as savable', () => {
        assert.strictEqual(SharedUtils.isSavable('http://example.com'), true);
    });

    it('should identify chrome URLs as restricted', () => {
        assert.strictEqual(SharedUtils.isRestricted('chrome://settings'), true);
    });

    it('should identify about URLs as restricted', () => {
        assert.strictEqual(SharedUtils.isRestricted('about:config'), true);
    });

    it('should identify blob URLs as NOT restricted', () => {
        assert.strictEqual(SharedUtils.isRestricted('blob:http://localhost/uuid'), false);
    });

    it('should NOT save highlights to storage on non-savable page', async () => {
        const mockApp = {
            isSavable: false,
            pauseObserver: () => {},
            resumeObserver: () => {},
            updateObserverState: () => {},
            ui: { 
                trackRecentColor: () => {}, 
                showNotification: () => {},
                showEditToolbar: () => {},
                hideSelectionToolbar: () => {}
            },
            shadowHost: document.createElement('div')
        };
        
        const hl = new Highlighter(mockApp);
        
        const textNode = document.createTextNode('Hello World');
        document.body.appendChild(textNode);
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);

        await hl.applyHighlight(range, 'yellow');

        const setCalls = chrome.storage.local.set.mock.calls;
        const pagesCalls = setCalls.filter(c => c.arguments[0].pages);
        assert.strictEqual(pagesCalls.length, 0, 'Should NOT save to storage when app.isSavable is false');
        
        assert.strictEqual(hl.localPage.highlights.length, 1);
        assert.strictEqual(hl.localPage.highlights[0].text, 'Hello');
    });

    it('should NOT save drawings to storage on non-savable page', async () => {
        const mockApp = {
            isSavable: false,
            ui: { updateDockPreview: () => {}, updateDockBlendText: () => {} }
        };
        
        const wb = new Whiteboard(mockApp);
        wb.strokes = [{ type: 'draw', points: [{x:0, y:0}, {x:10, y:10}], color: 'red', width: 5 }];
        await wb.saveStrokes();

        const setCalls = chrome.storage.local.set.mock.calls;
        const pagesCalls = setCalls.filter(c => c.arguments[0].pages);
        assert.strictEqual(pagesCalls.length, 0, 'Should NOT save to storage when app.isSavable is false');
        
        assert.strictEqual(wb.localPage.drawings.length, 1);
    });
});
