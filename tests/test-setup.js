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
            const val = mockStorage.get(`idb:${msg.key}`);
            if (cb) cb(val);
            return Promise.resolve(val);
        }
        if (msg.type === 'DB_SET') {
            mockStorage.set(`idb:${msg.key}`, msg.value);
            if (cb) cb();
            return Promise.resolve();
        }
        if (msg.type === 'DB_REMOVE') {
            mockStorage.delete(`idb:${msg.key}`);
            if (cb) cb();
            return Promise.resolve();
        }
        if (msg.type === 'DB_GET_BATCH') {
            const vals = msg.keys.map(k => mockStorage.get(`idb:${k}`));
            if (cb) cb(vals);
            return Promise.resolve(vals);
        }
        if (msg.type === 'DB_KEYS') {
            const res = [];
            for (const k of mockStorage.keys()) if (k.startsWith('idb:')) res.push(k.replace('idb:', ''));
            if (cb) cb(res);
            return Promise.resolve(res);
        }
        if (msg.type === 'DB_COUNT') {
            let count = 0;
            for (const k of mockStorage.keys()) if (k.startsWith('idb:')) count += 1;
            if (cb) cb(count);
            return Promise.resolve(count);
        }
        if (msg.type === 'DB_UPDATE') {
            const old = mockStorage.get(`idb:${msg.key}`);
            let newVal;
            if (msg.cmd === 'clear_highlights') { if (old) old.highlights = []; newVal = old; }
            else if (msg.cmd === 'clear_drawings') {
                newVal = old || { url: msg.key, highlights: [], drawings: [] };
                newVal.drawings = [];
                if (!newVal.highlights.length) {
                    mockStorage.delete(`idb:${msg.key}`);
                    if (cb) cb();
                    return Promise.resolve();
                }
            }
            else if (msg.cmd === 'replace_drawings') {
                newVal = old || { url: msg.key, highlights: [], drawings: [] };
                newVal.drawings = msg.value;
                if (!newVal.highlights.length && !newVal.drawings.length) {
                    mockStorage.delete(`idb:${msg.key}`);
                    if (cb) cb();
                    return Promise.resolve();
                }
            }
            else if (msg.cmd === 'delete_highlight') {
                newVal = old || { url: msg.key, highlights: [], drawings: [] };
                newVal.highlights = (newVal.highlights || []).filter((item) => item.id !== msg.value?.id);
                if (!newVal.highlights.length && !newVal.drawings.length) {
                    mockStorage.delete(`idb:${msg.key}`);
                    if (cb) cb();
                    return Promise.resolve();
                }
            }
            else if (msg.cmd === 'set_highlight_color') {
                newVal = old || { url: msg.key, highlights: [], drawings: [] };
                newVal.highlights = (newVal.highlights || []).map((item) => item.id === msg.value?.id ? { ...item, color: msg.value?.color } : item);
            }
            else newVal = msg.value;
            mockStorage.set(`idb:${msg.key}`, newVal);
            if (cb) cb(newVal);
            return Promise.resolve(newVal);
        }
        if (msg.type === 'DB_ENTRIES') {
            const res = [];
            for (const [k, v] of mockStorage.entries()) if (k.startsWith('idb:')) res.push([k.replace('idb:', ''), v]);
            if (cb) cb(res);
            return Promise.resolve(res);
        }
        if (msg.type === 'DB_QUERY_PAGES') {
            const search = (msg.options?.search || '').trim().toLowerCase();
            const offset = msg.options?.offset || 0;
            const limit = msg.options?.limit || 25;
            const res = [];
            for (const [k, v] of mockStorage.entries()) {
                if (!k.startsWith('idb:')) continue;
                const url = k.replace('idb:', '');
                const page = SharedUtils.normalizePageData(v, url);
                const hasAnnotations = page.highlights.length > 0 || page.drawings.length > 0;
                if (!hasAnnotations) continue;
                if (search && !url.toLowerCase().includes(search) && 
                    !page.highlights.some((highlight) => (highlight.text || '').toLowerCase().includes(search)) &&
                    !page.drawings.some((drawing) => (drawing.text || '').toLowerCase().includes(search))) continue;
                res.push({
                    url,
                    lastUpdated: page.lastUpdated || 0,
                    highlightCount: page.highlights.length,
                    drawingCount: page.drawings.length,
                    previewHighlights: page.highlights.slice(0, 3).map((highlight) => ({ ...highlight })),
                    highlights: page.highlights.map((highlight) => ({ ...highlight }))
                });
            }
            res.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
            const payload = { items: res.slice(offset, offset + limit), total: res.length, offset, limit, processed: res.length, matched: res.length };
            if (cb) cb(payload);
            return Promise.resolve(payload);
        }
        if (msg.type === 'DB_EXPORT_PAGES') {
            const pages = {};
            for (const [k, v] of mockStorage.entries()) {
                if (k.startsWith('idb:')) pages[k.replace('idb:', '')] = SharedUtils.normalizePageData(v, k.replace('idb:', ''));
            }
            const payload = { pages, total: Object.keys(pages).length, processed: Object.keys(pages).length };
            if (cb) cb(payload);
            return Promise.resolve(payload);
        }
        if (msg.type === 'DB_IMPORT_PAGES') {
            const pages = msg.pages || {};
            if (msg.options?.mode === 'replace-all') {
                for (const key of [...mockStorage.keys()]) if (key.startsWith('idb:')) mockStorage.delete(key);
            }
            for (const [url, page] of Object.entries(pages)) {
                const current = SharedUtils.normalizePageData(mockStorage.get(`idb:${url}`), url);
                const next = SharedUtils.normalizePageData(page, url);
                if (msg.options?.mode === 'append') {
                    mockStorage.set(`idb:${url}`, {
                        ...current,
                        ...next,
                        url,
                        highlights: [...current.highlights, ...next.highlights],
                        drawings: [...current.drawings, ...next.drawings],
                        lastUpdated: Math.max(current.lastUpdated || 0, next.lastUpdated || 0)
                    });
                } else if (next.highlights.length === 0 && next.drawings.length === 0) {
                    mockStorage.delete(`idb:${url}`);
                } else {
                    mockStorage.set(`idb:${url}`, next);
                }
            }
            const payload = { processed: Object.keys(pages).length, total: Object.keys(pages).length };
            if (cb) cb(payload);
            return Promise.resolve(payload);
        }
        if (msg.type === 'DB_CLEAR_PAGES') {
            let deleted = 0;
            for (const key of [...mockStorage.keys()]) {
                if (!key.startsWith('idb:')) continue;
                mockStorage.delete(key);
                deleted += 1;
            }
            if (cb) cb(deleted);
            return Promise.resolve(deleted);
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

const listMockIDBEntries = () => [...mockStorage.entries()]
  .filter(([key]) => key.startsWith('idb:'))
  .map(([key, value]) => [key.replace('idb:', ''), value])
  .sort(([left], [right]) => left.localeCompare(right));

const createMockIDBRequest = (run) => {
  const request = {
    onsuccess: null,
    onerror: null,
    result: undefined,
    error: null
  };
  queueMicrotask(() => {
    try {
      request.result = run();
      if (typeof request.onsuccess === 'function') request.onsuccess();
    } catch (error) {
      request.error = error;
      if (typeof request.onerror === 'function') request.onerror();
    }
  });
  return request;
};

global.PageStorage = {
  MODE_RO: 'readonly',
  MODE_RW: 'readwrite',
  DIR_NEXT: 'next',
  DIR_PREV: 'prev',
  open: mock.fn(() => global.tinyIDB),
  get: mock.fn(async (key) => mockStorage.get(`idb:${key}`)),
  getBatch: mock.fn(async (keys) => keys.map(k => mockStorage.get(`idb:${k}`))),
  set: mock.fn(async (key, val) => { mockStorage.set(`idb:${key}`, val); }),
  remove: mock.fn(async (key) => { mockStorage.delete(`idb:${key}`); }),
  update: mock.fn(async (key, cmd, value) => {
    const old = await global.PageStorage.get(key);
    let newVal;
    if (cmd === 'clear_highlights') { if (old) old.highlights = []; newVal = old; }
    else if (cmd === 'clear_drawings') {
      newVal = old || { url: key, highlights: [], drawings: [] };
      newVal.drawings = [];
      if (!newVal.highlights.length) {
        await global.PageStorage.remove(key);
        return;
      }
    }
    else if (cmd === 'replace_drawings') {
      newVal = old || { url: key, highlights: [], drawings: [] };
      newVal.drawings = value;
      if (!newVal.highlights.length && !newVal.drawings.length) {
        await global.PageStorage.remove(key);
        return;
      }
    }
    else if (cmd === 'delete_highlight') {
      newVal = old || { url: key, highlights: [], drawings: [] };
      newVal.highlights = (newVal.highlights || []).filter((item) => item.id !== value?.id);
      if (!newVal.highlights.length && !newVal.drawings.length) {
        await global.PageStorage.remove(key);
        return;
      }
    }
    else if (cmd === 'set_highlight_color') {
      newVal = old || { url: key, highlights: [], drawings: [] };
      newVal.highlights = (newVal.highlights || []).map((item) => item.id === value?.id ? { ...item, color: value?.color } : item);
    }
    else newVal = value;
    await global.PageStorage.set(key, newVal);
  }),
  keys: mock.fn(async () => {
    const res = [];
    for (const k of mockStorage.keys()) if (k.startsWith('idb:')) res.push(k.replace('idb:', ''));
    return res;
  }),
  values: mock.fn(async () => listMockIDBEntries().map(([, value]) => value)),
  count: mock.fn(async () => {
    let count = 0;
    for (const k of mockStorage.keys()) if (k.startsWith('idb:')) count += 1;
    return count;
  }),
  has: mock.fn(async (key) => mockStorage.has(`idb:${key}`)),
  entries: mock.fn(async () => {
    const res = [];
    for (const [k, v] of mockStorage.entries()) if (k.startsWith('idb:')) res.push([k.replace('idb:', ''), v]);
    return res;
  }),
  paginate: mock.fn(async (limit, start, dir = 'next', filter) => {
    let items = listMockIDBEntries();
    if ((dir || '').startsWith('prev')) items = items.slice().reverse();
    if (start != null) {
      const startIndex = items.findIndex(([key]) => key === start);
      if (startIndex !== -1) items = items.slice(startIndex);
    }
    if (typeof filter === 'function') items = items.filter(([key, value]) => filter(value, key));
    const pageItems = limit == null ? items : items.slice(0, limit);
    return {
      items: pageItems,
      next: pageItems.length < items.length ? items[pageItems.length][0] : null
    };
  }),
  queryPages: mock.fn(async (options = {}) => {
    const search = (options.search || '').trim().toLowerCase();
    const offset = options.offset || 0;
    const limit = options.limit || 25;
    const res = [];
    for (const [k, v] of mockStorage.entries()) {
        if (!k.startsWith('idb:')) continue;
        const url = k.replace('idb:', '');
        const page = SharedUtils.normalizePageData(v, url);
        const hasAnnotations = page.highlights.length > 0 || page.drawings.length > 0;
        if (!hasAnnotations) continue;
        if (search && !url.toLowerCase().includes(search) && 
            !page.highlights.some((highlight) => (highlight.text || '').toLowerCase().includes(search)) &&
            !page.drawings.some((drawing) => (drawing.text || '').toLowerCase().includes(search))) continue;
        res.push({
            url,
            lastUpdated: page.lastUpdated || 0,
            highlightCount: page.highlights.length,
            drawingCount: page.drawings.length,
            previewHighlights: page.highlights.slice(0, 3).map((highlight) => ({ ...highlight })),
            highlights: page.highlights.map((highlight) => ({ ...highlight }))
        });
    }
    res.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    return { items: res.slice(offset, offset + limit), total: res.length, offset, limit, processed: res.length, matched: res.length };
  }),
  exportPages: mock.fn(async () => {
    const pages = {};
    for (const [k, v] of mockStorage.entries()) if (k.startsWith('idb:')) pages[k.replace('idb:', '')] = SharedUtils.normalizePageData(v, k.replace('idb:', ''));
    return { pages, total: Object.keys(pages).length, processed: Object.keys(pages).length };
  }),
  importPages: mock.fn(async (pages, options = {}) => {
    if (options.mode === 'replace-all') {
        for (const key of [...mockStorage.keys()]) if (key.startsWith('idb:')) mockStorage.delete(key);
    }
    for (const [url, page] of Object.entries(pages || {})) {
        const current = SharedUtils.normalizePageData(mockStorage.get(`idb:${url}`), url);
        const next = SharedUtils.normalizePageData(page, url);
        if (options.mode === 'append') {
            mockStorage.set(`idb:${url}`, {
                ...current,
                ...next,
                url,
                highlights: [...current.highlights, ...next.highlights],
                drawings: [...current.drawings, ...next.drawings],
                lastUpdated: Math.max(current.lastUpdated || 0, next.lastUpdated || 0)
            });
        } else if (next.highlights.length === 0 && next.drawings.length === 0) {
            mockStorage.delete(`idb:${url}`);
        } else {
            mockStorage.set(`idb:${url}`, next);
        }
    }
    return { processed: Object.keys(pages || {}).length, total: Object.keys(pages || {}).length };
  }),
  clearPages: mock.fn(async () => {
    for (const key of [...mockStorage.keys()]) if (key.startsWith('idb:')) mockStorage.delete(key);
  }),
  clear: mock.fn(async () => {
    for (const key of mockStorage.keys()) if (key.startsWith('idb:')) mockStorage.delete(key);
  })
};

const rawAccess = Object.assign(mock.fn(async (cb) => cb({
  get: (key) => createMockIDBRequest(() => mockStorage.get(`idb:${key}`)),
  put: (value, key) => createMockIDBRequest(() => {
    mockStorage.set(`idb:${key}`, value);
    return key;
  }),
  delete: (key) => createMockIDBRequest(() => {
    mockStorage.delete(`idb:${key}`);
    return undefined;
  })
})), {
  MODE_RO: 'readonly',
  MODE_RW: 'readwrite',
  DIR_NEXT: 'next',
  DIR_PREV: 'prev',
  get: mock.fn(async (key) => mockStorage.get(`idb:${key}`)),
  getBatch: mock.fn(async (keys) => keys.map(k => mockStorage.get(`idb:${k}`))),
  set: mock.fn(async (key, val) => { mockStorage.set(`idb:${key}`, val); }),
  remove: mock.fn(async (key) => { mockStorage.delete(`idb:${key}`); }),
  has: mock.fn(async (key) => mockStorage.has(`idb:${key}`)),
  paginate: mock.fn(async (limit, start, dir = 'next', filter) => global.PageStorage.paginate(limit, start, dir, filter)),
  update: mock.fn(async (key, fn) => {
    const current = mockStorage.get(`idb:${key}`);
    const next = await fn(current);
    mockStorage.set(`idb:${key}`, next);
    return next;
  }),
  count: mock.fn(async () => global.PageStorage.count()),
  clear: mock.fn(async () => {
    for (const key of mockStorage.keys()) if (key.startsWith('idb:')) mockStorage.delete(key);
  })
});
global.PageStorage.raw = rawAccess;

global.tinyIDB = global.PageStorage;

global.SharedUI = {
    _root: null,
    init: mock.fn((root) => { global.SharedUI._root = root; }),
    alert: mock.fn(async () => {}),
    confirm: mock.fn(async () => true),
    toast: mock.fn((msg) => {
        const root = global.SharedUI._root || document.body;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        root.appendChild(toast);
    }),
    showModal: mock.fn(async (options) => {
        const message = options.message || options.body?.textContent || '';
        return global.SharedUI.confirm(options.title, message, options);
    }),
    el: (tag, ...args) => {
        const el = document.createElement(tag);
        const children = [];
        let parentNode = null;
        for (const arg of args) {
          if (!arg) continue;
          if (typeof arg === 'string') {
            el.classList.add(...arg.trim().split(/\s+/).filter(Boolean));
          } else if (arg instanceof Node) {
            children.push(arg);
          } else if (Array.isArray(arg)) {
            children.push(...arg);
          } else if (typeof arg === 'function') {
            arg(el);
          } else if (typeof arg === 'object') {
            if (arg.text !== undefined) el.textContent = arg.text;
            if (arg.html !== undefined) el.innerHTML = arg.html;
            if (arg.className) el.classList.add(...arg.className.trim().split(/\s+/).filter(Boolean));
            if (arg.style && typeof arg.style === 'object') {
              Object.entries(arg.style).forEach(([k, v]) => {
                if (k.startsWith('--')) el.style.setProperty(k, v);
                else el.style[k] = v;
              });
            }
            if (arg.attrs) Object.entries(arg.attrs).forEach(([k, v]) => {
              if (v !== null && v !== undefined) el.setAttribute(k, v);
            });
            if (arg.on) Object.entries(arg.on).forEach(([k, v]) => el.addEventListener(k, v));
            const specials = ['text', 'html', 'className', 'style', 'attrs', 'on', 'parent'];
            Object.entries(arg).forEach(([k, v]) => {
              if (!specials.includes(k)) el[k] = v;
            });
            const isNode = arg.parent && (arg.parent instanceof Node || (typeof arg.parent === 'object' && typeof arg.parent.nodeType === 'number'));
            if (isNode) {
                parentNode = arg.parent;
            }
          }
        }
        children.forEach(child => {
          if (child) {
            const isChildNode = child instanceof Node || (typeof child === 'object' && typeof child.nodeType === 'number');
            el.appendChild(isChildNode ? child : document.createTextNode(String(child)));
          }
        });
        if (parentNode) {
            parentNode.appendChild(el);
        }
        return el;
    },
    div(...args) { return this.el('div', ...args); },
    span(...args) { return this.el('span', ...args); },
    button(...args) { return this.el('button', ...args); },
    icon(html) { return this.el('span', 'icon', { html }); },
    empty(text) { return this.div('empty-state', { text }); },
    card(...args) { return this.div('settings-section', ...args); },
    row(...args) { return this.div('setting-item', ...args); },
    info(title, hint) {
        return this.div('setting-info', [
          this.span({ text: title }),
          hint ? this.div('setting-hint', { text: hint }) : null
        ].filter(Boolean));
    },
};

// Global reset for SharedUI mocks to ensure test isolation
if (typeof beforeEach !== 'undefined') {
    beforeEach(() => {
        if (global.SharedUI.confirm.mock) global.SharedUI.confirm.mock.resetCalls();
        if (global.SharedUI.alert.mock) global.SharedUI.alert.mock.resetCalls();
        if (global.SharedUI.toast.mock) global.SharedUI.toast.mock.resetCalls();
    });
}

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
