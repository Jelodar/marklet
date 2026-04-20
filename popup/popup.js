document.addEventListener('DOMContentLoaded', async () => {
  const extensionEnableToggle = document.getElementById('extension-enable-toggle');
  const appTitleLabel = document.getElementById('app-title-label');
  const siteEnableToggle = document.getElementById('site-enable-toggle');
  const siteEnableLabel = document.getElementById('site-enable-label');
  const whiteboardToggle = document.getElementById('whiteboard-toggle');
  const highlightsToggle = document.getElementById('highlights-visibility');
  const drawingsToggle = document.getElementById('drawings-visibility');
  const highlightsList = document.getElementById('highlights-list');
  const highlightColorPicker = document.getElementById('default-highlight-color');
  const drawColorPicker = document.getElementById('default-draw-color');
  const clearAllHighlightsBtn = document.getElementById('clear-all-highlights');
  const clearAllDrawingsBtn = document.getElementById('clear-all-drawings');
  const selectionToolbarToggle = document.getElementById('selection-toolbar-toggle');
  const openSettingsBtn = document.getElementById('open-settings');
  const overrideSelectBtn = document.getElementById('override-select-btn');
  const siteEnableContainer = document.getElementById('site-enable-container');
  const whiteboardContainer = document.getElementById('whiteboard-container');
  const selectionToolbarContainer = document.getElementById('selection-toolbar-container');
  const defaultSettingsContainer = document.getElementById('default-settings-container');
  const highlightsVisibilityContainer = document.getElementById('highlights-visibility-container');
  const drawingsVisibilityContainer = document.getElementById('drawings-visibility-container');
  const selectionOverrideContainer = document.getElementById('selection-override-container');
  const highlightsCountBadge = document.getElementById('highlights-count');
  const drawingsCountBadge = document.getElementById('drawings-count');
  let selectionOverrideActive = false;

  const applyTheme = (theme) => {
    SharedUtils.applyTheme(theme);
  };

  const renderEmptyState = (container, text) => {
    container.replaceChildren(SharedUI.empty(text));
  };

  openSettingsBtn.onclick = () => chrome.runtime.openOptionsPage();
  appTitleLabel.onclick = () => {
    extensionEnableToggle.checked = !extensionEnableToggle.checked;
    extensionEnableToggle.dispatchEvent(new Event('change'));
  };

  const safeSendMessage = (tabId, message, callback) => {
    if (!tabId) {
      if (callback) callback(undefined, true);
      return;
    }
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        void chrome.runtime.lastError.message;
        if (callback) callback(undefined, true);
      } else if (callback) {
        callback(response, false);
      }
    });
  };

  const data = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get([
    'extensionEnabled',
    'enableByDefault',
    'urlHashMode',
    'urlHashSiteModes',
    'disabledSites',
    'enabledSites',
    'highlightsVisible',
    'drawingsVisible',
    'selectionToolbarEnabled',
    'defaultHighlightColor',
    'defaultDrawColor',
    'theme'
  ]));

  SharedUtils.setUrlNormalizationSettings(data);
  applyTheme(data.theme || 'system');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab ? SharedUtils.normalizeUrl(tab.url) : null;
  const currentHostname = tab ? SharedUtils.getHostname(tab.url) : null;

  if (tab) {
    const isRestricted = SharedUtils.isRestricted(tab.url);
    const isSavable = SharedUtils.isSavable(tab.url);

    if (isRestricted) {
      const hint = SharedUI.div('hint-banner', {
        text: "This page is restricted by the browser. Annotations are not possible here."
      });
      document.body.insertBefore(hint, document.querySelector('.header').nextSibling);
    } else if (!isSavable) {
      const hint = SharedUI.div('hint-banner', {
        text: "This page type does not support saving. Annotations will be lost on reload."
      });
      document.body.insertBefore(hint, document.querySelector('.header').nextSibling);
    }
  }


  const isGlobalEnabled = data.extensionEnabled !== false;
  extensionEnableToggle.checked = isGlobalEnabled;

  const enableByDefault = data.enableByDefault !== false;
  let isSiteEnabled = false;

  if (currentHostname && !SharedUtils.isRestricted(tab.url)) {
    if (enableByDefault) {
      isSiteEnabled = !(data.disabledSites || []).includes(currentHostname);
    } else {
      isSiteEnabled = (data.enabledSites || []).includes(currentHostname);
    }
    siteEnableLabel.textContent = `Enable on ${currentHostname}`;
    siteEnableToggle.disabled = false;
  } else if (tab && !SharedUtils.isSavable(tab.url) && !SharedUtils.isRestricted(tab.url)) {
    isSiteEnabled = isGlobalEnabled;
    siteEnableLabel.textContent = "Enable on this Page";
    siteEnableToggle.disabled = false;
  } else {
    siteEnableLabel.textContent = "Extension cannot run on this page";
    siteEnableToggle.disabled = true;
    siteEnableContainer.classList.add('disabled');
  }
  siteEnableToggle.checked = isSiteEnabled;

  const flashElement = (element) => {
    const parent = element.closest('.switch') || element;
    parent.classList.remove('flash-highlight');
    void parent.offsetWidth;
    parent.classList.add('flash-highlight');
    setTimeout(() => parent.classList.remove('flash-highlight'), 1000);
  };

  const setupDisabledClick = (container) => {
    container.addEventListener('click', (e) => {
      if (container.classList.contains('disabled') || container.querySelector('input:disabled') || container.querySelector('button:disabled')) {
        if (!extensionEnableToggle.checked) {
          flashElement(extensionEnableToggle);
        } else if (!siteEnableToggle.checked && container !== siteEnableContainer) {
          flashElement(siteEnableToggle);
        }
      }
    });
    const inputs = container.querySelectorAll('input, button');
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        const wrapper = document.createElement('div');
        wrapper.className = 'disabled-overlay';
        container.style.position = 'relative';
        container.appendChild(wrapper);
        container._disabledWrapper = wrapper;
      } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'disabled-overlay';
        const parent = input.parentElement;
        if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
        parent.appendChild(wrapper);
        input._disabledWrapper = wrapper;
        wrapper.onclick = (e) => {
          e.stopPropagation();
          if (!extensionEnableToggle.checked) flashElement(extensionEnableToggle);
          else if (!siteEnableToggle.checked) flashElement(siteEnableToggle);
        };
      }
    });
  };

  [siteEnableContainer, whiteboardContainer, selectionToolbarContainer, defaultSettingsContainer, highlightsVisibilityContainer, drawingsVisibilityContainer, selectionOverrideContainer].forEach(setupDisabledClick);

  const updateControlsState = (globalEnabled, siteEnabled) => {
    const isRestricted = tab && SharedUtils.isRestricted(tab.url);
    const isPageUsable = globalEnabled && !isRestricted && (currentHostname || (tab && !SharedUtils.isSavable(tab.url)));
    const fullyEnabled = globalEnabled && siteEnabled && !isRestricted;
    
    const setDisabled = (container, isDisabled) => {
      if (!container) return;
      const inputs = container.querySelectorAll('input, button');
      if (isDisabled) {
        container.classList.add('disabled');
        inputs.forEach(input => {
          input.disabled = true;
          if (input._disabledWrapper) input._disabledWrapper.style.display = 'block';
        });
        if (container._disabledWrapper) container._disabledWrapper.style.display = 'block';
      } else {
        container.classList.remove('disabled');
        inputs.forEach(input => {
          input.disabled = false;
          if (input._disabledWrapper) input._disabledWrapper.style.display = 'none';
        });
        if (container._disabledWrapper) container._disabledWrapper.style.display = 'none';
      }
    };

    setDisabled(siteEnableContainer, !isPageUsable);
    const subControlsDisabled = !fullyEnabled;
    [whiteboardContainer, selectionToolbarContainer, highlightsVisibilityContainer, drawingsVisibilityContainer, selectionOverrideContainer].forEach(c => setDisabled(c, subControlsDisabled));
    const settingsControls = defaultSettingsContainer.querySelectorAll('input, button');
    settingsControls.forEach(control => {
      control.disabled = subControlsDisabled;
      if (control._disabledWrapper) control._disabledWrapper.style.display = subControlsDisabled ? 'block' : 'none';
    });
    defaultSettingsContainer.style.opacity = subControlsDisabled ? '0.5' : '1';
    highlightsList.style.opacity = fullyEnabled ? '1' : '0.5';
    highlightsList.style.pointerEvents = fullyEnabled ? 'auto' : 'none';
    clearAllHighlightsBtn.disabled = !fullyEnabled;
    clearAllDrawingsBtn.disabled = !fullyEnabled;
  };

  updateControlsState(isGlobalEnabled, isSiteEnabled);
  highlightsToggle.checked = data.highlightsVisible !== false;
  drawingsToggle.checked = data.drawingsVisible !== false;
  selectionToolbarToggle.checked = data.selectionToolbarEnabled !== false;
  if (data.defaultHighlightColor) highlightColorPicker.value = data.defaultHighlightColor;
  if (data.defaultDrawColor) drawColorPicker.value = data.defaultDrawColor;

  if (tab && isGlobalEnabled && isSiteEnabled) {
    await syncTabData(tab);
  }

  const renderHighlights = async () => {
    if (!tab || !currentUrl) return;
    const pageData = SharedUtils.normalizePageData(await PageStorage.get(currentUrl), currentUrl);
    const pageHighlights = pageData.highlights;
    const pageDrawings = pageData.drawings;
    
    highlightsCountBadge.textContent = pageHighlights.length;
    drawingsCountBadge.textContent = pageDrawings.length;

    if (pageHighlights.length > 0) {
      const fragment = document.createDocumentFragment();
      pageHighlights.forEach((highlight) => {
        SharedUI.div('highlight-item', {
          parent: fragment,
          style: { '--highlight-color': highlight.color || 'transparent' }
        }, [

          SharedUI.div('highlight-text', {
            title: highlight.text || 'No text content',
            text: highlight.text || 'No text content'
          }),
          SharedUI.div('highlight-actions', [
            SharedUI.button('action-btn btn-goto', {
              text: 'Go To',
              on: { click: () => safeSendMessage(tab.id, { type: 'GOTO_HIGHLIGHT', id: highlight.id }) }
            }),
            SharedUI.button('action-btn btn-copy', {
              text: 'Copy',
              on: { click: async (e) => {
                const btn = e.target;
                const originalText = btn.innerText;
                try {
                  await navigator.clipboard.writeText(highlight.text || '');
                  btn.innerText = 'Copied';
                  setTimeout(() => btn.innerText = originalText, 1500);
                } catch (error) {
                  btn.innerText = originalText;
                  SharedUI.toast('Could not copy highlight text.');
                }
              }}
            }),
            SharedUI.button('action-btn btn-delete', {
              text: 'Delete',
              on: { click: async () => {
                if (await SharedUI.confirm('Delete Highlight', 'Delete this highlight?', { isDanger: true })) {
                  await PageStorage.update(currentUrl, 'delete_highlight', { id: highlight.id });
                  renderHighlights();
                  safeSendMessage(tab.id, { type: 'LOAD_HIGHLIGHTS' });
                }
              }}
            })
          ])
        ]);
      });
      highlightsList.replaceChildren(fragment);
    } else {
      renderEmptyState(highlightsList, 'No highlights yet');
    }
  };

  async function syncTabData(tab) {
    return new Promise((fullfull) => {
      safeSendMessage(tab.id, { type: 'GET_STATE' }, (response, failed) => {
        if (failed || !response) {
          updateAllowSelectionLabel(false);
          return fullfull(false);
        }
        whiteboardToggle.checked = !!(response.whiteboardActive);
        updateAllowSelectionLabel(!!(response.selectionOverrideActive));
        fullfull(true);
      });
    });
  }

  function updateAllowSelectionLabel(isEnabled) {
    selectionOverrideActive = !!isEnabled;
    overrideSelectBtn.dataset.active = selectionOverrideActive ? 'true' : 'false';
    overrideSelectBtn.textContent = (isEnabled ? 'Revert Text Selection Settings' : 'Make All Text Selectable');
  }

  if (!tab || !isGlobalEnabled || !isSiteEnabled) updateAllowSelectionLabel(false);
  renderHighlights();

  extensionEnableToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ extensionEnabled: enabled });
    updateControlsState(enabled, siteEnableToggle.checked);
    safeSendMessage(tab.id, { type: 'TOGGLE_EXTENSION', active: enabled });
  });

  siteEnableToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    if (!currentHostname) {
      if (tab && !SharedUtils.isSavable(tab.url) && !SharedUtils.isRestricted(tab.url)) {
        extensionEnableToggle.checked = enabled;
        extensionEnableToggle.dispatchEvent(new Event('change'));
      }
      return;
    }
    const d = await chrome.storage.local.get(['disabledSites', 'enabledSites', 'enableByDefault']);
    const isDefaultOn = d.enableByDefault !== false;
    if (isDefaultOn) {
      let sites = d.disabledSites || [];
      if (enabled) {
        sites = sites.filter(s => s !== currentHostname);
      } else {
        if (!sites.includes(currentHostname)) sites.push(currentHostname);
      }
      await chrome.storage.local.set({ disabledSites: sites });
    } else {
      let sites = d.enabledSites || [];
      if (enabled) {
        if (!sites.includes(currentHostname)) sites.push(currentHostname);
      } else {
        sites = sites.filter(s => s !== currentHostname);
      }
      await chrome.storage.local.set({ enabledSites: sites });
    }
    const globalEnabled = extensionEnableToggle.checked;
    updateControlsState(globalEnabled, enabled);
    safeSendMessage(tab.id, { type: 'TOGGLE_SITE_ENABLED', active: enabled });
  });

  whiteboardToggle.addEventListener('change', async (e) => {
    const active = e.target.checked;
    safeSendMessage(tab.id, { type: 'TOGGLE_WHITEBOARD', active });
  });

  selectionToolbarToggle.addEventListener('change', async (e) => {
    const active = e.target.checked;
    await chrome.storage.local.set({ selectionToolbarEnabled: active });
    safeSendMessage(tab.id, { type: 'TOGGLE_SELECTION_TOOLBAR', active });
  });

  highlightsToggle.addEventListener('change', async (e) => {
    const active = e.target.checked;
    await chrome.storage.local.set({ highlightsVisible: active });
    safeSendMessage(tab.id, { type: 'TOGGLE_HIGHLIGHTS_VISIBILITY', active });
  });

  drawingsToggle.addEventListener('change', async (e) => {
    const active = e.target.checked;
    await chrome.storage.local.set({ drawingsVisible: active });
    safeSendMessage(tab.id, { type: 'TOGGLE_DRAWINGS_VISIBILITY', active });
  });

  highlightColorPicker.addEventListener('input', async (e) => {
    await chrome.storage.local.set({ defaultHighlightColor: e.target.value });
    safeSendMessage(tab.id, { type: 'LOAD_DEFAULT_COLORS' });
  });

  drawColorPicker.addEventListener('input', async (e) => {
    await chrome.storage.local.set({ defaultDrawColor: e.target.value });
    safeSendMessage(tab.id, { type: 'LOAD_DEFAULT_COLORS' });
  });

  clearAllHighlightsBtn.addEventListener('click', async () => {
    if (await SharedUI.confirm('Clear Highlights', 'Clear all highlights on this page?', { isDanger: true })) {
      await PageStorage.update(currentUrl, 'clear_highlights');
      renderHighlights();
      safeSendMessage(tab.id, { type: 'LOAD_HIGHLIGHTS' });
    }
  });

  clearAllDrawingsBtn.addEventListener('click', async () => {
    if (await SharedUI.confirm('Clear Drawings', 'Clear all drawings on this page?', { isDanger: true })) {
      await PageStorage.update(currentUrl, 'clear_drawings');
      renderHighlights();
      safeSendMessage(tab.id, { type: 'CLEAR_DRAWINGS' });
    }
  });

  overrideSelectBtn.addEventListener('click', () => {
    const nextActive = !selectionOverrideActive;
    safeSendMessage(tab.id, { type: 'TOGGLE_USER_SELECT', active: nextActive }, (response, failed) => {
      if (failed) return;
      updateAllowSelectionLabel(response?.selectionOverrideActive ?? nextActive);
    });
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme) applyTheme(changes.theme.newValue);
  });
});
