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

  const applyTheme = (theme) => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme || 'light');
    }
  };

  openSettingsBtn.onclick = () => chrome.runtime.openOptionsPage();
  appTitleLabel.onclick = () => {
    extensionEnableToggle.checked = !extensionEnableToggle.checked;
    extensionEnableToggle.dispatchEvent(new Event('change'));
  };

  const safeSendMessage = (tabId, message, callback) => {
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        void chrome.runtime.lastError.message;
      } else if (callback) {
        callback(response);
      }
    });
  };

  const data = await chrome.storage.local.get([
    'extensionEnabled',
    'enableByDefault',
    'disabledSites',
    'enabledSites',
    'highlightsVisible',
    'drawingsVisible',
    'selectionToolbarEnabled',
    'defaultHighlightColor',
    'defaultDrawColor',
    'theme'
  ]);

  applyTheme(data.theme || 'system');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab ? SharedUtils.normalizeUrl(tab.url) : null;
  const currentHostname = tab ? SharedUtils.getHostname(tab.url) : null;

  if (tab) {
    const isRestricted = SharedUtils.isRestricted(tab.url);
    const isSavable = SharedUtils.isSavable(tab.url);

    if (isRestricted) {
      const hint = document.createElement('div');
      hint.style.cssText = "background: var(--secondary-bg); color: var(--text-color); padding: 8px; border-radius: 4px; font-size: 11px; margin-bottom: 12px; border: 1px solid var(--border-color); opacity: 0.8;";
      hint.innerHTML = "This page is restricted by the browser. Annotations are not possible here.";
      document.body.insertBefore(hint, document.querySelector('.header').nextSibling);
    } else if (!isSavable) {
      const hint = document.createElement('div');
      hint.style.cssText = "background: var(--secondary-bg); color: var(--text-color); padding: 8px; border-radius: 4px; font-size: 11px; margin-bottom: 12px; border: 1px solid var(--border-color); opacity: 0.8;";
      hint.innerHTML = "This page type doesn't support saving. Your annotations will be lost on reload.";
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
        wrapper.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;display:none;";
        container.style.position = 'relative';
        container.appendChild(wrapper);
        container._disabledWrapper = wrapper;
      } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'disabled-overlay';
        wrapper.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;display:none;cursor:not-allowed;";
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
    const pageData = await tinyIDB.get(currentUrl);
    const pageHighlights = pageData?.highlights || [];
    const pageDrawings = pageData?.drawings || [];
    
    highlightsCountBadge.textContent = pageHighlights.length;
    drawingsCountBadge.textContent = pageDrawings.length;

    if (pageHighlights.length > 0) {
      highlightsList.innerHTML = pageHighlights.map(h => `
        <div class="highlight-item" style="border-left: 4px solid ${h.color};">
          <div class="highlight-text" title="${(h.text || '').replace(/"/g, '&quot;')}">${h.text || "No text content"}</div>
          <div class="highlight-actions">
            <button class="action-btn btn-goto" data-id="${h.id}">Go To</button>
            <button class="action-btn btn-copy" data-text="${(h.text || '').replace(/"/g, '&quot;')}">Copy</button>
            <button class="action-btn btn-delete" data-id="${h.id}">Delete</button>
          </div>
        </div>
      `).join('');
      highlightsList.querySelectorAll('.btn-goto').forEach(btn => {
        btn.onclick = () => safeSendMessage(tab.id, { type: 'GOTO_HIGHLIGHT', id: btn.dataset.id });
      });
      highlightsList.querySelectorAll('.btn-copy').forEach(btn => {
        btn.onclick = () => {
          navigator.clipboard.writeText(btn.dataset.text);
          const originalText = btn.innerText;
          btn.innerText = 'Copied!';
          setTimeout(() => btn.innerText = originalText, 1500);
        };
      });
      highlightsList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async () => {
          const pData = await tinyIDB.get(currentUrl);
          if (pData) {
            pData.highlights = pData.highlights.filter(item => item.id !== btn.dataset.id);
            if (pData.highlights.length === 0 && (!pData.drawings || pData.drawings.length === 0)) await tinyIDB.remove(currentUrl);
            else await tinyIDB.set(currentUrl, pData);
            renderHighlights();
            safeSendMessage(tab.id, { type: 'LOAD_HIGHLIGHTS' });
          }
        };
      });
    } else {
      highlightsList.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 10px;">No highlights yet</div>`;
    }
  };

  async function syncTabData(tab) {
    return new Promise((fullfull) => {
      safeSendMessage(tab.id, { type: 'GET_STATE' }, (response) => {
        if (!response) return fullfull(false);
        whiteboardToggle.checked = !!(response.whiteboardActive);
        updateAllowSelectionLabel(!!(response.selectionOverrideActive));
        fullfull(true);
      });
    });
  }

  function updateAllowSelectionLabel(isEnabled) {
    overrideSelectBtn.textContent = (isEnabled ? 'Revert Text Selection Settings' : 'Make All Text Selectable');
  }

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
    if (confirm('Clear all highlights on this page?')) {
      const pData = await tinyIDB.get(currentUrl);
      if (pData) {
        pData.highlights = [];
        if (pData.drawings.length === 0) await tinyIDB.remove(currentUrl);
        else await tinyIDB.set(currentUrl, pData);
        renderHighlights();
        safeSendMessage(tab.id, { type: 'LOAD_HIGHLIGHTS' });
      }
    }
  });

  clearAllDrawingsBtn.addEventListener('click', async () => {
    if (confirm('Clear all drawings on this page?')) {
      const pData = await tinyIDB.get(currentUrl);
      if (pData) {
        pData.drawings = [];
        if (pData.highlights.length === 0) await tinyIDB.remove(currentUrl);
        else await tinyIDB.set(currentUrl, pData);
        renderHighlights();
        safeSendMessage(tab.id, { type: 'CLEAR_DRAWINGS' });
      }
    }
  });

  overrideSelectBtn.addEventListener('click', () => {
    safeSendMessage(tab.id, { type: 'TOGGLE_USER_SELECT' });
    syncTabData(tab)
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.theme) applyTheme(changes.theme.newValue);
  });
});
