const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');
require('./test-setup.js');

describe('Popup Logic', () => {
    let domContentLoadedCallback;

    beforeEach(() => {
        const dom = new JSDOM(`
            <div class="switch" id="extension-enable-toggle-wrapper">
                <input type="checkbox" id="extension-enable-toggle">
            </div>
            <div id="app-title-label"></div>
            <div class="switch">
                <input type="checkbox" id="site-enable-toggle">
                <span id="site-enable-label"></span>
            </div>
            <div id="site-enable-container"></div>
            <div id="whiteboard-container"><input type="checkbox" id="whiteboard-toggle"></div>
            <div id="highlights-visibility-container"><input type="checkbox" id="highlights-visibility"></div>
            <div id="drawings-visibility-container"><input type="checkbox" id="drawings-visibility"></div>
            <div id="highlights-list"></div>
            <input type="color" id="default-highlight-color">
            <input type="color" id="default-draw-color">
            <button id="clear-all-highlights"></button>
            <button id="clear-all-drawings"></button>
            <span id="highlights-count"></span>
            <span id="drawings-count"></span>
            <div id="selection-toolbar-container"><input type="checkbox" id="selection-toolbar-toggle"></div>
            <button id="open-settings"></button>
            <div id="selection-override-container"><button id="override-select-btn"></button></div>
            <div id="default-settings-container">
                <input type="text">
            </div>
        `, { url: 'http://example.com' });
        
        global.window = dom.window;
        global.document = dom.window.document;
        
        // Mock matchMedia for JSDOM
        global.window.matchMedia = mock.fn((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: mock.fn(),
            removeListener: mock.fn(),
            addEventListener: mock.fn(),
            removeEventListener: mock.fn(),
            dispatchEvent: mock.fn()
        }));
        
        global.chrome = {
            runtime: {
                openOptionsPage: mock.fn(),
                id: 'test-id',
                sendMessage: mock.fn((msg, cb) => cb && cb({ ok: true })),
                onMessage: { addListener: mock.fn() }
            },
            tabs: {
                query: mock.fn(() => Promise.resolve([{ id: 123, url: 'http://example.com' }])),
                sendMessage: mock.fn((id, message, callback) => {
                    if (typeof callback === 'function') callback({});
                    return Promise.resolve({});
                })
            },
            storage: {
                local: {
                    get: mock.fn(() => Promise.resolve({})),
                    set: mock.fn(() => Promise.resolve()),
                    clear: mock.fn(() => Promise.resolve())
                },
                onChanged: { addListener: mock.fn() }
            }
        };
        global.confirm = mock.fn(() => true);
        global.alert = mock.fn();
        if (global.PageStorage && global.PageStorage.importPages && global.PageStorage.importPages.mock) global.PageStorage.importPages.mock.resetCalls();
        if (global.PageStorage && global.PageStorage.clearPages && global.PageStorage.clearPages.mock) global.PageStorage.clearPages.mock.resetCalls();
        if (chrome.storage.local.clear && chrome.storage.local.clear.mock) chrome.storage.local.clear.mock.resetCalls();
        if (SharedUI.confirm && SharedUI.confirm.mock) SharedUI.confirm.mock.resetCalls();
        if (SharedUI.toast && SharedUI.toast.mock) SharedUI.toast.mock.resetCalls();
        
        // Mock addEventListener to capture the callback
        document.addEventListener = mock.fn((event, cb) => {
            if (event === 'DOMContentLoaded') {
                domContentLoadedCallback = cb;
            }
        });

        // Clear require cache for settings.js and popup.js to ensure fresh listeners
        delete require.cache[require.resolve('../settings/settings.js')];
        delete require.cache[require.resolve('../popup/popup.js')];
    });

    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should initialize controls based on storage', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true,
            highlightsVisible: false,
            pages: {}
        }));
        
        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const toggle = document.getElementById('extension-enable-toggle');
        assert.strictEqual(toggle.checked, true, 'Extension toggle should be checked');
        
        const hlToggle = document.getElementById('highlights-visibility');
        assert.strictEqual(hlToggle.checked, false, 'Highlights toggle should be unchecked');
    });

    it('should toggle extension enabled state', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({ extensionEnabled: true }));
        const setSpy = mock.method(chrome.storage.local, 'set');
        
        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const toggle = document.getElementById('extension-enable-toggle');
        toggle.click(); 
        
        assert.strictEqual(setSpy.mock.calls.length, 1);
        assert.strictEqual(setSpy.mock.calls[0].arguments[0].extensionEnabled, false);
    });

    it('should render popup highlight text as plain text', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        PageStorage.get = mock.fn(async () => ({
            highlights: [{ id: 'h-1', text: '<img src=x onerror="window.__popupXss = true">', color: '#ffff00' }],
            drawings: []
        }));

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        const text = document.querySelector('#highlights-list .highlight-text');
        assert.ok(text);
        assert.strictEqual(text.textContent, '<img src=x onerror="window.__popupXss = true">');
        assert.strictEqual(document.querySelector('#highlights-list img'), null);
    });

    it('should recover when popup state message fails', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        chrome.tabs.sendMessage = mock.fn((id, message, callback) => {
            chrome.runtime.lastError = { message: 'No receiver' };
            if (typeof callback === 'function') callback();
            delete chrome.runtime.lastError;
            return Promise.resolve();
        });

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(document.getElementById('whiteboard-toggle').checked, false);
        assert.strictEqual(document.getElementById('override-select-btn').textContent, 'Make All Text Selectable');
    });

    it('should normalize malformed popup page data', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        PageStorage.get = mock.fn(async () => ({
            highlights: 'bad-data',
            drawings: null
        }));

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(document.getElementById('highlights-count').textContent, '0');
        assert.strictEqual(document.getElementById('drawings-count').textContent, '0');
        assert.strictEqual(document.querySelector('#highlights-list img'), null);
    });

    it('should delete a popup highlight through PageStorage', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        PageStorage.get = mock.fn(async () => ({
            highlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
            drawings: [{ id: 'd-1' }]
        }));
        PageStorage.update = mock.fn(async () => undefined);

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.querySelector('#highlights-list .btn-delete').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(PageStorage.update.mock.calls[0].arguments[0], 'http://example.com');
        assert.strictEqual(PageStorage.update.mock.calls[0].arguments[1], 'delete_highlight');
        assert.deepStrictEqual(PageStorage.update.mock.calls[0].arguments[2], { id: 'h-1' });
    });

    it('should replace stale rows with the popup empty state after deleting the last highlight', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        let reads = 0;
        PageStorage.get = mock.fn(async () => {
            reads += 1;
            if (reads === 1) {
                return {
                    highlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
                    drawings: []
                };
            }
            return {
                highlights: [],
                drawings: []
            };
        });
        PageStorage.update = mock.fn(async () => undefined);
        SharedUI.confirm = mock.fn(async () => true);

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.querySelector('#highlights-list .btn-delete').click();
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(document.querySelectorAll('#highlights-list .highlight-item').length, 0);
        assert.strictEqual(document.getElementById('highlights-list').textContent.trim(), 'No highlights yet');
    });

    it('should clear popup highlights through PageStorage', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        PageStorage.get = mock.fn(async () => ({
            highlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
            drawings: []
        }));
        PageStorage.update = mock.fn(async () => undefined);

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.getElementById('clear-all-highlights').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(PageStorage.update.mock.calls[0].arguments[0], 'http://example.com');
        assert.strictEqual(PageStorage.update.mock.calls[0].arguments[1], 'clear_highlights');
    });

    it('should clear popup drawings through PageStorage', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        PageStorage.get = mock.fn(async () => ({
            highlights: [],
            drawings: [{ id: 'd-1' }]
        }));
        PageStorage.update = mock.fn(async () => undefined);

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.getElementById('clear-all-drawings').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(PageStorage.update.mock.calls[0].arguments[0], 'http://example.com');
        assert.strictEqual(PageStorage.update.mock.calls[0].arguments[1], 'clear_drawings');
    });

    it('should show a popup error when copying highlight text fails', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        global.navigator.clipboard = {
            writeText: mock.fn(async () => {
                throw new Error('clipboard denied');
            })
        };
        PageStorage.get = mock.fn(async () => ({
            highlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
            drawings: []
        }));

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.querySelector('#highlights-list .btn-copy').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.strictEqual(SharedUI.toast.mock.calls.at(-1).arguments[0], 'Could not copy highlight text.');
        assert.strictEqual(document.querySelector('#highlights-list .btn-copy').textContent, 'Copy');
    });

    it('should request an explicit selection override state and update the label from the response', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            extensionEnabled: true,
            enableByDefault: true
        }));
        chrome.tabs.sendMessage = mock.fn((id, message, callback) => {
            if (message.type === 'GET_STATE') {
                if (typeof callback === 'function') callback({ whiteboardActive: false, selectionOverrideActive: false });
                return Promise.resolve({ whiteboardActive: false, selectionOverrideActive: false });
            }
            if (message.type === 'TOGGLE_USER_SELECT') {
                if (typeof callback === 'function') callback({ selectionOverrideActive: true });
                return Promise.resolve({ selectionOverrideActive: true });
            }
            if (typeof callback === 'function') callback({});
            return Promise.resolve({});
        });

        require('../popup/popup.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.getElementById('override-select-btn').click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const toggleCall = chrome.tabs.sendMessage.mock.calls.find((call) => call.arguments[1].type === 'TOGGLE_USER_SELECT');
        assert.ok(toggleCall);
        assert.strictEqual(toggleCall.arguments[1].active, true);
        assert.strictEqual(document.getElementById('override-select-btn').textContent, 'Revert Text Selection Settings');
    });
});

describe('Settings Logic', () => {
    let domContentLoadedCallback;

    beforeEach(() => {
        const dom = new JSDOM(`
            <input type="checkbox" id="global-enable-toggle">
            <input type="checkbox" id="enable-by-default-toggle">
            <select id="theme-select"><option value="system">System</option><option value="light">Light</option></select>
            <input type="checkbox" id="shadows-toggle">
            <input type="checkbox" id="rounded-toggle">
            <input type="checkbox" id="readonly-highlight-toggle">
            <input type="checkbox" id="toolbar-toggle">
            <input type="color" id="default-highlight-color">
            <input type="color" id="default-draw-color">
            <input type="range" id="drawing-opacity">
            <span id="draw-opacity-val"></span>
            <select id="blend-mode-select"><option value="normal">Normal</option></select>
            <select id="url-hash-mode"><option value="ignore">Ignore</option><option value="include">Include</option></select>
            <input id="url-hash-site-input">
            <select id="url-hash-site-mode"><option value="include">Include</option><option value="ignore">Ignore</option></select>
            <button id="url-hash-site-add"></button>
            <button id="url-hash-reset"></button>
            <div id="url-hash-site-list"></div>
            <div id="url-hash-site-pagination"></div>
            <input id="disabled-site-input">
            <button id="disabled-site-add"></button>
            <button id="site-list-reset"></button>
            <span id="site-list-title"></span>
            <div id="disabled-sites-list"></div>
            <div id="disabled-sites-pagination"></div>
            <div id="annotation-pagination-top"></div>
            <div id="pages-list"></div>
            <div id="annotation-pagination-bottom"></div>
            <input type="text" id="page-search">
            <button id="export-btn"></button>
            <input type="checkbox" id="export-annotations-toggle" checked>
            <input type="checkbox" id="export-settings-toggle" checked>
            <button id="import-btn"></button>
            <input type="checkbox" id="import-settings-toggle" checked>
            <input type="file" id="import-file">
            <div id="data-feedback" hidden></div>
            <button id="clear-annotations-btn"></button>
            <button id="reset-defaults-btn"></button>
            <div id="loading-overlay" hidden></div>
            <div id="loading-title"></div>
            <div id="loading-text"></div>
            <div id="loading-progress"></div>
            <button id="loading-cancel"></button>
            <input id="hotkey-highlight">
            <input id="hotkey-whiteboard">
            <input id="hotkey-drawings">
            <input id="hotkey-highlights">
            <input id="hotkey-all">
        `, { url: 'http://example.com' });

        global.window = dom.window;
        global.document = dom.window.document;

        // Mock matchMedia for JSDOM
        global.window.matchMedia = mock.fn((query) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: mock.fn(),
            removeListener: mock.fn(),
            addEventListener: mock.fn(),
            removeEventListener: mock.fn(),
            dispatchEvent: mock.fn()
        }));

        global.alert = mock.fn();
        global.confirm = mock.fn(() => true);
        chrome.storage.local.clear = mock.fn(async () => {});
        
        if (SharedUI.confirm && SharedUI.confirm.mock) SharedUI.confirm.mock.resetCalls();
        if (SharedUI.toast && SharedUI.toast.mock) SharedUI.toast.mock.resetCalls();

        document.addEventListener = mock.fn((event, cb) => {
            if (event === 'DOMContentLoaded') {
                domContentLoadedCallback = cb;
            }
        });

        delete require.cache[require.resolve('../settings/settings.js')];
    });

    afterEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should load settings from storage', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            theme: 'light',
            urlHashMode: 'include',
            drawingOpacity: 50
        }));
        
        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        assert.strictEqual(document.getElementById('theme-select').value, 'light');
        assert.strictEqual(document.getElementById('url-hash-mode').value, 'include');
        assert.strictEqual(document.getElementById('drawing-opacity').value, '50');
    });

    it('should save setting on change', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        const setSpy = mock.method(chrome.storage.local, 'set');
        
        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const themeSelect = document.getElementById('theme-select');
        themeSelect.value = 'light';
        themeSelect.dispatchEvent(new window.Event('change'));
        
        assert.strictEqual(setSpy.mock.calls.length, 1);
        assert.strictEqual(setSpy.mock.calls[0].arguments[0].theme, 'light');
    });

    it('should save a site-specific hash rule', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        const setSpy = mock.method(chrome.storage.local, 'set');

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.getElementById('url-hash-site-input').value = 'https://mail.example.com/mail/#inbox';
        document.getElementById('url-hash-site-mode').value = 'include';
        document.getElementById('url-hash-site-add').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        const payload = setSpy.mock.calls.at(-1).arguments[0];
        assert.strictEqual(payload.urlHashMode, 'ignore');
        assert.deepStrictEqual(payload.urlHashSiteModes, { 'mail.example.com': 'include' });
    });

    it('should use runtime drawing defaults when storage is empty', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(document.getElementById('drawing-opacity').value, '75');
        assert.strictEqual(document.getElementById('blend-mode-select').value, 'normal');
    });

    it('should render stored settings page data as plain text and disable unsafe links', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.PageStorage = {
            count: mock.fn(async () => 1),
            queryPages: mock.fn(async () => ({
                items: [{
                    url: 'javascript:alert(1)',
                    highlights: [{ id: 'h-1', text: '<img src=x onerror="window.__settingsXss = true">', color: '#ff0000' }],
                    previewHighlights: [{ id: 'h-1', text: '<img src=x onerror="window.__settingsXss = true">', color: '#ff0000' }],
                    drawingCount: 0,
                    highlightCount: 1,
                    lastUpdated: 1
                }],
                total: 1,
                offset: 0,
                limit: 5
            })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 0, total: 0 })),
            clearPages: mock.fn(async () => 0)
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        const title = document.querySelector('#pages-list .page-title');
        const toggle = document.querySelector('#pages-list .page-toggle');
        const gotoButton = document.querySelector('#pages-list .btn-goto');

        assert.ok(title);
        assert.strictEqual(title.tagName, 'SPAN');
        assert.ok(toggle);
        assert.strictEqual(document.querySelector('#pages-list img'), null);
        assert.strictEqual(gotoButton.disabled, true);

        toggle.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const text = document.querySelector('#pages-list .highlight-text');
        assert.ok(text);
        assert.strictEqual(text.textContent, '<img src=x onerror="window.__settingsXss = true">');
    });

    it('should load annotations using PageStorage.queryPages', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.PageStorage.queryPages = mock.fn(async () => ({
            items: [{
                url: 'http://example.com',
                highlights: [{ id: 'h-1', text: 'plain text', color: '#ffff00' }],
                previewHighlights: [{ id: 'h-1', text: 'plain text', color: '#ffff00' }],
                drawingCount: 0,
                highlightCount: 1,
                lastUpdated: 2
            }],
            total: 1,
            offset: 0,
            limit: 8,
            processed: 1,
            matched: 1
        }));

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        const title = document.querySelector('#pages-list .page-title');
        assert.ok(title);
        assert.strictEqual(title.textContent, 'http://example.com');
        const errorToast = SharedUI.toast.mock.calls.find((call) => call.arguments[0] === 'Could not load annotations from storage.');
        assert.strictEqual(errorToast, undefined);
    });

    it('should sanitize imported page payloads before storing them', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.PageStorage = {
            count: mock.fn(async () => 0),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 5 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 1, total: 1 })),
            clearPages: mock.fn(async () => 0)
        };

        global.FileReader = class {
            readAsText() {
                this.onload({
                    target: {
                        result: JSON.stringify({
                            pages: {
                                'http://example.com': {
                                    url: 'http://example.com',
                                    highlights: 'bad-data',
                                    drawings: [{ id: 'd-1' }]
                                }
                            }
                        })
                    }
                });
            }
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Mock showModal to simulate user selecting all settings and all annotations
        SharedUI.showModal = mock.fn(async () => true);

        const importFile = document.getElementById('import-file');
        Object.defineProperty(importFile, 'files', {
            configurable: true,
            value: [{ name: 'backup.json' }]
        });
        importFile.onchange({ target: importFile });
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(global.PageStorage.importPages.mock.calls[0].arguments[0]['http://example.com'].highlights.length, 0);
        assert.strictEqual(global.PageStorage.importPages.mock.calls[0].arguments[0]['http://example.com'].drawings.length, 1);
        assert.strictEqual(SharedUI.toast.mock.calls.at(-1).arguments[0], 'Imported 1 page, 0 highlights, and 1 drawing. Applied 5 settings categories.');
        assert.strictEqual(document.getElementById('data-feedback').textContent, 'Imported 1 page, 0 highlights, and 1 drawing. Applied 5 settings categories.');
    });

    it('should show a settings error when copying a snippet fails', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.navigator.clipboard = {
            writeText: mock.fn(async () => {
                throw new Error('clipboard denied');
            })
        };
        global.PageStorage = {
            count: mock.fn(async () => 1),
            queryPages: mock.fn(async () => ({
                items: [{
                    url: 'http://example.com',
                    highlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
                    previewHighlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
                    drawingCount: 0,
                    highlightCount: 1,
                    lastUpdated: 1
                }],
                total: 1,
                offset: 0,
                limit: 8,
                processed: 1,
                matched: 1
            })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 0, total: 0 })),
            clearPages: mock.fn(async () => 0)
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        document.querySelector('.page-toggle').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        document.querySelector('.btn-snippet-copy').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.strictEqual(SharedUI.toast.mock.calls.at(-1).arguments[0], 'Could not copy highlight text.');
    });

    it('should export settings through the allowlist instead of reading all storage keys', async () => {
        const createObjectURL = mock.fn(() => 'blob:marklet-test');
        const revokeObjectURL = mock.fn();
        const anchorClick = mock.method(window.HTMLAnchorElement.prototype, 'click', () => {});
        global.URL.createObjectURL = createObjectURL;
        global.URL.revokeObjectURL = revokeObjectURL;

        chrome.storage.local.get = mock.fn((keys) => {
            if (Array.isArray(keys) && keys.includes('theme')) {
                return Promise.resolve({
                    theme: 'dark',
                    recentColors: ['#112233'],
                    baseColors: ['#445566'],
                    internalRuntimeKey: 'ignore-me'
                });
            }
            return Promise.resolve({});
        });
        global.PageStorage = {
            count: mock.fn(async () => 0),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 5 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 0, total: 0 })),
            clearPages: mock.fn(async () => 0)
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 50));

        document.getElementById('export-annotations-toggle').checked = false;
        document.getElementById('export-btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        const exportCall = chrome.storage.local.get.mock.calls.find((call) => Array.isArray(call.arguments[0]) && call.arguments[0].includes('recentColors') && call.arguments[0].includes('baseColors'));
        assert.ok(exportCall);
        assert.strictEqual(chrome.storage.local.get.mock.calls.some((call) => call.arguments[0] === null), false);
        assert.strictEqual(createObjectURL.mock.calls.length, 1);
        anchorClick.mock.restore();
    });

    it('should keep import mode selection inside the selective import dialog', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.PageStorage = {
            count: mock.fn(async () => 0),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 5 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 1, total: 1 })),
            clearPages: mock.fn(async () => 0)
        };

        global.FileReader = class {
            readAsText() {
                this.onload({
                    target: {
                        result: JSON.stringify({
                            pages: {
                                'http://example.com': {
                                    url: 'http://example.com',
                                    highlights: [{ id: 'h-1', text: 'saved text' }],
                                    drawings: [{ id: 'd-1' }]
                                }
                            },
                            theme: 'dark'
                        })
                    }
                });
            }
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 50));

        SharedUI.showModal = mock.fn(async () => true);

        const importFile = document.getElementById('import-file');
        Object.defineProperty(importFile, 'files', {
            configurable: true,
            value: [{ name: 'backup.json' }]
        });
        importFile.onchange({ target: importFile });
        await new Promise(resolve => setTimeout(resolve, 100));

        const modalOptions = SharedUI.showModal.mock.calls[0].arguments[0];
        const body = modalOptions.body;
        assert.strictEqual(document.getElementById('import-annotations-mode'), null);
        assert.strictEqual(modalOptions.panelClass, 'modal-panel-import');
        assert.ok(body.querySelector('.import-modal-stats'));
        assert.strictEqual(body.querySelectorAll('.import-mode-card').length, 3);
        assert.ok(body.textContent.includes('Replace Matching Pages'));
    });

    it('should expose pagination controls for long site lists and keep them hidden for a single annotation page', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({
            disabledSites: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com', 'g.com', 'h.com', 'i.com'],
            urlHashSiteModes: {
                'mail.example.com': 'include',
                'app.example.com': 'ignore',
                'docs.example.com': 'include',
                'work.example.com': 'ignore',
                'one.example.com': 'include',
                'two.example.com': 'ignore',
                'three.example.com': 'include',
                'four.example.com': 'ignore',
                'five.example.com': 'include'
            }
        }));
        global.PageStorage = {
            count: mock.fn(async () => 1),
            queryPages: mock.fn(async () => ({
                items: [{
                    url: 'http://example.com',
                    highlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
                    previewHighlights: [{ id: 'h-1', text: 'alpha', color: '#ffff00' }],
                    drawingCount: 0,
                    highlightCount: 1,
                    lastUpdated: 1
                }],
                total: 1,
                offset: 0,
                limit: 5
            })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 0, total: 0 })),
            clearPages: mock.fn(async () => 0)
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.ok(document.getElementById('disabled-sites-pagination').textContent.includes('Page 1 of 2'));
        assert.ok(document.getElementById('disabled-sites-pagination').textContent.includes('9 items'));
        assert.ok(document.getElementById('url-hash-site-pagination').textContent.includes('Page 1 of 2'));
        assert.ok(document.getElementById('url-hash-site-pagination').textContent.includes('9 items'));
        assert.ok(document.getElementById('annotation-pagination-top').classList.contains('is-empty'));
        assert.ok(document.getElementById('annotation-pagination-bottom').classList.contains('is-empty'));
    });

    it('should import annotations in append mode without resetting settings when disabled', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({ theme: 'light' }));
        global.PageStorage = {
            count: mock.fn(async () => 0),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 5 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 1, total: 1 })),
            clearPages: mock.fn(async () => 0)
        };

        global.FileReader = class {
            readAsText() {
                this.onload({
                    target: {
                        result: JSON.stringify({
                            pages: {
                                'http://example.com': {
                                    url: 'http://example.com',
                                    highlights: [{ id: 'h-1', text: 'saved text' }],
                                    drawings: []
                                }
                            },
                            theme: 'dark'
                        })
                    }
                });
            }
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 50));

        document.getElementById('import-settings-toggle').checked = false;

        // Mock showModal to simulate user selecting ONLY highlights but NO settings
        SharedUI.showModal = mock.fn(async () => true);

        const importFile = document.getElementById('import-file');
        Object.defineProperty(importFile, 'files', {
            configurable: true,
            value: [{ name: 'backup.json' }]
        });
        importFile.onchange({ target: importFile });
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(global.PageStorage.importPages.mock.calls[0].arguments[1].mode, 'append');
        assert.strictEqual(SharedUI.toast.mock.calls.at(-1).arguments[0], 'Imported 1 page, 1 highlight, and 0 drawings.');
    });

    it('should sanitize imported palette settings and ignore non-allowlisted keys', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.PageStorage = {
            count: mock.fn(async () => 0),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 5 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 0, total: 0 })),
            clearPages: mock.fn(async () => 0)
        };

        global.FileReader = class {
            readAsText() {
                this.onload({
                    target: {
                        result: JSON.stringify({
                            recentColors: ['#123456', 'red', '#123456'],
                            customPresets: ['#654321', '\"><img id="xss">'],
                            baseColors: ['#111111', 'bad-value'],
                            originColors: ['#222222', 'bad-value'],
                            internalRuntimeKey: 'ignore-me'
                        })
                    }
                });
            }
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 50));

        SharedUI.showModal = mock.fn(async () => true);

        const importFile = document.getElementById('import-file');
        Object.defineProperty(importFile, 'files', {
            configurable: true,
            value: [{ name: 'backup.json' }]
        });
        importFile.onchange({ target: importFile });
        await new Promise(resolve => setTimeout(resolve, 100));

        const stored = chrome.storage.local.set.mock.calls.at(-1).arguments[0];
        assert.deepStrictEqual(stored.recentColors, ['#123456']);
        assert.deepStrictEqual(stored.customPresets, ['#654321']);
        assert.strictEqual(stored.baseColors[0], '#111111');
        assert.strictEqual(stored.baseColors[1], '#ff5722');
        assert.strictEqual(stored.originColors[0], '#222222');
        assert.strictEqual(stored.originColors[1], '#ff5722');
        assert.strictEqual(Object.prototype.hasOwnProperty.call(stored, 'internalRuntimeKey'), false);
    });

    it('should stop import when the confirmation is cancelled', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.PageStorage = {
            count: mock.fn(async () => 0),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 5 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 1, total: 1 })),
            clearPages: mock.fn(async () => 0)
        };
        // Mock showModal to return null (cancelled)
        SharedUI.showModal = mock.fn(async () => null);

        global.FileReader = class {
            readAsText() {
                this.onload({
                    target: {
                        result: JSON.stringify({
                            pages: {
                                'http://example.com': {
                                    url: 'http://example.com',
                                    highlights: [{ id: 'h-1', text: 'saved text' }],
                                    drawings: []
                                }
                            }
                        })
                    }
                });
            }
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 50));

        const importFile = document.getElementById('import-file');
        Object.defineProperty(importFile, 'files', {
            configurable: true,
            value: [{ name: 'backup.json' }]
        });
        
        global.PageStorage.importPages = mock.fn(async () => ({ processed: 0, total: 0 }));
        
        importFile.onchange({ target: importFile });
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(global.PageStorage.importPages.mock.calls.length, 0);
        assert.strictEqual(SharedUI.toast.mock.calls.length, 0);
    });

    it('should clear all annotations without resetting settings', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        global.PageStorage = {
            get: mock.fn(async () => undefined),
            set: mock.fn(async () => undefined),
            remove: mock.fn(async () => undefined),
            keys: mock.fn(async () => []),
            count: mock.fn(async () => 2),
            queryPages: mock.fn(async () => ({ items: [], total: 0, offset: 0, limit: 5 })),
            exportPages: mock.fn(async () => ({ pages: {}, total: 0, processed: 0 })),
            importPages: mock.fn(async () => ({ processed: 0, total: 0 })),
            clearPages: mock.fn(async () => 2)
        };

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 50));

        global.PageStorage.clearPages = mock.fn(async () => 2);
        SharedUI.confirm = mock.fn(async () => true);
        document.getElementById('clear-annotations-btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        assert.strictEqual(global.PageStorage.clearPages.mock.calls.length, 1);
        assert.strictEqual(chrome.storage.local.clear.mock.calls.length, 0);
        assert.strictEqual(SharedUI.toast.mock.calls.at(-1).arguments[0], 'Removed annotations from 2 pages.');
        assert.strictEqual(document.getElementById('data-feedback').textContent, 'Removed annotations from 2 pages.');
    });
});
