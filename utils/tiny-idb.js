/** tiny-idb - MIT © Jelodar */

const instances = new Map();
const prom = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});
const RO = 'readonly', RW = 'readwrite';

const getAPI = (dbName = 'tiny-idb', storeName = undefined) => {
  storeName = storeName || dbName;
  const key = dbName + '\0' + storeName;
  if (instances.has(key)) return instances.get(key);

  let dbPromise;
  const tx = async (mode, cb) => {
    const db = await (dbPromise || (dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    })));
    return new Promise(async (resolve, reject) => {
      const t = db.transaction(storeName, mode);
      t.onabort = t.onerror = () => reject(t.error || new DOMException('Aborted'));
      try {
        const res = await cb(t.objectStore(storeName));
        t.oncomplete = () => resolve(res);
      } catch (e) {
        try { t.abort(); } catch {}
        reject(e);
      }
    });
  };

  const update = (key, fn) => tx(RW, async s => prom(s.put(await fn(await prom(s.get(key))), key)));

  const api = {
    open: getAPI,
    set: (key, value) => tx(RW, s => prom(s.put(value, key))),
    get: key => tx(RO, s => prom(s.get(key))),
    remove: key => tx(RW, s => prom(s.delete(key))),
    clear: () => tx(RW, s => prom(s.clear())),
    keys: () => tx(RO, s => prom(s.getAllKeys())),
    values: () => tx(RO, s => prom(s.getAll())),
    entries: () => tx(RO, async s => {
      const [k, v] = await Promise.all([prom(s.getAllKeys()), prom(s.getAll())]);
      return k.map((key, i) => [key, v[i]]);
    }),
    count: () => tx(RO, s => prom(s.count())),
    update,
    getBatch: (keys) => tx(RO, async s => {
        return Promise.all(keys.map(k => prom(s.get(k))));
    }),
    push: (key, val) => update(key, (c = []) => [...(Array.isArray(c) ? c : []), val]),
    merge: (key, obj) => update(key, (c = {}) => ({ ...(c && typeof c === 'object' ? c : {}), ...obj }))
  };

  ['get', 'set', 'remove'].forEach(m => api[m + 'Item'] = api[m]);
  instances.set(key, api);
  return api;
};

const api = getAPI();
const PK = (k) => k.startsWith('page:') ? k : `page:${k}`;

const StorageProxy = {
    get: (key) => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_GET', key: PK(key) }, r)),
    set: (key, value) => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_SET', key: PK(key), value }, r)),
    remove: (key) => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_REMOVE', key: PK(key) }, r)),
    getBatch: (keys) => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_GET_BATCH', keys: keys.map(PK) }, r)),
    update: (key, cmd, value) => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_UPDATE', key: PK(key), cmd, value }, r)),
    keys: () => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_KEYS' }, r)),
    entries: () => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_ENTRIES' }, r)),
    clear: () => new Promise(r => chrome.runtime.sendMessage({ type: 'DB_CLEAR' }, r))
};

const wrapped = {
    get: (key) => api.get(PK(key)),
    set: (key, val) => api.set(PK(key), val),
    remove: (key) => api.remove(PK(key)),
    getBatch: (keys) => api.getBatch(keys.map(PK)),
    update: (key, cmd, val) => api.update(PK(key), (old) => {
        if (cmd === 'clear_highlights') { if (old) old.highlights = []; return old; }
        if (cmd === 'replace_drawings') { const p = old || { url: key, highlights: [], drawings: [] }; p.drawings = val; return p; }
        return val;
    }),
    keys: async () => {
        const k = await api.keys();
        return k.filter(x => x.startsWith('page:')).map(x => x.substring(5));
    },
    entries: async () => {
        const e = await api.entries();
        return e.filter(([k]) => k.startsWith('page:')).map(([k, v]) => [k.substring(5), v]);
    },
    clear: () => api.clear(),
    raw: api
};

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    const isExtensionOrigin = typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
    self.tinyIDB = isExtensionOrigin ? wrapped : StorageProxy;
} else {
    self.tinyIDB = wrapped;
}
