const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Popup Logic', () => {
    let domContentLoadedCallback;

    beforeEach(() => {
        document.body.innerHTML = `
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
        `;
        
        chrome.tabs.query = mock.fn(() => Promise.resolve([{ id: 123, url: 'http://example.com' }]));
        chrome.tabs.sendMessage = mock.fn((id, message, callback) => {
            if (typeof callback === 'function') callback({});
            return Promise.resolve({});
        });
        global.confirm = mock.fn(() => true);
        global.alert = mock.fn();
        
        // Mock addEventListener to capture the callback
        document.addEventListener = mock.fn((event, cb) => {
            if (event === 'DOMContentLoaded') {
                domContentLoadedCallback = cb;
            }
        });

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
        tinyIDB.get = mock.fn(async () => ({
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
        tinyIDB.get = mock.fn(async () => ({
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
});

describe('Settings Logic', () => {
    let domContentLoadedCallback;

    beforeEach(() => {
        document.body.innerHTML = `
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
            <div id="url-hash-site-list"></div>
            <div id="disabled-sites-list-container"><h2></h2><div id="disabled-sites-list"></div></div>
            <div id="pages-list"></div>
            <div id="pagination"></div>
            <input type="text" id="page-search">
            <button id="export-btn"></button>
            <button id="import-btn"></button>
            <input type="file" id="import-file">
            <button id="reset-defaults-btn"></button>
            <input id="hotkey-highlight">
            <input id="hotkey-whiteboard">
            <input id="hotkey-drawings">
            <input id="hotkey-highlights">
            <input id="hotkey-all">
        `;
        global.alert = mock.fn();
        chrome.storage.local.clear = mock.fn(async () => {});
        
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
        tinyIDB.entries = mock.fn(async () => [[
            'javascript:alert(1)',
            {
                url: 'javascript:alert(1)',
                highlights: [{ id: 'h-1', text: '<img src=x onerror="window.__settingsXss = true">', color: '#ff0000' }],
                drawings: [],
                lastUpdated: 1
            }
        ]]);

        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));

        const title = document.querySelector('#pages-list .page-title');
        const text = document.querySelector('#pages-list .highlight-text');
        const gotoButton = document.querySelector('#pages-list .btn-goto');

        assert.ok(title);
        assert.strictEqual(title.tagName, 'SPAN');
        assert.ok(text);
        assert.strictEqual(text.textContent, '<img src=x onerror="window.__settingsXss = true">');
        assert.strictEqual(document.querySelector('#pages-list img'), null);
        assert.strictEqual(gotoButton.disabled, true);
    });

    it('should sanitize imported page payloads before storing them', async () => {
        chrome.storage.local.get = mock.fn(() => Promise.resolve({}));
        const setSpy = mock.method(tinyIDB, 'set');

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

        const importFile = document.getElementById('import-file');
        Object.defineProperty(importFile, 'files', {
            configurable: true,
            value: [{ name: 'backup.json' }]
        });
        importFile.onchange({ target: importFile });
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(chrome.storage.local.clear.mock.calls.length, 1);
        assert.strictEqual(setSpy.mock.calls[0].arguments[1].highlights.length, 0);
        assert.strictEqual(setSpy.mock.calls[0].arguments[1].drawings.length, 1);
        assert.strictEqual(global.alert.mock.calls[0].arguments[0], 'Import successful!');
    });
});
