const { describe, it, afterEach, mock } = require('node:test');
const assert = require('assert');
const { Marklet } = require('../content/marklet.js');

global.chrome = {
  runtime: {
    id: 'mock-id',
    onMessage: { addListener: () => {} },
    sendMessage: () => {}
  },
  storage: {
    local: {
      get: (keys, cb) => {
        const data = { extensionEnabled: true };
        if (cb) cb(data);
        return Promise.resolve(data);
      },
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      onChanged: { addListener: () => {} }
    }
  }
};

global.document = {
  createElement: () => ({ 
    style: {}, 
    attachShadow: () => ({ appendChild: () => {} }),
    addEventListener: () => {},
    remove: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    setAttribute: () => {},
    closest: () => null
  }),
  body: { appendChild: () => {}, removeChild: () => {}, scrollHeight: 1000, scrollWidth: 1000 },
  head: { appendChild: () => {} },
  documentElement: { 
    appendChild: () => {},
    scrollWidth: 1000, scrollHeight: 1000, clientWidth: 1000, clientHeight: 1000,
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    setAttribute: () => {}
  },
  addEventListener: () => {},
  readyState: "complete",
  contains: () => true,
  getElementById: () => null
};
global.window = {
  location: { href: "http://example.com", hostname: "example.com" },
  addEventListener: () => {},
  removeEventListener: () => {},
  devicePixelRatio: 1
};
global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
global.MutationObserver = class { observe() {} disconnect() {} };

global.SharedUtils = { isValidExtension: () => true, normalizeUrl: (u) => u, isSavable: () => true };
global.Whiteboard = class { 
    constructor(app) { 
        this.app = app; 
        this.opacity = 75; 
        this.blendMode = 'normal'; 
        this.init();
    }
    init() {
        this.loadStrokes();
        this.loadBlendMode();
        this.loadOpacity();
    }
    destroy() {}
    toggle() {} 
    toggleVisibility() {} 
    loadStrokes() {}
    loadBlendMode() {}
    loadOpacity() {}
};
global.Highlighter = class { 
    loadHighlights() { return Promise.resolve(); }
    destroy() {}
};
global.UI = class { 
  constructor() {
      this.container = { remove: () => {} };
      this.absoluteContainer = { remove: () => {} };
  }
  destroy() {} 
  toggleDock() {} 
};
global.DOMUtils = { stripHighlights: () => {} };
global.SHADOW_STYLES = "";
global.CONSTANTS = require('../utils/consts.js').CONSTANTS;

describe('Lifecycle Tests', () => {
    let marklet;

    afterEach(() => {
        if (marklet) {
            marklet.destroyAll();
            marklet = null;
        }
    });

    it('Toggling extension off and on should re-initialize', async () => {
        marklet = new Marklet();
        await new Promise(r => setTimeout(r, 10)); 

        assert.ok(marklet.whiteboard, "Whiteboard should be initialized initially");

        await marklet.toggleExtension(false);
        assert.strictEqual(marklet.destroyed, true, "Should be destroyed after toggling off");
        assert.strictEqual(marklet.whiteboard, null, "Whiteboard should be null after toggling off");

        await marklet.toggleExtension(true);
        await new Promise(r => setTimeout(r, 50));

        assert.ok(marklet.whiteboard, "Whiteboard should be re-initialized after toggling back on");
        assert.strictEqual(marklet.destroyed, false, "Destroyed flag should be false after toggling back on");
    });
});
