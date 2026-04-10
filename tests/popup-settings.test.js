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
        global.confirm = mock.fn(() => true);
        
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
            drawingOpacity: 50
        }));
        
        require('../settings/settings.js');
        if (domContentLoadedCallback) await domContentLoadedCallback();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        assert.strictEqual(document.getElementById('theme-select').value, 'light');
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
});
