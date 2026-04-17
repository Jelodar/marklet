/** tiny-idb - MIT © Jelodar */

const instances = new Map();
const prom = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});
const RO = 'readonly', RW = 'readwrite';

const getAPI = (dbName = 'tiny-idb', s = dbName, b = true) => {
  if (s === !!s) [b, s] = [s, dbName];
  const key = dbName + '\0' + s + '\0' + b;
  if (instances.has(key)) return instances.get(key);

  let dbPromise, queue = [];
  const flush = async () => {
    const items = queue; queue = [];
    try {
      const mode = items.some(i => i.m === RW) ? RW : RO;
      await tx(mode, async store => {
        for (const { c, r } of items) r(await c(store));
      });
    } catch (e) {
      items.forEach(i => i.j(e));
    }
  };

  const tx = async (mode, cb) => {
    const db = await (dbPromise || (dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(s);
      req.onsuccess = () => {
        const d = req.result;
        d.onversionchange = () => { d.close(); dbPromise = 0; };
        resolve(d);
      };
      req.onerror = () => { dbPromise = 0; reject(req.error); };
    })));
    return new Promise((resolve, reject) => {
      const t = db.transaction(s, mode);
      t.oncomplete = () => resolve();
      t.onabort = t.onerror = () => reject(t.error || new DOMException('Aborted'));
      cb(t.objectStore(s)).catch(e => { try { t.abort(); } catch {} reject(e); });
    });
  };

  const op = (m, c) => new Promise((r, j) => {
    queue.push({ m, c, r, j });
    if (queue.length < 2) b ? queueMicrotask(flush) : flush();
  });

  const update = (key, fn) => op(RW, async store => prom(store.put(await fn(await prom(store.get(key))), key)));

  const api = {
    open: getAPI,
    set: (key, value) => op(RW, store => prom(store.put(value, key))),
    get: key => op(RO, store => prom(store.get(key))),
    remove: key => op(RW, store => prom(store.delete(key))),
    clear: () => op(RW, store => prom(store.clear())),
    keys: () => op(RO, store => prom(store.getAllKeys())),
    values: () => op(RO, store => prom(store.getAll())),
    entries: () => op(RO, async store => {
      const [k, v] = await Promise.all([prom(store.getAllKeys()), prom(store.getAll())]);
      return k.map((key, i) => [key, v[i]]);
    }),
    count: () => op(RO, store => prom(store.count())),
    raw: (cb, mode = RO) => op(mode, cb),
    update,
    push: (key, val) => update(key, (c = []) => [...(Array.isArray(c) ? c : []), val]),
    merge: (key, obj) => update(key, (c = {}) => ({ ...(c && typeof c === 'object' ? c : {}), ...obj }))
  };

  ['get', 'set', 'remove'].forEach(m => api[m + 'Item'] = api[m]);
  instances.set(key, api);
  return api;
};
const tinyIDB = getAPI();
