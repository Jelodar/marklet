const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

global.window.getSelection = () => ({
    rangeCount: 1,
    getRangeAt: () => ({
        startContainer: document.body,
        endContainer: document.body,
        commonAncestorContainer: document.body,
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100 }),
        toString: () => "selected text"
    }),
    removeAllRanges: () => {},
    toString: () => "selected text",
    isCollapsed: false
});

describe('Marklet Hotkeys & Delete Handling', () => {
    let marklet;

    beforeEach(async () => {
        document.body.innerHTML = '';
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = { extensionEnabled: true };
             if (callback) callback(res);
             return Promise.resolve(res);
        });
        chrome.storage.local.set = mock.fn(async () => {});
        
        marklet = new Marklet();
        await new Promise(resolve => setTimeout(resolve, 50));
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should use default hotkey (Alt+H) to highlight selection', async () => {
        let applyHighlightCalled = false;
        marklet.highlighter.applyHighlight = () => { applyHighlightCalled = true; };
        marklet.highlighter.isValidSelection = () => true;

        const event = new window.KeyboardEvent('keydown', {
            key: 'h',
            code: 'KeyH',
            altKey: true,
            bubbles: true
        });

        document.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(applyHighlightCalled, true, "Alt+H should trigger highlight");
    });

    it('should use default hotkey (Alt+Shift+W) to toggle whiteboard', async () => {
        const initialStatus = marklet.whiteboardActive;
        const event = new window.KeyboardEvent('keydown', {
            key: 'w',
            code: 'KeyW',
            altKey: true,
            shiftKey: true,
            bubbles: true
        });

        document.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.notStrictEqual(marklet.whiteboardActive, initialStatus, "Alt+Shift+W should toggle whiteboard");
    });

    it('should consume matching hotkeys so the page cannot process them when whiteboard is off', async () => {
        let applyHighlightCalled = false;
        let immediateStopped = false;
        let propagationStopped = false;
        let defaultPrevented = false;
        marklet.highlighter.applyHighlight = () => { applyHighlightCalled = true; };
        marklet.highlighter.isValidSelection = () => true;

        const event = new window.KeyboardEvent('keydown', {
            key: 'h',
            code: 'KeyH',
            altKey: true,
            bubbles: true,
            cancelable: true
        });

        event.stopImmediatePropagation = () => { immediateStopped = true; };
        event.stopPropagation = () => { propagationStopped = true; };
        event.preventDefault = () => { defaultPrevented = true; };

        document.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 20));

        assert.strictEqual(applyHighlightCalled, true, "Matching hotkey should still trigger Marklet");
        assert.strictEqual(immediateStopped, true, "Matching hotkey should stop immediate propagation");
        assert.strictEqual(propagationStopped, true, "Matching hotkey should stop propagation");
        assert.strictEqual(defaultPrevented, true, "Matching hotkey should prevent default");
    });

    it('should consume keyup for matching hotkeys so sites cannot react on release', async () => {
        let immediateStopped = false;
        let propagationStopped = false;
        let defaultPrevented = false;

        const event = new window.KeyboardEvent('keyup', {
            key: 'h',
            code: 'KeyH',
            altKey: true,
            bubbles: true,
            cancelable: true
        });

        event.stopImmediatePropagation = () => { immediateStopped = true; };
        event.stopPropagation = () => { propagationStopped = true; };
        event.preventDefault = () => { defaultPrevented = true; };

        document.dispatchEvent(event);

        assert.strictEqual(immediateStopped, true, "Hotkey release should stop immediate propagation");
        assert.strictEqual(propagationStopped, true, "Hotkey release should stop propagation");
        assert.strictEqual(defaultPrevented, true, "Hotkey release should prevent default");
    });

    it('should update hotkeys from storage changes without re-reading storage on keydown', async () => {
        let applyHighlightCalled = false;
        marklet.highlighter.applyHighlight = () => { applyHighlightCalled = true; };
        marklet.highlighter.isValidSelection = () => true;

        const listeners = chrome.storage.onChanged.addListener.mock.calls.map(call => call.arguments[0]);
        listeners.forEach(listener => listener({ hotkeys: { newValue: { highlight: 'Alt+J' } } }));

        const callsBeforeKeydown = chrome.storage.local.get.mock.calls.length;
        const event = new window.KeyboardEvent('keydown', {
            key: 'j',
            code: 'KeyJ',
            altKey: true,
            bubbles: true
        });

        document.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 20));

        assert.strictEqual(applyHighlightCalled, true, "Updated hotkey should trigger highlight");
        assert.strictEqual(chrome.storage.local.get.mock.calls.length, callsBeforeKeydown, "Keydown should not fetch hotkeys from storage");
    });

    it('should hide drawing toolbar when Delete key is pressed on selected stroke', async () => {
        marklet.whiteboard.active = true;
        marklet.whiteboardActive = true;
        marklet.whiteboard.mode = 'select';
        marklet.whiteboard.selectedStroke = { type: 'draw', points: [] };
        marklet.whiteboard.strokes = [marklet.whiteboard.selectedStroke];

        let hideToolbarCalled = false;
        marklet.ui.hideDrawingToolbar = () => { hideToolbarCalled = true; };

        const event = new KeyboardEvent('keydown', {
            key: 'Delete',
            code: 'Delete',
            bubbles: true
        });

        document.dispatchEvent(event);

        assert.strictEqual(hideToolbarCalled, true, "Delete key should hide drawing toolbar");
        assert.strictEqual(marklet.whiteboard.selectedStroke, null, "Selected stroke should be null after delete");
    });

     it('should hide drawing toolbar when Backspace key is pressed on selected stroke', async () => {
        marklet.whiteboard.active = true;
        marklet.whiteboardActive = true;
        marklet.whiteboard.mode = 'select';
        marklet.whiteboard.selectedStroke = { type: 'draw', points: [] };
        marklet.whiteboard.strokes = [marklet.whiteboard.selectedStroke];

        let hideToolbarCalled = false;
        marklet.ui.hideDrawingToolbar = () => { hideToolbarCalled = true; };

        const event = new KeyboardEvent('keydown', {
            key: 'Backspace',
            code: 'Backspace',
            bubbles: true
        });

        document.dispatchEvent(event);

        assert.strictEqual(hideToolbarCalled, true, "Backspace key should hide drawing toolbar");
        assert.strictEqual(marklet.whiteboard.selectedStroke, null, "Selected stroke should be null after delete");
    });
});
