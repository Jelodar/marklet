const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Highlighter Rendering & Utilities', () => {
    let highlighter;
    let appMock;

    beforeEach(() => {
        appMock = {
            shadowHost: document.createElement('div'),
            hasHighlights: false,
            pauseObserver: mock.fn(),
            resumeObserver: mock.fn(),
            updateObserverState: mock.fn(),
            ui: { trackRecentColor: mock.fn(), hideEditToolbar: mock.fn(), showEditToolbar: mock.fn() }
        };
        highlighter = new Highlighter(appMock);
    });

    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should calculate contrast color correctly', () => {
        assert.strictEqual(highlighter.getContrastColor('#000000'), 'white');
        assert.strictEqual(highlighter.getContrastColor('#FFFFFF'), 'black');
        assert.strictEqual(highlighter.getContrastColor('#FFFF00'), 'black');
        assert.strictEqual(highlighter.getContrastColor('#000080'), 'white');
        
        assert.strictEqual(highlighter.getContrastColor('rgb(0, 0, 0)'), 'white');
        assert.strictEqual(highlighter.getContrastColor('rgb(255, 255, 255)'), 'black');
        
        assert.strictEqual(highlighter.getContrastColor(null), 'black');
    });

    it('should handle gotoHighlight scroll and flash', () => {
        document.body.innerHTML = '<mark class="marklet-highlight" data-id="123">Test</mark>';
        const mark = document.querySelector('mark');
        mark.scrollIntoView = mock.fn();
        
        highlighter.gotoHighlight('123');
        
        assert.strictEqual(mark.scrollIntoView.mock.calls.length, 1);
        assert.ok(mark.classList.contains('marklet-spotlight'));
    });

    it('should change color of existing highlight', async () => {
        document.body.innerHTML = 'Test';
        const url = 'http://localhost';
        const h = {
            id: '1', url, color: '#FFFF00', text: 'Test',
            anchor: { startPath: '#text[0]', startOffset: 0, endPath: '#text[0]', endOffset: 4 },
            start: 0
        };
        
        chrome.storage.local.get = mock.fn((keys, cb) => {
            const res = { pages: { [url]: { highlights: [h] } } };
            return Promise.resolve(res);
        });
        
        const setSpy = mock.method(chrome.storage.local, 'set');
        
        await highlighter.changeColor('1', '#FF0000');
        
        assert.strictEqual(setSpy.mock.calls.length, 1);
        const args = setSpy.mock.calls[0].arguments[0];
        assert.strictEqual(args.pages[url].highlights[0].color, '#FF0000');
    });

    it('should delete highlight', async () => {
        const url = 'http://localhost';
        const h = {
            id: '1', url, color: '#FFFF00', text: 'Test',
            anchor: { startPath: '#text[0]', startOffset: 0, endPath: '#text[0]', endOffset: 4 },
            start: 0
        };
        
        chrome.storage.local.get = mock.fn((keys, cb) => {
            const res = { pages: { [url]: { highlights: [h] } } };
            return Promise.resolve(res);
        });
        
        const setSpy = mock.method(chrome.storage.local, 'set');
        
        await highlighter.deleteHighlight('1');
        
        assert.strictEqual(setSpy.mock.calls.length, 1);
        const args = setSpy.mock.calls[0].arguments[0];
        assert.strictEqual(args.pages[url], undefined);
    });
});
