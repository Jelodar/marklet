const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('Whiteboard Drawing Accuracy and Shift-Snap', () => {
    let marklet;
    let whiteboard;

    beforeEach(async () => {
        mockStorage.clear();
        document.body.innerHTML = '<div id="content"></div>';
        marklet = new Marklet();
        marklet.initAll();
        await new Promise(resolve => setTimeout(resolve, 50));
        whiteboard = marklet.whiteboard;
        whiteboard.toggle(true);
    });

    afterEach(() => {
        if (marklet) marklet.destroyAll();
    });

    it('should snap freehand to horizontal line when shift is held (dx > dy)', () => {
        whiteboard.setMode('draw');
        whiteboard.start({ clientX: 100, clientY: 100 });
        whiteboard.draw({ clientX: 200, clientY: 110, shiftKey: true });
        
        const stroke = whiteboard.currentStroke;
        assert.strictEqual(stroke.points.length, 2);
        assert.strictEqual(stroke.points[1].x, 200);
        assert.strictEqual(stroke.points[1].y, 100);
    });

    it('should snap freehand to vertical line when shift is held (dy > dx)', () => {
        whiteboard.setMode('draw');
        whiteboard.start({ clientX: 100, clientY: 100 });
        whiteboard.draw({ clientX: 110, clientY: 200, shiftKey: true });
        
        const stroke = whiteboard.currentStroke;
        assert.strictEqual(stroke.points.length, 2);
        assert.strictEqual(stroke.points[1].x, 100);
        assert.strictEqual(stroke.points[1].y, 200);
    });

    it('should account for scrolling in coordinates (page coordinates)', () => {
        window.scrollX = 50;
        window.scrollY = 80;
        
        whiteboard.setMode('draw');
        whiteboard.start({ clientX: 100, clientY: 100 });
        
        const stroke = whiteboard.currentStroke;
        assert.strictEqual(stroke.points[0].x, 150);
        assert.strictEqual(stroke.points[0].y, 180);
        
        window.scrollX = 0;
        window.scrollY = 0;
    });

    it('should lock snap direction until shift is released', () => {
        whiteboard.setMode('draw');
        // Start at (100, 100)
        whiteboard.start({ clientX: 100, clientY: 100 });
        
        // Move to (150, 105) with Shift. dx=50, dy=5. Should lock to Horizontal.
        whiteboard.draw({ clientX: 150, clientY: 105, shiftKey: true });
        assert.strictEqual(whiteboard.shiftLockDir, 'h');
        
        // Move to (200, 300) still with Shift. Even though dy is now huge, should remain Horizontal.
        whiteboard.draw({ clientX: 200, clientY: 300, shiftKey: true });
        const points = whiteboard.currentStroke.points;
        assert.strictEqual(points[points.length - 1].y, 100); // Should still be snapped to the Y of the previous point (which was already snapped to 100)
        
        // Release Shift and move to (250, 350). Should be freehand.
        whiteboard.draw({ clientX: 250, clientY: 350, shiftKey: false });
        assert.strictEqual(whiteboard.shiftLockDir, null);
        assert.strictEqual(whiteboard.currentStroke.points.slice(-1)[0].y, 350);
    });

    it('should convert an in-progress freehand stroke into a straight line from the original start when shift is pressed later', () => {
        whiteboard.setMode('draw');
        whiteboard.start({ clientX: 100, clientY: 100 });
        whiteboard.draw({ clientX: 130, clientY: 140, shiftKey: false });
        whiteboard.draw({ clientX: 180, clientY: 115, shiftKey: true });

        const stroke = whiteboard.currentStroke;
        assert.strictEqual(whiteboard.shiftLockDir, 'h');
        assert.strictEqual(stroke.points.length, 2);
        assert.deepStrictEqual(stroke.points[0], { x: 100, y: 100 });
        assert.deepStrictEqual(stroke.points[1], { x: 180, y: 100 });
    });

    it('should recalculate the snap direction from the original start after shift is released and pressed again', () => {
        whiteboard.setMode('draw');
        whiteboard.start({ clientX: 100, clientY: 100 });
        whiteboard.draw({ clientX: 170, clientY: 120, shiftKey: true });
        assert.strictEqual(whiteboard.shiftLockDir, 'h');
        assert.deepStrictEqual(whiteboard.currentStroke.points, [
            { x: 100, y: 100 },
            { x: 170, y: 100 }
        ]);

        whiteboard.draw({ clientX: 190, clientY: 240, shiftKey: false });
        assert.strictEqual(whiteboard.shiftLockDir, null);
        assert.deepStrictEqual(whiteboard.currentStroke.points, [
            { x: 100, y: 100 },
            { x: 170, y: 100 },
            { x: 190, y: 240 }
        ]);

        whiteboard.draw({ clientX: 130, clientY: 320, shiftKey: true });
        assert.strictEqual(whiteboard.shiftLockDir, 'v');
        assert.deepStrictEqual(whiteboard.currentStroke.points, [
            { x: 100, y: 100 },
            { x: 100, y: 320 }
        ]);
    });
});
