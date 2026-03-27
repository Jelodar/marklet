const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('Whiteboard Event Blocking', () => {
    let marklet;

    beforeEach(() => {
        document.body.innerHTML = '';
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = { extensionEnabled: true };
             if (callback) callback(res);
             return Promise.resolve(res);
        });
        chrome.storage.local.set = mock.fn(async () => {});
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should stop event propagation when whiteboard is active', async () => {
        marklet = new Marklet();
        await new Promise(resolve => setTimeout(resolve, 50));

        marklet.whiteboardActive = true;

        let propagationStopped = false;
        const event = new window.KeyboardEvent('keydown', {
            key: 'a',
            bubbles: true,
            cancelable: true
        });

        event.stopImmediatePropagation = () => { propagationStopped = true; };

        document.dispatchEvent(event);

        assert.strictEqual(propagationStopped, true, "Should call stopImmediatePropagation when whiteboard is active");
    });

    it('should NOT stop event propagation when whiteboard is inactive', async () => {
        marklet = new Marklet();
        await new Promise(resolve => setTimeout(resolve, 50));

        marklet.whiteboardActive = false;

        let propagationStopped = false;
        const event = new window.KeyboardEvent('keydown', {
            key: 'a',
            bubbles: true,
            cancelable: true
        });

        event.stopImmediatePropagation = () => { propagationStopped = true; };

        document.dispatchEvent(event);

        assert.strictEqual(propagationStopped, false, "Should NOT call stopImmediatePropagation when whiteboard is inactive");
    });
});