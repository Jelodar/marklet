const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('Whiteboard Text Functionality', () => {
    let marklet;
    let whiteboard;

    beforeEach(async () => {
        document.body.innerHTML = '';
        chrome.storage.local.get = mock.fn((keys, callback) => {
             if (callback) callback({ extensionEnabled: true });
             return Promise.resolve({ extensionEnabled: true });
        });

        marklet = new Marklet();
        await new Promise(resolve => setTimeout(resolve, 50));
        whiteboard = marklet.whiteboard;
        whiteboard.toggle(true);
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 150));
    });

    it('should have correct default values', () => {
        assert.strictEqual(whiteboard.opacity, 75, 'Default opacity should be 75');
        assert.strictEqual(whiteboard.blendMode, 'normal', 'Default blend mode should be normal');
    });

    it('should create text on click and enter edit mode immediately', () => {
        whiteboard.setMode('text');

        whiteboard.start({ pageX: 100, pageY: 100 });

        assert.strictEqual(whiteboard.strokes.length, 0);
        assert.ok(whiteboard.editStroke);
        assert.strictEqual(whiteboard.editStroke.type, 'text');
        assert.strictEqual(whiteboard.editStroke.text, 'Text');

        const textarea = document.querySelector('.marklet-text-input');
        assert.ok(textarea);
        assert.strictEqual(textarea.value, 'Text');
    });

    it('should update text on edit', () => {
        whiteboard.setMode('text');
        whiteboard.start({ pageX: 100, pageY: 100 });

        const textarea = document.querySelector('.marklet-text-input');
        textarea.value = 'New Text';
        textarea.dispatchEvent(new window.Event('blur'));

        assert.strictEqual(whiteboard.strokes.length, 1);
        assert.strictEqual(whiteboard.strokes[0].text, 'New Text');
        assert.strictEqual(document.querySelector('.marklet-text-input'), null);
    });

    it('should remove text if empty on blur', () => {
        whiteboard.setMode('text');
        whiteboard.start({ pageX: 100, pageY: 100 });

        const textarea = document.querySelector('.marklet-text-input');
        textarea.value = '';
        textarea.dispatchEvent(new window.Event('blur'));

        assert.strictEqual(whiteboard.strokes.length, 1);
        assert.strictEqual(whiteboard.strokes[0].text, 'Text');
    });

    it('should resize text font size using thickness slider', () => {
        whiteboard.setMode('text');
        whiteboard.start({ pageX: 100, pageY: 100 });

        document.querySelector('.marklet-text-input').dispatchEvent(new window.Event('blur'));

        const textStroke = whiteboard.strokes[0];
        whiteboard.selectedStroke = textStroke;

        const initialSize = textStroke.size;
        whiteboard.setThickness(10);

        assert.strictEqual(textStroke.size, 10 * 3 + 10);
        assert.notStrictEqual(textStroke.size, initialSize);
    });

    it('should hit test text with padding', () => {
        whiteboard.setMode('text');
        whiteboard.start({ pageX: 100, pageY: 100 });

        document.querySelector('.marklet-text-input').dispatchEvent(new window.Event('blur'));

        const stroke = whiteboard.strokes[0];
        whiteboard.mode = 'select';

        const hit1 = whiteboard.hitTest(110, 110);
        assert.strictEqual(hit1, stroke);

        const hit2 = whiteboard.hitTest(95, 95);
        assert.strictEqual(hit2, stroke);

        const hit3 = whiteboard.hitTest(50, 50);
        assert.strictEqual(hit3, null);
    });

    it('should expand text box on input', () => {
        whiteboard.setMode('text');
        whiteboard.start({ pageX: 100, pageY: 100 });

        const textarea = document.querySelector('.marklet-text-input');
        const initialWidth = textarea.style.width;

        textarea.value = 'A very long text string that should expand the box';
        textarea.dispatchEvent(new window.Event('input'));

        const newWidth = textarea.style.width;
        assert.notStrictEqual(initialWidth, newWidth);
    });
});
