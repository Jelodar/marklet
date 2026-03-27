const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Background Script', () => {

    let listeners = {};

    beforeEach(() => {
        listeners = {
            onInstalled: [],
            onClicked: [],
            onHistoryStateUpdated: [],
            onReferenceFragmentUpdated: []
        };
        
        global.chrome = {
            runtime: {
                onInstalled: { addListener: fn => listeners.onInstalled.push(fn) },
                onMessage: { addListener: mock.fn() }
            },
            contextMenus: {
                create: mock.fn(),
                onClicked: { addListener: fn => listeners.onClicked.push(fn) }
            },
            webNavigation: {
                onHistoryStateUpdated: { addListener: fn => listeners.onHistoryStateUpdated.push(fn) },
                onReferenceFragmentUpdated: { addListener: fn => listeners.onReferenceFragmentUpdated.push(fn) }
            },
            tabs: {
                sendMessage: mock.fn(() => Promise.resolve())
            }
        };
        
        delete require.cache[require.resolve('../background.js')];
        require('../background.js');
    });

    it('should register context menus on install', () => {
        const onInstalled = listeners.onInstalled[0];
        onInstalled();
        
        assert.strictEqual(global.chrome.contextMenus.create.mock.calls.length, 2);
        assert.strictEqual(global.chrome.contextMenus.create.mock.calls[0].arguments[0].id, 'marklet-highlight');
        assert.strictEqual(global.chrome.contextMenus.create.mock.calls[1].arguments[0].id, 'marklet-toggle-whiteboard');
    });

    it('should handle context menu clicks', () => {
        const onClicked = listeners.onClicked[0];
        
        onClicked({ menuItemId: 'marklet-highlight' }, { id: 123 });
        assert.strictEqual(global.chrome.tabs.sendMessage.mock.calls.length, 1);
        assert.deepStrictEqual(global.chrome.tabs.sendMessage.mock.calls[0].arguments[1], { type: 'APPLY_HIGHLIGHT_CONTEXT', color: 'rgba(255, 255, 0, 0.4)' });

        onClicked({ menuItemId: 'marklet-toggle-whiteboard' }, { id: 123 });
        assert.strictEqual(global.chrome.tabs.sendMessage.mock.calls.length, 2);
        assert.deepStrictEqual(global.chrome.tabs.sendMessage.mock.calls[1].arguments[1], { type: 'TOGGLE_WHITEBOARD_CONTEXT' });
    });

    it('should handle navigation events', () => {
        const onHistory = listeners.onHistoryStateUpdated[0];
        onHistory({ frameId: 0, url: 'http://example.com/page', tabId: 456 });
        
        assert.strictEqual(global.chrome.tabs.sendMessage.mock.calls.length, 1);
        assert.deepStrictEqual(global.chrome.tabs.sendMessage.mock.calls[0].arguments[1], { type: 'URL_CHANGED', url: 'http://example.com/page' });
        
        const onFragment = listeners.onReferenceFragmentUpdated[0];
        onFragment({ frameId: 0, url: 'http://example.com/page#frag', tabId: 456 });
        
        assert.strictEqual(global.chrome.tabs.sendMessage.mock.calls.length, 2);
        assert.deepStrictEqual(global.chrome.tabs.sendMessage.mock.calls[1].arguments[1], { type: 'URL_CHANGED', url: 'http://example.com/page#frag' });
    });
});
