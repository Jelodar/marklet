const core = Object.assign({}, tinyIDB);
const PK = (key) => key.startsWith('page:') ? key : `page:${key}`;
const raw = Object.assign({}, core, {
  getBatch: (keys) => Promise.all(keys.map(key => core.get(key)))
});
const scanPageStoreWithCursor = (collect) => raw.raw((store) => new Promise((resolve, reject) => {
  const request = store.openCursor();
  const state = collect.init();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) {
      resolve(collect.finish(state));
      return;
    }
    if (typeof cursor.key === 'string' && cursor.key.startsWith('page:')) {
      collect.step(state, cursor.key.substring(5), cursor.value);
    }
    cursor.continue();
  };
  request.onerror = () => reject(request.error);
}));
const sendStorageMessage = (message) => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }
    if (response && typeof response === 'object' && !Array.isArray(response) && Object.prototype.hasOwnProperty.call(response, 'ok')) {
      if (!response.ok) {
        reject(new Error(response.error || 'Storage request failed'));
        return;
      }
      resolve(response.value);
      return;
    }
    resolve(response);
  });
});

const directStorage = {
  get: (key) => raw.get(PK(key)),
  set: (key, value) => raw.set(PK(key), value),
  remove: (key) => raw.remove(PK(key)),
  getBatch: (keys) => raw.getBatch(keys.map(PK)),
  update: (key, cmd, value) => raw.update(PK(key), (old) => {
    if (cmd === 'clear_highlights') {
      if (old) old.highlights = [];
      return old;
    }
    if (cmd === 'replace_drawings') {
      const page = old || { url: key, highlights: [], drawings: [] };
      page.drawings = value;
      return page;
    }
    return value;
  }),
  keys: () => scanPageStoreWithCursor({
    init: () => [],
    step: (keys, key) => keys.push(key),
    finish: (keys) => keys
  }),
  values: () => scanPageStoreWithCursor({
    init: () => [],
    step: (values, key, value) => values.push(value),
    finish: (values) => values
  }),
  entries: () => scanPageStoreWithCursor({
    init: () => [],
    step: (entries, key, value) => entries.push([key, value]),
    finish: (entries) => entries
  }),
  count: () => scanPageStoreWithCursor({
    init: () => ({ count: 0 }),
    step: (state) => { state.count += 1; },
    finish: (state) => state.count
  }),
  clear: () => raw.clear(),
  raw
};

const StorageProxy = {
  get: (key) => sendStorageMessage({ type: 'DB_GET', key: PK(key) }),
  set: (key, value) => sendStorageMessage({ type: 'DB_SET', key: PK(key), value }),
  remove: (key) => sendStorageMessage({ type: 'DB_REMOVE', key: PK(key) }),
  getBatch: (keys) => sendStorageMessage({ type: 'DB_GET_BATCH', keys: keys.map(PK) }),
  update: (key, cmd, value) => sendStorageMessage({ type: 'DB_UPDATE', key: PK(key), cmd, value }),
  keys: () => sendStorageMessage({ type: 'DB_KEYS' }),
  values: async () => {
    const entries = await StorageProxy.entries();
    return entries.map(([, value]) => value);
  },
  entries: () => sendStorageMessage({ type: 'DB_ENTRIES' }),
  count: async () => {
    const keys = await StorageProxy.keys();
    return keys.length;
  },
  clear: () => sendStorageMessage({ type: 'DB_CLEAR' }),
  raw
};

const activeStorage = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id
  ? ((typeof location !== 'undefined' && location.protocol === 'chrome-extension:') ? directStorage : StorageProxy)
  : directStorage;

Object.assign(tinyIDB, activeStorage);
