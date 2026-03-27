const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Whiteboard Manipulation', () => {
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

    it('should hit test handles correctly', () => {
        const stroke = {
            type: 'rect',
            points: [{x: 0, y: 0}, {x: 100, y: 100}],
            width: 5
        };
        
        const handle = whiteboard.hitTestHandles(-12, -12, stroke);
        assert.strictEqual(handle, 'nw');
        
        const handleSE = whiteboard.hitTestHandles(112, 112, stroke);
        assert.strictEqual(handleSE, 'se');
        
        const rotateHandle = whiteboard.hitTestHandles(50, -37, stroke);
        assert.strictEqual(rotateHandle, 'rotate');
    });

    it('should handle resize interaction', () => {
        const stroke = {
            type: 'rect',
            points: [{x: 0, y: 0}, {x: 100, y: 100}],
            width: 5
        };
        whiteboard.strokes.push(stroke);
        whiteboard.selectedStroke = stroke;
        whiteboard.mode = 'select';

        whiteboard.start({ pageX: 112, pageY: 112 });
        assert.ok(whiteboard.interactionState);
        assert.strictEqual(whiteboard.interactionState.type, 'resize');
        assert.strictEqual(whiteboard.interactionState.handle, 'se');

        whiteboard.draw({ pageX: 120, pageY: 120 });
        
        assert.ok(stroke.points[1].x > 100);
        assert.ok(stroke.points[1].y > 100);
        
        whiteboard.end();
        assert.strictEqual(whiteboard.interactionState, null);
    });

    it('should handle move interaction', () => {
        const stroke = {
            type: 'rect',
            points: [{x: 0, y: 0}, {x: 100, y: 100}],
            width: 5
        };
        whiteboard.strokes.push(stroke);
        whiteboard.selectedStroke = stroke;
        whiteboard.mode = 'select';

        whiteboard.start({ pageX: 0, pageY: 50 });
        assert.ok(whiteboard.interactionState);
        assert.strictEqual(whiteboard.interactionState.type, 'move');

        whiteboard.draw({ pageX: 10, pageY: 50 });
        
        assert.strictEqual(stroke.points[0].x, 10);
        assert.strictEqual(stroke.points[1].x, 110);
        
        whiteboard.end();
    });

    it('should handle rotate interaction', () => {
        const stroke = {
            type: 'rect',
            points: [{x: 0, y: 0}, {x: 100, y: 100}],
            width: 5,
            rotation: 0
        };
        whiteboard.strokes.push(stroke);
        whiteboard.selectedStroke = stroke;
        whiteboard.mode = 'select';

        whiteboard.start({ pageX: 50, pageY: -37 }); 
        assert.strictEqual(whiteboard.interactionState.type, 'rotate');
        
        whiteboard.draw({ pageX: 137, pageY: 50 });
        
        assert.ok(stroke.rotation > 1.0);
        
        whiteboard.end();
    });
});
