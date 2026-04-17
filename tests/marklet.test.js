const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Marklet', () => {
    let marklet;

    beforeEach(() => {
        document.body.innerHTML = '';
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = {};
             if (callback) callback(res);
             return Promise.resolve(res);
        });
        chrome.storage.local.set = mock.fn(async () => {});
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should initialize correctly when extension is enabled', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true, enableByDefault: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        assert.ok(marklet.whiteboard);
        assert.ok(marklet.highlighter);
        assert.ok(marklet.ui);
        assert.ok(document.getElementById('marklet-root'));
    });

    it('should not initialize when extension is globally disabled', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = { extensionEnabled: false };
             if (callback) callback(res);
             return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(marklet.whiteboard, undefined);
    });

    it('should not initialize when site is disabled by default and not in enabled list', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = { extensionEnabled: true, enableByDefault: false, enabledSites: [] };
             if (callback) callback(res);
             return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(marklet.whiteboard, undefined);
    });

    it('should initialize when site is disabled by default but IS in enabled list', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = { extensionEnabled: true, enableByDefault: false, enabledSites: ['localhost'] };
             if (callback) callback(res);
             return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        assert.ok(marklet.whiteboard);
    });

    it('should remove highlights when extension is disabled', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        const mark = document.createElement('mark');
        mark.className = 'marklet-highlight';
        document.body.appendChild(mark);
        assert.strictEqual(document.querySelectorAll('.marklet-highlight').length, 1);

        marklet.toggleExtension(false);

        assert.strictEqual(document.querySelectorAll('.marklet-highlight').length, 0);
    });

    it('should call hideDrawingToolbar when whiteboard is disabled', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        let hideCalled = false;
        marklet.ui.hideDrawingToolbar = () => { hideCalled = true; };

        marklet.whiteboard.toggle(true);
        marklet.whiteboard.toggle(false);

        assert.strictEqual(hideCalled, true);
    });

    it('should NOT start MutationObserver initially if no highlights', async () => {
        let observeCalled = false;
        
        const OriginalObserver = global.MutationObserver;
        global.MutationObserver = class MutationObserver {
            constructor(cb) {}
            observe() { observeCalled = true; }
            disconnect() {}
        };

        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        assert.strictEqual(observeCalled, false);
        
        global.MutationObserver = OriginalObserver;
    });

    it('should start MutationObserver when whiteboard is activated', async () => {
        let observeCalled = false;
        const OriginalObserver = global.MutationObserver;
        global.MutationObserver = class MutationObserver {
            constructor(cb) {}
            observe() { observeCalled = true; }
            disconnect() {}
        };

        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        marklet.ui.toggleWhiteboardMode(true);
        marklet.whiteboardActive = true;
        marklet.updateObserverState();

        assert.strictEqual(observeCalled, true);
        
        global.MutationObserver = OriginalObserver;
    });

    it('should only reload when the normalized url identity changes', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true, enableByDefault: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        const handleUrlChange = mock.method(marklet, 'handleUrlChange', () => {});

        marklet.lastUrl = 'http://localhost';
        marklet.handleObservedUrlChange('http://localhost#section');
        assert.strictEqual(handleUrlChange.mock.calls.length, 0);

        marklet.handleObservedUrlChange('http://localhost/first');
        assert.strictEqual(handleUrlChange.mock.calls.length, 1);

        await marklet.toggleExtension(false);
        await marklet.toggleExtension(true);
        await new Promise(resolve => setImmediate(resolve));

        marklet.handleObservedUrlChange('http://localhost/second');
        assert.strictEqual(handleUrlChange.mock.calls.length, 2);
    });

    it('should pause MutationObserver when whiteboard exits from the dock', async () => {
        let observeCalled = 0;
        let disconnectCalled = 0;
        const OriginalObserver = global.MutationObserver;
        global.MutationObserver = class MutationObserver {
            constructor(cb) {}
            observe() { observeCalled++; }
            disconnect() { disconnectCalled++; }
        };

        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true, enableByDefault: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        marklet.whiteboardActive = true;
        marklet.ui.toggleWhiteboardMode(true);
        marklet.updateObserverState();

        assert.strictEqual(observeCalled, 1);
        assert.strictEqual(marklet.observerPaused, false);

        marklet.ui.dock.querySelector('#btn-exit-whiteboard').click();

        assert.strictEqual(marklet.whiteboardActive, false);
        assert.strictEqual(marklet.observerPaused, true);
        assert.strictEqual(disconnectCalled, 1);

        global.MutationObserver = OriginalObserver;
    });

    it('should remove the storage listener on destroy', async () => {
        chrome.storage.local.get = mock.fn((keys, callback) => {
            const res = { extensionEnabled: true, enableByDefault: true };
            if (callback) callback(res);
            return Promise.resolve(res);
        });

        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));

        const addedListener = chrome.storage.onChanged.addListener.mock.calls.at(-1).arguments[0];
        marklet.destroyAll();

        const removedCall = chrome.storage.onChanged.removeListener.mock.calls.find(call => call.arguments[0] === addedListener);
        assert.ok(removedCall);
    });
});
