importScripts('utils/tiny-idb.js', 'utils/page-storage.js', 'utils/consts.js', 'utils/shared.js');

const sendDbResponse = (promise, sendResponse, onSuccess) => {
  promise.then((value) => {
    if (onSuccess) onSuccess(value);
    sendResponse({ ok: true, value });
  }).catch((error) => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'marklet-highlight',
    title: 'Highlight Selection',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'marklet-toggle-whiteboard',
    title: 'Toggle Whiteboard',
    contexts: ['page', 'all']
  });
});

chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  if (m.type === 'DB_GET') {
    sendDbResponse(PageStorage.get(m.key), sendResponse);
    return true;
  }
  if (m.type === 'DB_GET_BATCH') {
    sendDbResponse(PageStorage.getBatch(m.keys), sendResponse);
    return true;
  }
  if (m.type === 'DB_KEYS') {
    sendDbResponse(PageStorage.keys(), sendResponse);
    return true;
  }
  if (m.type === 'DB_COUNT') {
    sendDbResponse(PageStorage.count(), sendResponse);
    return true;
  }
  if (m.type === 'DB_SET') {
    sendDbResponse(PageStorage.set(m.key, m.value), sendResponse, () => {
      notifyPageUpdated(m.key, sender.tab?.id);
    });
    return true;
  }
  if (m.type === 'DB_REMOVE') {
    sendDbResponse(PageStorage.remove(m.key), sendResponse, () => {
      notifyPageUpdated(m.key, sender.tab?.id);
    });
    return true;
  }
  if (m.type === 'DB_UPDATE') {
    sendDbResponse(PageStorage.update(m.key, m.cmd, m.value), sendResponse, () => {
      notifyPageUpdated(m.key, sender.tab?.id);
    });
    return true;
  }
  if (m.type === 'DB_ENTRIES') {
    sendDbResponse(PageStorage.entries(), sendResponse);
    return true;
  }
  if (m.type === 'DB_QUERY_PAGES') {
    sendDbResponse(PageStorage.queryPages(m.options || {}), sendResponse);
    return true;
  }
  if (m.type === 'DB_EXPORT_PAGES') {
    sendDbResponse(PageStorage.exportPages(m.options || {}), sendResponse);
    return true;
  }
  if (m.type === 'DB_IMPORT_PAGES') {
    sendDbResponse(PageStorage.importPages(m.pages, m.options || {}), sendResponse);
    return true;
  }
  if (m.type === 'DB_CLEAR_PAGES') {
    sendDbResponse(PageStorage.clearPages(m.options || {}), sendResponse);
    return true;
  }
  if (m.type === 'DB_CLEAR') {
    sendDbResponse(PageStorage.clear(), sendResponse);
    return true;
  }
  if (m.type === 'INJECT_GLOBAL_STYLES' && sender.tab) {
    chrome.scripting.insertCSS({
      target: { tabId: sender.tab.id },
      css: `.marklet-highlight { background-color: var(--marklet-highlight-color) !important; color: var(--marklet-text-color) !important; padding: 1px 0 !important; cursor: pointer !important; display: inline !important; border: none !important; transition: transform 0.2s, background-color 0.1s !important; } .marklet-rounded .marklet-highlight { border-radius: 3px; } .marklet-shadows .marklet-highlight { box-shadow: 0 1px 2px rgba(0,0,0,0.2); } .marklet-hidden-h .marklet-highlight { background-color: transparent !important; box-shadow: none !important; color: inherit !important; pointer-events: none; } .marklet-hidden-d #marklet-canvas-main { display: none !important; } .marklet-flash { transform: scale(1.05); box-shadow: 0 0 8px 2px #007bff !important; z-index: 10000 !important; position: relative; outline: 2px solid #007bff; } .marklet-spotlight { position: relative; z-index: ${CONSTANTS.Z_INDEX_TOOLTIP} !important; animation: marklet-spotlight-effect 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; } @keyframes marklet-spotlight-effect { 0% { box-shadow: 0 0 0 0 rgba(0,0,0,0); transform: scale(1); } 15% { box-shadow: 0 0 0 4px rgba(255,255,255,0.9), 0 0 0 100vmax rgba(0,0,0,0.6); transform: scale(1.1); } 30% { transform: scale(1.05); } 80% { box-shadow: 0 0 0 4px rgba(255,255,255,0), 0 0 0 100vmax rgba(0,0,0,0.6); transform: scale(1.05); } 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0), 0 0 0 0 rgba(0,0,0,0); transform: scale(1); } }`
    }).catch(() => {});
  }
});

function notifyPageUpdated(key, excludeTabId) {
    const url = key;
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id === excludeTabId) return;
            if (typeof tab.url !== 'string') return;
            if (SharedUtils.normalizeUrl(tab.url) !== url) return;
            chrome.tabs.sendMessage(tab.id, { type: 'PAGE_UPDATED_SYNC', url }).catch(() => {});
        });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'marklet-highlight') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'APPLY_HIGHLIGHT_CONTEXT',
      color: SharedUtils.getDefaultHighlightColor()
    }).catch(() => {});
  } else if (info.menuItemId === 'marklet-toggle-whiteboard') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_WHITEBOARD_CONTEXT'
    }).catch(() => {});
  }
});

const safeSendMessage = (tabId, message) => {
    chrome.tabs.sendMessage(tabId, message).catch(() => {});
};

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId === 0 && details.url && details.url.startsWith('http')) {
        safeSendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
    }
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
    if (details.frameId === 0 && details.url && details.url.startsWith('http')) {
        safeSendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
    }
});
