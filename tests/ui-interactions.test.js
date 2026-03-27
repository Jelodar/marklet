const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('UI Interactions', () => {
    let marklet;
    let ui;

    beforeEach(async () => {
        document.body.innerHTML = '';
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = { extensionEnabled: true, enableByDefault: true };
             if (callback) callback(res);
             return Promise.resolve(res);
        });
        
        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));
        ui = marklet.ui;
        ui.renderDock();
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should set tool when dock buttons are clicked', () => {
        const spy = mock.method(ui, 'setTool');
        
        const btnRect = ui.dock.querySelector('#btn-rect');
        btnRect.click();
        
        assert.strictEqual(spy.mock.calls.length, 1);
        assert.strictEqual(spy.mock.calls[0].arguments[0], 'rect');
    });

    it('should toggle palette when palette button is clicked', () => {
        const spy = mock.method(ui, 'togglePalette');
        
        const btnPalette = ui.dock.querySelector('#btn-palette-dock');
        btnPalette.click();
        
        assert.strictEqual(spy.mock.calls.length, 1);
        assert.strictEqual(ui.palette.classList.contains('visible'), true);
    });

    it('should clear drawings when trash button is clicked and confirmed', () => {
        const originalConfirm = global.confirm;
        global.confirm = () => true;
        const spy = mock.method(marklet.whiteboard, 'clear');
        
        const btnClear = ui.dock.querySelector('#btn-clear-draw-dock');
        btnClear.click();
        
        assert.strictEqual(spy.mock.calls.length, 1);
        global.confirm = originalConfirm;
    });

    it('should NOT clear drawings when trash button is clicked and cancelled', () => {
        const originalConfirm = global.confirm;
        global.confirm = () => false;
        const spy = mock.method(marklet.whiteboard, 'clear');
        
        const btnClear = ui.dock.querySelector('#btn-clear-draw-dock');
        btnClear.click();
        
        assert.strictEqual(spy.mock.calls.length, 0);
        global.confirm = originalConfirm;
    });

    it('should show notification and then hide it', async () => {
        ui.showNotification('Test Message');
        
        const note = ui.container.querySelector('div.toast');
        assert.ok(note);
        assert.strictEqual(note.textContent, 'Test Message');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.strictEqual(note.style.opacity, '1');
    });

    it('should toggle dock visibility', () => {
        ui.toggleDock(true);
        assert.strictEqual(ui.dock.style.display, 'flex');
        
        ui.toggleDock(false);
        assert.strictEqual(ui.dock.style.display, 'none');
    });

    it('should add custom preset to palette', async () => {
        ui.togglePalette(true);
        const input = ui.palette.querySelector('#pal-picker');
        input.value = '#123456';
        
        const btnAdd = ui.palette.querySelector('#add-preset');
        btnAdd.click();
        
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(ui.customPresets.includes('#123456'));
    });

    it('should show varieties popover on long press of a swatch', async () => {
        ui.togglePalette(true);
        const swatch = ui.palette.querySelector('.color-swatch');
        
        swatch.dispatchEvent(new MouseEvent('mousedown'));
        
        await new Promise(resolve => setTimeout(resolve, 550));
        
        const popover = ui.container.querySelector('.varieties-popover');
        assert.ok(popover, 'Varieties popover should be visible');
        popover.remove();
    });
});
