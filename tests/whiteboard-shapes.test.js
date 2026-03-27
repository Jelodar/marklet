const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Whiteboard Shapes', () => {
    let marklet;
    let whiteboard;

    beforeEach(async () => {
        document.body.innerHTML = '';
        chrome.storage.local.get = mock.fn((keys, callback) => {
             const res = { extensionEnabled: true, enableByDefault: true };
             if (callback) callback(res);
             return Promise.resolve(res);
        });
        
        marklet = new Marklet();
        await new Promise(resolve => setImmediate(resolve));
        whiteboard = marklet.whiteboard;
        whiteboard.toggle(true);
    });

    afterEach(async () => {
        if (marklet) marklet.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should draw a rectangle', () => {
        whiteboard.setMode('rect');
        whiteboard.start({ pageX: 10, pageY: 10 });
        whiteboard.draw({ pageX: 100, pageY: 100 });
        whiteboard.end();

        assert.strictEqual(whiteboard.strokes.length, 1);
        const s = whiteboard.strokes[0];
        assert.strictEqual(s.type, 'rect');
        assert.deepStrictEqual(s.points[0], { x: 10, y: 10 });
        assert.deepStrictEqual(s.points[1], { x: 100, y: 100 });
    });

    it('should draw a circle', () => {
        whiteboard.setMode('circle');
        whiteboard.start({ pageX: 50, pageY: 50 });
        whiteboard.draw({ pageX: 80, pageY: 80 });
        whiteboard.end();

        assert.strictEqual(whiteboard.strokes.length, 1);
        const s = whiteboard.strokes[0];
        assert.strictEqual(s.type, 'circle');
    });

    it('should draw an arrow', () => {
        whiteboard.setMode('arrow');
        whiteboard.start({ pageX: 10, pageY: 10 });
        whiteboard.draw({ pageX: 50, pageY: 10 });
        whiteboard.end();

        assert.strictEqual(whiteboard.strokes.length, 1);
        assert.strictEqual(whiteboard.strokes[0].type, 'arrow');
    });

    it('should erase a stroke', () => {
        whiteboard.setMode('draw');
        whiteboard.start({ pageX: 10, pageY: 10 });
        whiteboard.draw({ pageX: 20, pageY: 20 });
        whiteboard.end();
        assert.strictEqual(whiteboard.strokes.length, 1);

        whiteboard.setMode('erase');
        whiteboard.start({ pageX: 15, pageY: 15 });
        
        assert.strictEqual(whiteboard.strokes.length, 0);
    });

    it('should undo and redo', () => {
        whiteboard.setMode('rect');
        whiteboard.start({ pageX: 10, pageY: 10 });
        whiteboard.end();
        assert.strictEqual(whiteboard.strokes.length, 1);

        whiteboard.undo();
        assert.strictEqual(whiteboard.strokes.length, 0);
        assert.strictEqual(whiteboard.history.length, 1);

        whiteboard.redo();
        assert.strictEqual(whiteboard.strokes.length, 1);
        assert.strictEqual(whiteboard.history.length, 0);
    });
});
