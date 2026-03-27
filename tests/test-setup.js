const { mock } = require('node:test');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.Element = dom.window.Element;
global.ShadowRoot = dom.window.ShadowRoot;
global.URL = dom.window.URL;
global.Range = dom.window.Range;
global.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
global.Range.prototype.getClientRects = () => [];
global.Selection = dom.window.Selection;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.MouseEvent = dom.window.MouseEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.Event = dom.window.Event;
global.crypto = { randomUUID: () => 'test-uuid-' + Math.random() };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.getComputedStyle = window.getComputedStyle;
global.matchMedia = window.matchMedia = () => ({ matches: false });
global.confirm = () => true;
global.crypto = { randomUUID: () => 'test-uuid' };

global.MutationObserver = dom.window.MutationObserver;

global.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    scale: () => {},
    translate: () => {},
    rotate: () => {},
    rect: () => {},
    arc: () => {},
    fill: () => {},
    strokeRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
    measureText: (text) => ({ width: (text ? text.length : 0) * 10 }),
});

global.chrome = {
  runtime: {
    id: 'test',
    onMessage: { addListener: mock.fn() },
    onInstalled: { addListener: mock.fn() }
  },
  storage: {
    local: {
      get: mock.fn(async (keys) => {
          if (typeof keys === 'string') return { [keys]: undefined };
          if (Array.isArray(keys)) {
        const res = {};
              keys.forEach(k => res[k] = undefined);
        return res;
          }
          return {};
      }),
      set: mock.fn(async () => {}),
      remove: mock.fn(async () => {})
    },
    onChanged: { addListener: mock.fn(), removeListener: mock.fn() }
  },
  contextMenus: {
    create: mock.fn(),
    onClicked: { addListener: mock.fn() }
  },
  tabs: {
    query: mock.fn(async () => [{ id: 1, url: 'https://example.com' }]),
    sendMessage: mock.fn((id, msg, cb) => {
      if (typeof cb === 'function') cb({});
      return Promise.resolve({});
    })
  },
  webNavigation: {
    onHistoryStateUpdated: { addListener: mock.fn() },
    onReferenceFragmentUpdated: { addListener: mock.fn() }
  }
};

global.SharedUtils = require('../utils/shared.js');
const { ICONS, CONSTANTS, SHADOW_STYLES } = require('../content/assets.js');
global.ICONS = ICONS;
global.CONSTANTS = CONSTANTS;
global.SHADOW_STYLES = SHADOW_STYLES;
global.DOMUtils = require('../content/dom_utils.js').DOMUtils;
global.UI = require('../content/ui.js').UI;
global.Whiteboard = require('../content/whiteboard.js').Whiteboard;
global.Highlighter = require('../content/highlighter.js').Highlighter;
global.Marklet = require('../content/marklet.js').Marklet;
