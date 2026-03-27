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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'marklet-highlight') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'APPLY_HIGHLIGHT_CONTEXT',
      color: 'rgba(255, 255, 0, 0.4)'
    }).catch(() => {

    });
  } else if (info.menuItemId === 'marklet-toggle-whiteboard') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_WHITEBOARD_CONTEXT'
    }).catch(() => {

    });
  }
});

const safeSendMessage = (tabId, message) => {
    chrome.tabs.sendMessage(tabId, message).catch(() => {

    });
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
