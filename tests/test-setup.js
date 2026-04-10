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
global.Element.prototype.getBoundingClientRect = function() {
    if (this === document.documentElement || this === document.body) {
        return {
            top: -(window.scrollY || 0),
            left: -(window.scrollX || 0),
            width: window.innerWidth || 1024,
            height: window.innerHeight || 768,
            bottom: (window.innerHeight || 768) - (window.scrollY || 0),
            right: (window.innerWidth || 1024) - (window.scrollX || 0)
        };
    }
    return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };
};
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
global.importScripts = () => {};

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
    setTransform: () => {},
    rect: () => {},
    arc: () => {},
    fill: () => {},
    strokeRect: () => {},
    fillText: () => {},
    setLineDash: () => {},
    measureText: (text) => ({ width: (text ? text.length : 0) * 10 }),
});

const mockStorage = new Map();
global.mockStorage = mockStorage;

global.chrome = {
  runtime: {
    id: 'test',
    onMessage: { addListener: mock.fn() },
    onInstalled: { addListener: mock.fn() },
    sendMessage: mock.fn((msg, cb) => {
        if (msg.type === 'DB_GET') {
            const val = mockStorage.get(`idb_${msg.key}`);
            if (cb) cb(val);
            return Promise.resolve(val);
        }
        if (msg.type === 'DB_SET') {
            mockStorage.set(`idb_${msg.key}`, msg.value);
            if (cb) cb();
            return Promise.resolve();
        }
        if (msg.type === 'DB_REMOVE') {
            mockStorage.delete(`idb_${msg.key}`);
            if (cb) cb();
            return Promise.resolve();
        }
        if (msg.type === 'DB_GET_BATCH') {
            const vals = msg.keys.map(k => mockStorage.get(`idb_${k}`));
            if (cb) cb(vals);
            return Promise.resolve(vals);
        }
        if (msg.type === 'DB_KEYS') {
            const res = [];
            for (const k of mockStorage.keys()) if (k.startsWith('idb_page:')) res.push(k.replace('idb_page:', ''));
            if (cb) cb(res);
            return Promise.resolve(res);
        }
        if (msg.type === 'DB_UPDATE') {
            const old = mockStorage.get(`idb_${msg.key}`);
            let newVal;
            if (msg.cmd === 'clear_highlights') { if (old) old.highlights = []; newVal = old; }
            else if (msg.cmd === 'replace_drawings') { newVal = old || { url: msg.key.replace(/^page:/, ''), highlights: [], drawings: [] }; newVal.drawings = msg.value; }
            else newVal = msg.value;
            mockStorage.set(`idb_${msg.key}`, newVal);
            if (cb) cb(newVal);
            return Promise.resolve(newVal);
        }
        if (msg.type === 'DB_ENTRIES') {
            const res = [];
            for (const [k, v] of mockStorage.entries()) if (k.startsWith('idb_page:')) res.push([k.replace('idb_page:', ''), v]);
            if (cb) cb(res);
            return Promise.resolve(res);
        }
        if (cb) cb();
        return Promise.resolve();
    })
  },
  storage: {
    local: {
      get: mock.fn(async (keys) => {
        if (!keys) return Object.fromEntries(mockStorage);
        if (typeof keys === 'string') return { [keys]: mockStorage.get(keys) };
        if (Array.isArray(keys)) {
          const res = {};
          keys.forEach(k => res[k] = mockStorage.get(k));
          return res;
        }
        if (typeof keys === 'object') {
            const res = {};
            for (const k in keys) res[k] = mockStorage.has(k) ? mockStorage.get(k) : keys[k];
            return res;
        }
        return {};
      }),
      set: mock.fn(async (items) => {
        for (const [k, v] of Object.entries(items)) mockStorage.set(k, v);
      }),
      remove: mock.fn(async (keys) => {
        if (Array.isArray(keys)) keys.forEach(k => mockStorage.delete(k));
        else mockStorage.delete(keys);
      })
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

global.tinyIDB = {
  get: mock.fn(async (key) => mockStorage.get(`idb_page:${key}`)),
  getBatch: mock.fn(async (keys) => keys.map(k => mockStorage.get(`idb_page:${k}`))),
  set: mock.fn(async (key, val) => { mockStorage.set(`idb_page:${key}`, val); }),
  remove: mock.fn(async (key) => { mockStorage.delete(`idb_page:${key}`); }),
  update: mock.fn(async (key, cmd, value) => {
    const old = await global.tinyIDB.get(key);
    let newVal;
    if (cmd === 'clear_highlights') { if (old) old.highlights = []; newVal = old; }
    else if (cmd === 'replace_drawings') { newVal = old || { url: key, highlights: [], drawings: [] }; newVal.drawings = value; }
    else newVal = value;
    await global.tinyIDB.set(key, newVal);
  }),
  keys: mock.fn(async () => {
    const res = [];
    for (const k of mockStorage.keys()) if (k.startsWith('idb_page:')) res.push(k.replace('idb_page:', ''));
    return res;
  }),
  entries: mock.fn(async () => {
    const res = [];
    for (const [k, v] of mockStorage.entries()) if (k.startsWith('idb_page:')) res.push([k.replace('idb_page:', ''), v]);
    return res;
  }),
  clear: mock.fn(async () => {
    for (const key of mockStorage.keys()) if (key.startsWith('idb_')) mockStorage.delete(key);
  })
};

global.SharedUtils = require('../utils/shared.js');
global.CONSTANTS = require('../utils/consts.js').CONSTANTS;
const { ICONS, SHADOW_STYLES } = require('../content/assets.js');
global.ICONS = ICONS;
global.SHADOW_STYLES = SHADOW_STYLES;
global.DOMUtils = require('../content/dom_utils.js').DOMUtils;
global.UI = require('../content/ui.js').UI;
global.Whiteboard = require('../content/whiteboard.js').Whiteboard;
global.Highlighter = require('../content/highlighter.js').Highlighter;
global.Marklet = require('../content/marklet.js').Marklet;
