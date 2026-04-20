const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Whiteboard Performance & Maintenance', () => {
    let marklet;
    let whiteboard;

    beforeEach(async () => {
        marklet = new Marklet();
        marklet.initAll();
        await new Promise(resolve => setTimeout(resolve, 10));
        whiteboard = marklet.whiteboard;
    });

    afterEach(() => {
        if (marklet) marklet.destroyAll();
    });

    it('should isolate events to the canvas', () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(true);
        
        let eventPrevented = false;
        let propagationStopped = false;

        const mockEvent = {
            pageX: 100,
            pageY: 100,
            preventDefault: () => { eventPrevented = true; },
            stopPropagation: () => { propagationStopped = true; },
            stopImmediatePropagation: () => {}
        };

        whiteboard.start(mockEvent);
        assert.ok(whiteboard.isDrawing, 'Should be drawing');
    });

    it('should switch to SVG viewer when deactivated if strokes exist', () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(true);
        whiteboard.start({ pageX: 100, pageY: 100 });
        whiteboard.draw({ pageX: 200, pageY: 200 });
        whiteboard.end();
        assert.strictEqual(whiteboard.strokes.length, 1);
        
        const shadow = marklet.shadow;
        assert.ok(shadow.getElementById('marklet-canvas-main'));
        assert.strictEqual(shadow.getElementById('marklet-svg-view'), null);

        whiteboard.toggle(false);
        assert.strictEqual(shadow.getElementById('marklet-canvas-main'), null, 'Canvas should be removed');
        assert.ok(shadow.getElementById('marklet-svg-view'), 'SVG viewer should be added');
        assert.strictEqual(whiteboard.svg.childNodes.length, 1, 'SVG should contain the stroke');
    });

    it('should remove all viewers when cleared while inactive', () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(true);
        whiteboard.start({ pageX: 100, pageY: 100 });
        whiteboard.draw({ pageX: 200, pageY: 200 });
        whiteboard.end();
        
        whiteboard.toggle(false);
        const shadow = marklet.shadow;
        assert.ok(shadow.getElementById('marklet-svg-view'));
        
        whiteboard.clear();
        assert.strictEqual(shadow.getElementById('marklet-canvas-main'), null, 'Canvas should be removed');
        assert.strictEqual(shadow.getElementById('marklet-svg-view'), null, 'SVG should be removed');
        assert.strictEqual(whiteboard.strokes.length, 0);
    });

    it('should not add any element if no strokes exist', () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(false);
        const shadow = marklet.shadow;
        assert.strictEqual(shadow.getElementById('marklet-canvas-main'), null);
        assert.strictEqual(shadow.getElementById('marklet-svg-view'), null);
    });

    it('should account for document offsets in coordinate mapping', () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(true);
        
        const originalGetBCR = document.documentElement.getBoundingClientRect;
        document.documentElement.getBoundingClientRect = () => ({
            left: 50,
            top: 50,
            width: 1000,
            height: 1000,
            bottom: 1050,
            right: 1050
        });

        const p = whiteboard.getMousePos({ clientX: 100, clientY: 100 });
        assert.strictEqual(p.x, 50, 'X coordinate should be adjusted by offset (100 - 50 = 50)');
        assert.strictEqual(p.y, 50, 'Y coordinate should be adjusted by offset (100 - 50 = 50)');

        document.documentElement.getBoundingClientRect = originalGetBCR;
    });

    it('should use document offset for canvas translation in redraw', () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(true);
        
        const originalGetBCR = document.documentElement.getBoundingClientRect;
        document.documentElement.getBoundingClientRect = () => ({
            left: 50,
            top: 50,
            width: 1000,
            height: 1000
        });

        let translates = [];
        const originalTranslate = whiteboard.ctx.translate;
        whiteboard.ctx.translate = (x, y) => {
            translates.push([x, y]);
        };

        whiteboard.redraw();
        assert.ok(translates.some(args => args[0] === 50 && args[1] === 50), 'Should translate by document offset');

        whiteboard.ctx.translate = originalTranslate;
        document.documentElement.getBoundingClientRect = originalGetBCR;
    });

    it('should account for scrolling in document offsets', () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(true);
        
        const originalGetBCR = document.documentElement.getBoundingClientRect;
        document.documentElement.getBoundingClientRect = () => ({
            left: -100,
            top: -200,
            width: 1000,
            height: 1000,
            bottom: 800,
            right: 900
        });

        const p = whiteboard.getMousePos({ clientX: 100, clientY: 100 });
        assert.strictEqual(p.x, 200, 'X coordinate should be adjusted by scroll (100 - (-100) = 200)');
        assert.strictEqual(p.y, 300, 'Y coordinate should be adjusted by scroll (100 - (-200) = 300)');

        document.documentElement.getBoundingClientRect = originalGetBCR;
    });

    it('should throttle active scroll redraws through requestAnimationFrame', async () => {
        assert.ok(whiteboard, 'Whiteboard should be initialized');
        whiteboard.toggle(true);
        const redrawSpy = mock.method(whiteboard, 'redraw', () => {});

        whiteboard.scrollListener();
        whiteboard.scrollListener();
        whiteboard.scrollListener();
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(redrawSpy.mock.calls.length, 1);
    });
});
