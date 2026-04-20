(() => {
  const MODE_RO = 'readonly';
  const MODE_RW = 'readwrite';
  const DIR_NEXT = 'next';
  const DIR_PREV = 'prev';

  const instances = new Map();
  const conns = new Map();

  const wrap = (req) => new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  const getAPI = (dbName = 'tiny-idb', storeName = dbName, batching = true) => {
    if (typeof storeName === 'boolean') [batching, storeName] = [storeName, dbName];

    const key = dbName + '\0' + storeName;
    if (instances.has(key)) return instances.get(key);

    let conn = conns.get(dbName);
    if (!conn) conns.set(dbName, conn = { names: new Set() });
    conn.names.add(storeName);

    let queue = [];

    const flush = async () => {
      const batch = queue;
      queue = [];
      try {
        const mode = batch.some((op) => op.mode === MODE_RW) ? MODE_RW : MODE_RO;
        const results = await tx(mode, async (store) => {
          const values = [];
          for (const op of batch) values.push(await op.cb(store));
          return values;
        });
        batch.forEach((op, index) => op.res(results[index]));
      } catch (error) {
        batch.forEach((op) => op.rej(error));
      }
    };

    const tx = async (mode, cb) => {
      while (true) {
        const db = await (conn.pr || (conn.pr = new Promise((res, rej) => {
          const init = (version) => {
            const req = indexedDB.open(dbName, version);
            req.onupgradeneeded = () => conn.names.forEach((name) => {
              if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
            });
            req.onsuccess = () => {
              const database = req.result;
              if ([...conn.names].some((name) => !database.objectStoreNames.contains(name))) {
                database.close();
                init(database.version + 1);
                return;
              }
              database.onversionchange = () => {
                database.close();
                conn.pr = 0;
              };
              res(database);
            };
            req.onerror = () => {
              conn.pr = 0;
              rej(req.error);
            };
          };
          init();
        })));

        try {
          return await new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode);
            let done = false;
            let closed = false;
            let value;
            const fail = (error) => reject(error);

            transaction.oncomplete = () => {
              closed = true;
              if (done) resolve(value);
              else fail(new DOMException('Transaction closed', 'TransactionInactiveError'));
            };
            transaction.onabort = transaction.onerror = () => fail(transaction.error || new DOMException('Aborted'));

            Promise.resolve(cb(transaction.objectStore(storeName))).then((result) => {
              done = true;
              value = result;
              if (closed) resolve(result);
            }, (error) => {
              try { transaction.abort(); } catch {}
              fail(error);
            });
          });
        } catch (error) {
          if (error && error.name === 'InvalidStateError') {
            conn.pr = 0;
            continue;
          }
          throw error;
        }
      }
    };

    const operation = (mode, cb) => new Promise((res, rej) => {
      queue.push({ mode, cb, res, rej });
      if (queue.length < 2) batching ? queueMicrotask(flush) : flush();
    });

    const walk = (filter, limit, range, dir, includeCursor) => operation(MODE_RO, (store) => new Promise((res, rej) => {
      const items = [];
      const req = store.openCursor(range, dir);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || (limit != null && items.length === limit)) {
          res(includeCursor ? { items, next: cursor ? cursor.key : null } : items);
          return;
        }
        if (!filter || filter(cursor.value, cursor.key)) items.push([cursor.key, cursor.value]);
        cursor.continue();
      };
      req.onerror = () => rej(req.error);
    }));

    const update = (key, fn) => operation(MODE_RW, async (store) => {
      return wrap(store.put(await fn(await wrap(store.get(key)), key)));
    });

    const api = {
      open: getAPI,
      MODE_RO,
      MODE_RW,
      DIR_NEXT,
      DIR_PREV,
      set: (key, value) => operation(MODE_RW, (store) => wrap(store.put(value, key))),
      get: (key) => operation(MODE_RO, (store) => wrap(store.get(key))),
      remove: (key) => operation(MODE_RW, (store) => wrap(store.delete(key))),
      clear: () => operation(MODE_RW, (store) => wrap(store.clear())),
      keys: () => operation(MODE_RO, (store) => wrap(store.getAllKeys())),
      values: () => operation(MODE_RO, (store) => wrap(store.getAll())),
      entries: (filter) => walk(filter),
      paginate: (limit, start, dir, filter) => {
        let range = start;
        if (start != null && !(typeof IDBKeyRange !== 'undefined' && start instanceof IDBKeyRange)) {
          range = (dir || '').startsWith(DIR_PREV) ? IDBKeyRange.upperBound(start) : IDBKeyRange.lowerBound(start);
        }
        return walk(filter, limit, range, dir, true);
      },
      count: () => operation(MODE_RO, (store) => wrap(store.count())),
      has: (key) => operation(MODE_RO, async (store) => !!(await wrap(store.count(key)))),
      raw: (cb, mode = MODE_RO) => operation(mode, cb),
      update,
      push: (key, value) => update(key, (current = []) => [...(Array.isArray(current) ? current : []), value]),
      merge: (key, patch) => isObject(patch)
        ? update(key, (current) => ({ ...(isObject(current) ? current : {}), ...patch }))
        : Promise.reject(new TypeError('merge patch must be a non-null object'))
    };

    ['get', 'set', 'remove'].forEach((name) => {
      api[name + 'Item'] = api[name];
    });

    instances.set(key, api);
    return api;
  };

  globalThis.tinyIDB = getAPI();

  if (typeof module !== 'undefined') {
    module.exports = { tinyIDB: globalThis.tinyIDB };
  }
})();
