const core = tinyIDB.open('marklet', 'pages');
const PAGE_BATCH_SIZE = 100;
const PAGE_STORAGE_MODE_RO = core.MODE_RO || 'readonly';
const PAGE_STORAGE_MODE_RW = core.MODE_RW || 'readwrite';
const PAGE_STORAGE_DIR_NEXT = core.DIR_NEXT || 'next';
const PAGE_STORAGE_DIR_PREV = core.DIR_PREV || 'prev';

const raw = {
  get: async (...args) => { return core.get(...args); },
  set: async (...args) => { return core.set(...args); },
  remove: async (...args) => { return core.remove(...args); },
  clear: async (...args) => { return core.clear(...args); },
  keys: async (...args) => { return core.keys(...args); },
  values: async (...args) => { return core.values(...args); },
  entries: async (...args) => { return core.entries(...args); },
  count: async (...args) => { return core.count(...args); },
  has: async (...args) => { return typeof core.has === 'function' ? core.has(...args) : core.get(...args).then((value) => value !== undefined); },
  update: async (...args) => { return core.update(...args); },
  paginate: async (...args) => { return typeof core.paginate === 'function' ? core.paginate(...args) : Promise.reject(new Error('Pagination is not supported')); },
  raw: async (cb, mode) => { return core.raw(cb, mode); },
  getBatch: async (keys) => { return Promise.all(keys.map((key) => core.get(key))); },
  MODE_RO: PAGE_STORAGE_MODE_RO,
  MODE_RW: PAGE_STORAGE_MODE_RW,
  DIR_NEXT: PAGE_STORAGE_DIR_NEXT,
  DIR_PREV: PAGE_STORAGE_DIR_PREV
};

const normalizeStorageKey = (key) => typeof key === 'string' ? key : '';

const normalizeItems = (items) => Array.isArray(items)
  ? items.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ ...item }))
  : [];

const normalizePage = (page, fallbackUrl = '') => {
  const url = fallbackUrl;
  const source = page && typeof page === 'object' && !Array.isArray(page) ? page : {};
  return {
    ...source,
    url: typeof source.url === 'string' && source.url ? source.url : url,
    highlights: normalizeItems(source.highlights),
    drawings: normalizeItems(source.drawings),
    lastUpdated: Number.isFinite(source.lastUpdated) ? source.lastUpdated : 0
  };
};

const createAbortError = () => {
  const error = new Error('Operation cancelled');
  error.name = 'AbortError';
  return error;
};

const isCancelled = (token) => !!(token && (token.cancelled || token.aborted));
const assertActive = (token) => {
  if (isCancelled(token)) throw createAbortError();
};

const callProgress = (progress, detail) => {
  if (typeof progress === 'function') progress(detail);
};

const wrapRequest = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const createItemFingerprint = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  if (typeof item.id === 'string' && item.id) return `id:${item.id}`;
  return `json:${JSON.stringify(item)}`;
};

const mergeAnnotationItems = (currentItems, incomingItems) => {
  const merged = currentItems.map((item) => ({ ...item }));
  const indexByFingerprint = new Map();
  merged.forEach((item, index) => {
    const fingerprint = createItemFingerprint(item);
    if (fingerprint) indexByFingerprint.set(fingerprint, index);
  });
  incomingItems.forEach((item) => {
    const fingerprint = createItemFingerprint(item);
    if (fingerprint && indexByFingerprint.has(fingerprint)) {
      merged[indexByFingerprint.get(fingerprint)] = { ...merged[indexByFingerprint.get(fingerprint)], ...item };
      return;
    }
    if (fingerprint) indexByFingerprint.set(fingerprint, merged.length);
    merged.push({ ...item });
  });
  return merged;
};

const mergePages = (currentPage, incomingPage, url, useCurrentTime = false) => {
  const current = normalizePage(currentPage, url);
  const incoming = normalizePage(incomingPage, url);
  const mergedHighlights = mergeAnnotationItems(current.highlights, incoming.highlights);
  const mergedDrawings = mergeAnnotationItems(current.drawings, incoming.drawings);
  if (mergedHighlights.length === 0 && mergedDrawings.length === 0) return null;
  return {
    ...current,
    ...incoming,
    url,
    highlights: mergedHighlights,
    drawings: mergedDrawings,
    lastUpdated: useCurrentTime
      ? Math.max(current.lastUpdated || 0, incoming.lastUpdated || 0, Date.now())
      : Math.max(current.lastUpdated || 0, incoming.lastUpdated || 0)
  };
};

const applyPageUpdate = (page, url, cmd, value) => {
  const nextPage = normalizePage(page, url);
  if (cmd === 'clear_highlights') {
    nextPage.highlights = [];
    nextPage.lastUpdated = Date.now();
    return nextPage.drawings.length === 0 ? null : nextPage;
  }
  if (cmd === 'clear_drawings') {
    nextPage.drawings = [];
    nextPage.lastUpdated = Date.now();
    return nextPage.highlights.length === 0 ? null : nextPage;
  }
  if (cmd === 'replace_drawings') {
    nextPage.drawings = normalizeItems(value);
    nextPage.lastUpdated = Date.now();
    return nextPage.highlights.length === 0 && nextPage.drawings.length === 0 ? null : nextPage;
  }
  if (cmd === 'delete_highlight') {
    const id = value && typeof value.id === 'string' ? value.id : '';
    nextPage.highlights = nextPage.highlights.filter((item) => item.id !== id);
    nextPage.lastUpdated = Date.now();
    return nextPage.highlights.length === 0 && nextPage.drawings.length === 0 ? null : nextPage;
  }
  if (cmd === 'set_highlight_color') {
    const id = value && typeof value.id === 'string' ? value.id : '';
    const color = value && typeof value.color === 'string' ? value.color : '';
    let changed = false;
    nextPage.highlights = nextPage.highlights.map((item) => {
      if (item.id !== id) return item;
      changed = true;
      return { ...item, color };
    });
    if (changed) nextPage.lastUpdated = Date.now();
    return nextPage.highlights.length === 0 && nextPage.drawings.length === 0 ? null : nextPage;
  }
  return normalizePage(value, url);
};

const readStoredPage = async (key) => {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) return undefined;
  const plain = await raw.get(normalizedKey);
  return plain === undefined ? undefined : normalizePage(plain, normalizedKey);
};

const writeStoredPage = async (key, value) => {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) return undefined;
  await raw.set(normalizedKey, normalizePage(value, normalizedKey));
  return undefined;
};

const removeStoredPage = async (key) => {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) return undefined;
  await raw.remove(normalizedKey);
  return undefined;
};

const updateStoredPage = async (key, cmd, value) => {
  const normalizedKey = normalizeStorageKey(key);
  if (!normalizedKey) return undefined;
  return raw.raw(async (store) => {
    const current = await wrapRequest(store.get(normalizedKey));
    const nextPage = applyPageUpdate(current, normalizedKey, cmd, value);
    if (nextPage === null) {
      await wrapRequest(store.delete(normalizedKey));
      return undefined;
    }
    await wrapRequest(store.put(normalizePage(nextPage, normalizedKey), normalizedKey));
    return undefined;
  }, PAGE_STORAGE_MODE_RW);
};

const scanAllEntriesWithCursor = ({
  mode = PAGE_STORAGE_MODE_RO,
  cancelToken = null,
  progress = null
}) => raw.raw((store) => new Promise((resolve, reject) => {
  const request = store.openCursor();
  const entries = [];
  let processed = 0;

  request.onsuccess = () => {
    try {
      assertActive(cancelToken);
      const cursor = request.result;
      if (!cursor) {
        resolve({ entries, processed });
        return;
      }
      if (typeof cursor.key === 'string') {
        entries.push([cursor.key, normalizePage(cursor.value, cursor.key)]);
        processed += 1;
        callProgress(progress, { processed, total: processed });
      }
      cursor.continue();
    } catch (error) {
      reject(error);
    }
  };
  request.onerror = () => reject(request.error);
}), mode);

const listAllEntries = async (options = {}) => {
  try {
    return await scanAllEntriesWithCursor(options);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (typeof core.entries !== 'function') return { entries: [], processed: 0 };
    const entries = (await core.entries()).reduce((items, [key, value]) => {
      if (typeof key !== 'string') return items;
      items.push([key, normalizePage(value, key)]);
      return items;
    }, []);
    assertActive(options.cancelToken || null);
    callProgress(options.progress, { processed: entries.length, total: entries.length });
    return { entries, processed: entries.length };
  }
};

const summarizePage = (url, page) => ({
  url,
  lastUpdated: page.lastUpdated || 0,
  highlightCount: page.highlights.length,
  drawingCount: page.drawings.length,
  previewHighlights: page.highlights.slice(0, 3).map((highlight) => ({ ...highlight })),
  highlights: page.highlights.map((highlight) => ({ ...highlight }))
});

const matchesPageSearch = (url, page, needle) => {
  if (!needle) return true;
  if (url.toLowerCase().includes(needle)) return true;
  if (page.highlights.some((highlight) => (highlight.text || '').toLowerCase().includes(needle))) return true;
  return page.drawings.some((drawing) => (drawing.text || '').toLowerCase().includes(needle));
};

const projectPages = (entries, options = {}) => {
  const offset = Math.max(0, Number(options.offset) || 0);
  const limit = Math.max(1, Number(options.limit) || 25);
  const needle = typeof options.search === 'string' ? options.search.trim().toLowerCase() : '';
  const includeEmpty = options.includeEmpty === true;
  const items = entries.reduce((results, [url, page]) => {
    const hasAnnotations = page.highlights.length > 0 || page.drawings.length > 0;
    if (!includeEmpty && !hasAnnotations) return results;
    if (!matchesPageSearch(url, page, needle)) return results;
    results.push(summarizePage(url, page));
    return results;
  }, []);
  items.sort((a, b) => {
    const byUpdated = (b.lastUpdated || 0) - (a.lastUpdated || 0);
    return byUpdated || a.url.localeCompare(b.url);
  });
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
    processed: entries.length,
    matched: items.length
  };
};

const listPageKeysDirect = async () => (await listAllEntries()).entries.map(([url]) => url);
const listPageValuesDirect = async () => (await listAllEntries()).entries.map(([, page]) => page);
const listPageEntriesDirect = async () => (await listAllEntries()).entries;
const countPagesDirect = async () => raw.count();

const queryPagesDirect = async (options = {}) => {
  const result = await listAllEntries({
    cancelToken: options.cancelToken || null,
    progress: options.progress || null
  });
  return projectPages(result.entries, options);
};

const exportPagesDirect = async (options = {}) => {
  const result = await listAllEntries({
    cancelToken: options.cancelToken || null,
    progress: options.progress || null
  });
  const pages = result.entries.reduce((acc, [url, page]) => {
    if (options.includeEmpty !== true && page.highlights.length === 0 && page.drawings.length === 0) return acc;
    acc[url] = page;
    return acc;
  }, {});
  return { pages, total: Object.keys(pages).length, processed: result.entries.length };
};

const importPagesDirect = async (pages, options = {}) => {
  const entries = Object.entries(pages && typeof pages === 'object' && !Array.isArray(pages) ? pages : {})
    .map(([url, page]) => [normalizeStorageKey(url), page])
    .filter(([url]) => !!url);
  const mode = options.mode || 'replace-all';
  const cancelToken = options.cancelToken || null;
  let processed = 0;

  if (mode === 'replace-all') {
    await directStorage.clearPages({ cancelToken });
  }

  if (mode === 'append') {
    for (const [url, page] of entries) {
      assertActive(cancelToken);
      const merged = mergePages(await directStorage.get(url), page, url, true);
      if (merged) await directStorage.set(url, merged);
      else await directStorage.remove(url);
      processed += 1;
      callProgress(options.progress, { processed, total: entries.length });
    }
    return { processed, total: entries.length };
  }

  for (const [url, page] of entries) {
    assertActive(cancelToken);
    const normalized = normalizePage(page, url);
    if (normalized.highlights.length === 0 && normalized.drawings.length === 0) await directStorage.remove(url);
    else await directStorage.set(url, normalized);
    processed += 1;
    callProgress(options.progress, { processed, total: entries.length });
  }
  return { processed, total: entries.length };
};

const clearPagesDirect = async (options = {}) => {
  assertActive(options.cancelToken || null);
  const count = await countPagesDirect();
  assertActive(options.cancelToken || null);
  await raw.clear();
  callProgress(options.progress, { processed: count, total: count });
  return count;
};

const directStorage = {
  get: async (key) => readStoredPage(key),
  set: async (key, value) => writeStoredPage(key, value),
  remove: async (key) => removeStoredPage(key),
  getBatch: async (keys) => Promise.all((Array.isArray(keys) ? keys : []).map((key) => readStoredPage(key))),
  update: async (key, cmd, value) => updateStoredPage(key, cmd, value),
  keys: listPageKeysDirect,
  values: listPageValuesDirect,
  entries: listPageEntriesDirect,
  clear: () => raw.clear(),
  count: countPagesDirect,
  queryPages: queryPagesDirect,
  exportPages: exportPagesDirect,
  importPages: importPagesDirect,
  clearPages: clearPagesDirect,
  raw
};

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

const StorageProxy = {
  get: (key) => sendStorageMessage({ type: 'DB_GET', key: normalizeStorageKey(key) }),
  set: (key, value) => sendStorageMessage({ type: 'DB_SET', key: normalizeStorageKey(key), value }),
  remove: (key) => sendStorageMessage({ type: 'DB_REMOVE', key: normalizeStorageKey(key) }),
  getBatch: (keys) => sendStorageMessage({ type: 'DB_GET_BATCH', keys: (Array.isArray(keys) ? keys : []).map(normalizeStorageKey) }),
  update: (key, cmd, value) => sendStorageMessage({ type: 'DB_UPDATE', key: normalizeStorageKey(key), cmd, value }),
  keys: () => sendStorageMessage({ type: 'DB_KEYS' }),
  values: async () => {
    const keys = await StorageProxy.keys();
    const values = [];
    for (let index = 0; index < keys.length; index += PAGE_BATCH_SIZE) {
      const batchKeys = keys.slice(index, index + PAGE_BATCH_SIZE);
      const batchValues = await StorageProxy.getBatch(batchKeys);
      values.push(...batchValues);
    }
    return values;
  },
  entries: () => sendStorageMessage({ type: 'DB_ENTRIES' }),
  clear: () => sendStorageMessage({ type: 'DB_CLEAR' }),
  count: () => sendStorageMessage({ type: 'DB_COUNT' }),
  queryPages: (options = {}) => sendStorageMessage({ type: 'DB_QUERY_PAGES', options }),
  exportPages: (options = {}) => sendStorageMessage({ type: 'DB_EXPORT_PAGES', options }),
  importPages: (pages, options = {}) => sendStorageMessage({ type: 'DB_IMPORT_PAGES', pages, options }),
  clearPages: (options = {}) => sendStorageMessage({ type: 'DB_CLEAR_PAGES', options }),
  raw
};

const activeStorage = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id
  ? ((typeof location !== 'undefined' && location.protocol === 'chrome-extension:') ? directStorage : StorageProxy)
  : directStorage;

globalThis.PageStorage = activeStorage;

if (typeof module !== 'undefined') {
  module.exports = { PageStorage: activeStorage};
}
