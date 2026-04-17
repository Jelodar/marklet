class Scheduler {
  constructor(callback, wait = CONSTANTS.SCHEDULER_WAIT, maxWait = CONSTANTS.SCHEDULER_MAX_WAIT) {
    this.callback = callback;
    this.wait = wait;
    this.maxWait = maxWait;
    this.timer = null;
    this.maxTimer = null;
  }
  schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.maxTimer) {
      this.maxTimer = setTimeout(() => this.invoke(), this.maxWait);
    }
    this.timer = setTimeout(() => this.invoke(), this.wait);
  }
  invoke() {
    this.cancel();
    requestAnimationFrame(() => this.callback());
  }
  cancel() {
    if (this.timer) clearTimeout(this.timer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.timer = null;
    this.maxTimer = null;
  }
}
class Marklet {
  constructor() {
    this.injectGlobalStyles();
    this.shadowHost = Object.assign(document.createElement("div"), { id: "marklet-root" });
    Object.assign(this.shadowHost.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      margin: "0",
      padding: "0",
      border: "none",
      overflow: "visible",
      pointerEvents: "none",
      zIndex: CONSTANTS.Z_INDEX_TOOLTIP,
      all: "initial"
    });
    (document.documentElement || document.body).appendChild(this.shadowHost);
    this.shadow = this.shadowHost.attachShadow({ mode: "open" });
    this.initStyles();
    this.whiteboardActive = false;
    this.selectionOverrideActive = false;
    this.hasHighlights = false;
    this.lastUrl = SharedUtils.normalizeUrl(window.location.href);
    this.observerPaused = true;
    this.hotkeys = SharedUtils.getDefaultHotkeys();
    this.bindMessageListener();
    this.bindStorageListener();
    this.loadHotkeys();
    this.destroyed = false;
    this.isSavable = SharedUtils.isSavable(window.location.href);
    chrome.storage.local.get(["extensionEnabled", "enableByDefault", "disabledSites", "enabledSites", "urlHashMode", "urlHashSiteModes"], (res) => {
      if (this.destroyed) return;
      if (!SharedUtils.isValidExtension()) return;
      SharedUtils.setUrlNormalizationSettings(res);
      this.lastUrl = SharedUtils.normalizeUrl(window.location.href);
      const isGloballyEnabled = res.extensionEnabled !== false;
      if (!isGloballyEnabled) return;
      const hostname = window.location.hostname;
      const enableByDefault = res.enableByDefault !== false;
      let shouldInit = false;
      if (!this.isSavable) {
        shouldInit = true;
      } else if (enableByDefault) {
        shouldInit = !res.disabledSites?.includes(hostname);
      } else {
        shouldInit = res.enabledSites?.includes(hostname);
      }
      if (shouldInit) this.initAll();
    });
  }
  bindStorageListener() {
    this.storageChangeListener = (changes) => {
      if (changes.hotkeys) {
        this.hotkeys = { ...SharedUtils.getDefaultHotkeys(), ...(changes.hotkeys.newValue || {}) };
      }
      if (changes.urlHashMode || changes.urlHashSiteModes) {
        SharedUtils.setUrlNormalizationSettings({
          urlHashMode: changes.urlHashMode ? changes.urlHashMode.newValue : SharedUtils.getUrlNormalizationSettings().defaultHashMode,
          urlHashSiteModes: changes.urlHashSiteModes ? changes.urlHashSiteModes.newValue : SharedUtils.getUrlNormalizationSettings().siteHashModes
        });
        this.lastUrl = SharedUtils.normalizeUrl(window.location.href);
      }
    };
    chrome.storage.onChanged.addListener(this.storageChangeListener);
  }
  async loadHotkeys() {
    if (!SharedUtils.isValidExtension()) return;
    const data = await chrome.storage.local.get(["hotkeys"]);
    this.hotkeys = { ...SharedUtils.getDefaultHotkeys(), ...(data.hotkeys || {}) };
  }
  bindDocumentMouseDown() {
    if (this.documentMouseDownListener) return;
    this.documentMouseDownListener = (e) => {
      if (this.ui && (e.composedPath().includes(this.shadowHost) || this.ui.isPickingCustomColor)) return;
      if (e.detail > 1) return;
      if (this.ui && (this.ui.palette.classList.contains("visible") || this.ui.selToolbar || this.ui.editToolbar)) {
        this.ui.togglePalette(false); this.ui.hideSelectionToolbar(); this.ui.hideEditToolbar();
      }
    };
    document.addEventListener("mousedown", this.documentMouseDownListener);
  }
  unbindDocumentMouseDown() {
    if (!this.documentMouseDownListener) return;
    document.removeEventListener("mousedown", this.documentMouseDownListener);
    this.documentMouseDownListener = null;
  }
  initAll() {
    this.destroyed = false;
    if (!this.storageChangeListener) this.bindStorageListener();
    this.migrateData().then(() => {
      if (this.destroyed) return;
      if (this.highlighter) return;
      this.whiteboard = new Whiteboard(this);
      this.highlighter = new Highlighter(this);
      this.ui = new UI(this.shadow, this);
      this.bindDocumentMouseDown();
      this.bindKeyboardEvents();
      this.restoreState();
      this.initObserver();
      this.lastUrl = SharedUtils.normalizeUrl(window.location.href);
      const load = () => {
        this.highlighter.loadHighlights(true).then(() => {
          this.updateObserverState();
        });
      };
      if (document.readyState === "complete") {
        load();
      } else {
        this.pendingLoadListener = () => {
          window.removeEventListener("load", this.pendingLoadListener);
          this.pendingLoadListener = null;
          load();
        };
        window.addEventListener("load", this.pendingLoadListener);
      }
    });
  }
  destroyAll() {
    this.destroyed = true;
    if (this.pendingLoadListener) {
      window.removeEventListener("load", this.pendingLoadListener);
      this.pendingLoadListener = null;
    }
    this.unbindDocumentMouseDown();
    this.pauseObserver();
    if (this.ui) { this.ui.destroy(); this.ui.container.remove(); this.ui.absoluteContainer.remove(); this.ui = null; }
    if (this.whiteboard) { this.whiteboard.destroy(); this.whiteboard.canvas?.remove(); this.whiteboard = null; }
    if (this.highlighter) { this.highlighter.destroy(); this.highlighter = null; }
    DOMUtils.stripHighlights();
    this.shadowHost.remove();
    this.shadowHost = Object.assign(document.createElement("div"), { id: "marklet-root" });
    Object.assign(this.shadowHost.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      margin: "0",
      padding: "0",
      border: "none",
      overflow: "visible",
      pointerEvents: "none",
      zIndex: CONSTANTS.Z_INDEX_TOOLTIP,
      all: "initial"
    });
    (document.documentElement || document.body).appendChild(this.shadowHost);
    this.shadow = this.shadowHost.attachShadow({ mode: "open" });
    this.initStyles();
    if (this.keyListener) {
      window.removeEventListener("keydown", this.keyListener, true);
      window.removeEventListener("keyup", this.keyListener, true);
      window.removeEventListener("keypress", this.keyListener, true);
      this.keyListener = null;
    }
    if (this.storageChangeListener && chrome.storage.onChanged.removeListener) {
      chrome.storage.onChanged.removeListener(this.storageChangeListener);
      this.storageChangeListener = null;
    }
  }
  handleObservedUrlChange(nextUrl = window.location.href) {
    const currentNormalized = SharedUtils.normalizeUrl(nextUrl);
    if (currentNormalized === this.lastUrl) return false;
    this.lastUrl = currentNormalized;
    this.handleUrlChange();
    return true;
  }
  handleUrlChange() {
    if (this.highlighter) this.highlighter.loadHighlights(true).then(() => this.updateObserverState());
    if (this.whiteboard) { this.whiteboard.loadStrokes(); this.whiteboard.handleResize(); }
  }
  async migrateData() {
    if (!SharedUtils.isValidExtension()) return;
    const d = await chrome.storage.local.get(["highlights", "drawings", "pages"]);
    if (!d.pages && !d.highlights && !d.drawings) return;

    const pages = d.pages || {};
    if (d.highlights || d.drawings) {
      [...(d.highlights || []), ...(d.drawings || [])].forEach((item) => {
        const url = SharedUtils.normalizeUrl(item.url);
        if (!pages[url]) pages[url] = { url, highlights: [], drawings: [] };
        (item.points) ? pages[url].drawings.push(item) : pages[url].highlights.push(item);
      });
      await chrome.storage.local.remove(["highlights", "drawings"]);
    }

    for (const [url, data] of Object.entries(pages)) {
      await tinyIDB.set(url, SharedUtils.normalizePageData(data, url));
    }
    await chrome.storage.local.remove("pages");
  }
  initObserver() {
    this.scheduler = new Scheduler(() => this.highlighter.loadHighlights(true));
    this.observerCallback = (m) => {
      if (this.ui && this.ui.selectionTarget) {
        const isRemoved = !document.contains(this.ui.selectionTarget);
        const isMutated = m.some(mut => mut.target === this.ui.selectionTarget || (this.ui.selectionTarget.nodeType === Node.ELEMENT_NODE && this.ui.selectionTarget.contains(mut.target)));
        if (isRemoved || isMutated) {
          this.ui.hideSelectionToolbar();
          this.ui.hideEditToolbar();
          this.ui.togglePalette(false);
        }
      }
      if (!this.hasHighlights && !this.whiteboardActive) return;
      const isInternal = m.every((rec) => [...rec.addedNodes, ...rec.removedNodes].every(n =>
        (n.classList && (n.classList.contains("marklet-highlight") || n.classList.contains("marklet-flex-wrapper"))) ||
        (n.nodeType === Node.TEXT_NODE && n.parentElement?.classList.contains("marklet-highlight"))
      ));
      if (isInternal) return;
      if (this.whiteboard && (this.whiteboardActive || this.whiteboard.strokes.length > 0)) {
        requestAnimationFrame(() => this.whiteboard.handleResize());
      }
      if (!this.hasHighlights) return;
      if (m.some(x => x.addedNodes.length > 0 || x.removedNodes.length > 0)) {
        this.scheduler.schedule();
      }
    };
    this.observer = new MutationObserver(this.observerCallback);
    this.updateObserverState();
  }
  updateObserverState() {
    const shouldObserve = this.hasHighlights || this.whiteboardActive;
    if (shouldObserve) this.resumeObserver();
    else this.pauseObserver();
  }
  pauseObserver() {
    if (this.observer && !this.observerPaused) {
      this.observer.disconnect();
      this.observerPaused = true;
      if (this.scheduler) this.scheduler.cancel();
    }
  }
  resumeObserver() {
    if (this.observer && this.observerPaused) {
      this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      this.observerPaused = false;
    }
  }
  initStyles() { this.shadow.appendChild(Object.assign(document.createElement("style"), { textContent: SHADOW_STYLES })); }
  injectGlobalStyles() {
    chrome.runtime.sendMessage({ type: "INJECT_GLOBAL_STYLES" });
  }
  bindMessageListener() {
    chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
      if (!SharedUtils.isValidExtension()) return;
      if (m.type === "GET_HIGHLIGHTS") {
        const url = SharedUtils.normalizeUrl(window.location.href);
        tinyIDB.get(url).then(page => {
          sendResponse({ highlights: SharedUtils.normalizePageData(page, url).highlights });
        });
        return true;
      }
      if (m.type === "CLEAR_HIGHLIGHTS") {
        const url = SharedUtils.normalizeUrl(window.location.href);
        tinyIDB.update(url, 'clear_highlights').then(() => {
          this.highlighter.loadHighlights();
          sendResponse({ success: true });
        });
        return true;
      }
      if (m.type === "PAGE_UPDATED_SYNC") {
        if (SharedUtils.normalizeUrl(window.location.href) === m.url) {
          if (this.highlighter) this.highlighter.loadHighlights(true).then(() => this.updateObserverState());
          if (this.whiteboard) this.whiteboard.loadStrokes();
        }
      }
      if (m.type === "TOGGLE_EXTENSION") this.toggleExtension(m.active);
      if (m.type === "TOGGLE_SITE_ENABLED") this.toggleSiteEnabled(m.active);
      if (m.type === "TOGGLE_USER_SELECT") this.toggleUserSelect(m.active);
      if (!this.ui || !this.highlighter) {
        if (m.type === "GET_STATE") sendResponse({ whiteboardActive: false, selectionOverrideActive: this.selectionOverrideActive });
        return;
      }
      if (m.type === "URL_CHANGED") this.handleObservedUrlChange(m.url || window.location.href);
      if (m.type === "TOGGLE_HIGHLIGHTS_VISIBILITY") this.toggleHighlightsVisibility(m.active);
      if (m.type === "TOGGLE_DRAWINGS_VISIBILITY") this.toggleDrawingsVisibility(m.active);
      if (m.type === "TOGGLE_WHITEBOARD") {
        this.whiteboardActive = m.active;
        this.ui.toggleWhiteboardMode(m.active);
        this.updateObserverState();
      }
      if (m.type === "TOGGLE_WHITEBOARD_CONTEXT") {
        this.whiteboardActive = !this.whiteboardActive;
        this.ui.toggleWhiteboardMode(this.whiteboardActive);
        this.updateObserverState();
      }
      if (m.type === "GET_STATE") sendResponse({ whiteboardActive: this.whiteboardActive, selectionOverrideActive: this.selectionOverrideActive });
      if (m.type === "TOGGLE_SELECTION_TOOLBAR") this.highlighter.selectionToolbarEnabled = m.active;
      if (m.type === "GOTO_HIGHLIGHT") this.highlighter.gotoHighlight(m.id);
      if (m.type === "LOAD_HIGHLIGHTS") this.highlighter.loadHighlights().then(() => this.updateObserverState());
      if (m.type === "LOAD_DEFAULT_COLORS") { this.highlighter.loadDefaultColor(); this.whiteboard.loadDefaultColor(); this.ui.loadCustomPresets(); }
      if (m.type === "SET_WHITEBOARD_THICKNESS") this.whiteboard.setThickness(m.thickness);
      if (m.type === "CLEAR_DRAWINGS") this.whiteboard.clear();
      if (m.type === "APPLY_HIGHLIGHT_CONTEXT") {
        const s = window.getSelection();
        this.highlighter.isValidSelection(s) ? this.highlighter.applyHighlight(s.getRangeAt(0), this.highlighter.currentColor, true) : this.ui.showNotification("Cannot highlight this selection");
      }
    });
  }
  toggleUserSelect() {
    let style = document.getElementById('marklet-user-select-override');
    this.selectionOverrideActive = !style;
    if (this.selectionOverrideActive) {
      style = document.createElement('style');
      style.textContent = `* { user-select: text !important; -webkit-user-select: text !important; pointer-events: auto !important; }`;
      style.id = 'marklet-user-select-override';
      document.head.appendChild(style);
      if (this.ui) this.ui.showNotification("Selection override enabled");
    } else {
      if (style) style.remove();
      if (this.ui) this.ui.showNotification("Selection override disabled");
    }
  }
  bindKeyboardEvents() {
    this.keyListener = (e) => this.handleKey(e);
    window.addEventListener("keydown", this.keyListener, true);
    window.addEventListener("keyup", this.keyListener, true);
    window.addEventListener("keypress", this.keyListener, true);
  }
  async toggleExtension(active) {
    if (active) {
      const d = await chrome.storage.local.get(["disabledSites", "enabledSites", "enableByDefault"]);
      const enableByDefault = d.enableByDefault !== false;
      const hostname = window.location.hostname;
      let shouldInit = false;
      if (enableByDefault) {
        shouldInit = !d.disabledSites?.includes(hostname);
      } else {
        shouldInit = d.enabledSites?.includes(hostname);
      }
      if (shouldInit) this.initAll();
    } else {
      this.destroyAll();
    }
  }
  toggleSiteEnabled(active) {
    if (active) this.initAll();
    else this.destroyAll();
  }
  handleKey(e) {
    if (!SharedUtils.isValidExtension()) return;
    const isWhiteboard = this.whiteboardActive;
    const isShadow = e.composedPath().includes(this.shadowHost);
    if (isWhiteboard && !isShadow && !(e.target.classList && e.target.classList.contains("marklet-text-input"))) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      if (e.type === 'keydown') {
        if (this.ui) this.ui.triggerKey(e);
        this.checkHotkeys(e);
      }
      return;
    }
    if (e.type === 'keydown') {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
      this.checkHotkeys(e);
    }
  }
  checkHotkeys(e) {
    const hotkeys = this.hotkeys || SharedUtils.getDefaultHotkeys();
    const checkKey = (hotkey) => {
      if (!hotkey) return false;
      const parts = hotkey.toLowerCase().split("+");
      const key = parts.pop();
      const codeMap = { Period: '.', Comma: ',', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Quote: "'", Semicolon: ';', Minus: '-', Equal: '=', Backquote: '`', Space: 'Space' };
      let inputKey = (e.code || "").replace(/^Key/, "").replace(/^Digit/, "");
      if (codeMap[inputKey]) inputKey = codeMap[inputKey];
      if (e.code && codeMap[e.code]) inputKey = codeMap[e.code];
      const isMatch = inputKey.toLowerCase() === key || (e.key && e.key.toLowerCase() === key);
      return isMatch &&
        (parts.includes("meta") || parts.includes("cmd") || parts.includes("command")) === e.metaKey &&
        (parts.includes("ctrl") || parts.includes("control")) === e.ctrlKey &&
        (parts.includes("alt") || parts.includes("option")) === e.altKey &&
        (parts.includes("shift")) === e.shiftKey;
    };
    const handleAction = (action) => {
      if (!this.whiteboardActive) { e.preventDefault(); e.stopPropagation(); }
      action();
    };

    if (checkKey(hotkeys.highlight)) {
      handleAction(() => {
        const s = window.getSelection();
        if (this.highlighter && this.highlighter.isValidSelection(s)) this.highlighter.applyHighlight(s.getRangeAt(0), this.highlighter.currentColor, true);
      });
    }
    if (checkKey(hotkeys.toggleWhiteboard)) {
      handleAction(() => {
        this.whiteboardActive = !this.whiteboardActive;
        this.ui.toggleWhiteboardMode(this.whiteboardActive);
        this.updateObserverState();
      });
    }
    if (checkKey(hotkeys.toggleDrawings)) {
      handleAction(() => this.toggleDrawingsVisibility(document.documentElement.classList.contains("marklet-hidden-d")));
    }
    if (checkKey(hotkeys.toggleHighlights)) {
      handleAction(() => this.toggleHighlightsVisibility(document.documentElement.classList.contains("marklet-hidden-h")));
    }
    if (checkKey(hotkeys.toggleAll)) {
      handleAction(() => {
        const v = document.documentElement.classList.contains("marklet-hidden-h");
        this.toggleHighlightsVisibility(v); this.toggleDrawingsVisibility(v);
      });
    }
  }
  toggleHighlightsVisibility(v) { document.documentElement.classList.toggle("marklet-hidden-h", !v); }
  toggleDrawingsVisibility(v) { document.documentElement.classList.toggle("marklet-hidden-d", !v); if (this.whiteboard) this.whiteboard.toggleVisibility(v); }
  async restoreState() {
    if (!SharedUtils.isValidExtension()) return;
    const d = await chrome.storage.local.get(["theme", "highlightsVisible", "drawingsVisible", "selectionToolbarEnabled", "highlightShadowsEnabled", "highlightRounded"]);
    if (d.theme && d.theme !== "system") document.documentElement.setAttribute("data-marklet-theme", d.theme);
    this.toggleHighlightsVisibility(d.highlightsVisible !== false);
    this.toggleDrawingsVisibility(d.drawingsVisible !== false);
    document.documentElement.classList.toggle("marklet-shadows", d.highlightShadowsEnabled !== false);
    document.documentElement.classList.toggle("marklet-rounded", d.highlightRounded !== false);
    this.highlighter.selectionToolbarEnabled = d.selectionToolbarEnabled !== false;
    this.ui.toggleDock(this.whiteboardActive);
  }
}
if (typeof module !== 'undefined') {
  module.exports = { Marklet };
} else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  new Marklet();
}
