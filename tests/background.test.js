const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Background Script', () => {

    let listeners = {};

    beforeEach(() => {
        listeners = {
            onInstalled: [],
            onClicked: [],
            onMessage: [],
            onHistoryStateUpdated: [],
            onReferenceFragmentUpdated: []
        };

        global.PageStorage = {
            keys: mock.fn(async () => []),
            entries: mock.fn(async () => []),
            count: mock.fn(async () => 0),
            get: mock.fn(async () => undefined),
            getBatch: mock.fn(async () => []),
            set: mock.fn(async () => undefined),
            remove: mock.fn(async () => undefined),
            update: mock.fn(async () => undefined),
            clear: mock.fn(async () => undefined),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 25 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 0, total: 0 })),
            clearPages: mock.fn(async () => 0),
            raw: {
                get: mock.fn(async () => undefined),
                getBatch: mock.fn(async () => []),
                set: mock.fn(async () => undefined),
                remove: mock.fn(async () => undefined),
                update: mock.fn(async () => undefined),
                clear: mock.fn(async () => undefined)
            }
        };
        
        global.chrome = {
            runtime: {
                onInstalled: { addListener: fn => listeners.onInstalled.push(fn) },
                onMessage: { addListener: fn => listeners.onMessage.push(fn) }
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
                query: mock.fn((queryInfo, callback) => callback([])),
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
        assert.deepStrictEqual(global.chrome.tabs.sendMessage.mock.calls[0].arguments[1], { type: 'APPLY_HIGHLIGHT_CONTEXT', color: '#ffff00' });

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

    it('should return structured db errors', async () => {
        const onMessage = listeners.onMessage[0];
        global.PageStorage.get = mock.fn(async () => {
            throw new Error('db failed');
        });

        const response = await new Promise(resolve => onMessage({ type: 'DB_GET', key: 'http://example.com' }, {}, resolve));

        assert.deepStrictEqual(response, { ok: false, error: 'db failed' });
    });

    it('should notify only tabs whose normalized url matches the updated page', async () => {
        const onMessage = listeners.onMessage[0];
        global.chrome.tabs.query = mock.fn((queryInfo, callback) => callback([
            { id: 1, url: 'http://example.com/page?utm_source=test' },
            { id: 2, url: 'http://example.com/other' },
            { id: 3, url: 'http://example.com/page' }
        ]));

        const response = await new Promise(resolve => onMessage({
            type: 'DB_SET',
            key: 'http://example.com/page',
            value: { url: 'http://example.com/page', highlights: [], drawings: [] }
        }, { tab: { id: 3 } }, resolve));

        assert.deepStrictEqual(response, { ok: true, value: undefined });
        assert.strictEqual(global.chrome.tabs.sendMessage.mock.calls.length, 1);
        assert.strictEqual(global.chrome.tabs.sendMessage.mock.calls[0].arguments[0], 1);
        assert.deepStrictEqual(global.chrome.tabs.sendMessage.mock.calls[0].arguments[1], {
            type: 'PAGE_UPDATED_SYNC',
            url: 'http://example.com/page'
        });
    });
});
