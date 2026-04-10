class Highlighter {
  constructor(app) {
    this.app = app;
    this.currentColor = "#FFFF00";
    this.selectionToolbarEnabled = true;
    this.allowReadonly = true;
    this.isProcessing = false;
    this.localPage = { highlights: [] };
    this.init();
  }
  init() {
    this.mouseUpListener = (e) => this.handleSelection(e);
    this.selectionChangeListener = (e) => this.handleSelectionChange(e);
    this.clickListener = (e) => this.handleHighlightClick(e);
    this.storageListener = (c) => {
        if (SharedUtils.isValidExtension()) {
            if (c.highlightShadowsEnabled) document.documentElement.classList.toggle("marklet-shadows", c.highlightShadowsEnabled.newValue);
            if (c.highlightRounded) document.documentElement.classList.toggle("marklet-rounded", c.highlightRounded.newValue);
            if (c.allowReadonlyHighlight) this.allowReadonly = c.allowReadonlyHighlight.newValue;
        }
    };
    document.addEventListener("mouseup", this.mouseUpListener);
    document.addEventListener("selectionchange", this.selectionChangeListener);
    document.addEventListener("click", this.clickListener);
    chrome.storage.onChanged.addListener(this.storageListener);
    this.loadHighlights();
    this.loadDefaultColor();
  }
  destroy() {
    document.removeEventListener("mouseup", this.mouseUpListener);
    document.removeEventListener("selectionchange", this.selectionChangeListener);
    document.removeEventListener("click", this.clickListener);
    chrome.storage.onChanged.removeListener(this.storageListener);
  }
  handleSelectionChange(e) {
    if (this.app.ui && this.app.ui.selToolbar) {
      const s = window.getSelection();
      if (!s || s.isCollapsed) this.app.ui.hideSelectionToolbar();
    }
  }
  async loadDefaultColor() {
    if (SharedUtils.isValidExtension()) {
      const d = await chrome.storage.local.get(["defaultHighlightColor", "allowReadonlyHighlight"]);
      if (d.defaultHighlightColor) this.currentColor = d.defaultHighlightColor;
      this.allowReadonly = d.allowReadonlyHighlight !== false;
    }
  }
  isValidSelection(s) {
    if (!s || s.isCollapsed || s.rangeCount === 0 || !s.toString().trim()) return false;
    const range = s.getRangeAt(0);
    return !this.isEditable(range.startContainer) && !this.isEditable(range.endContainer) && !this.isEditable(range.commonAncestorContainer);
  }
  handleSelection(e) {
    if (!SharedUtils.isValidExtension()) return;
    if (this.selectionTimer) clearTimeout(this.selectionTimer);
    this.selectionTimer = setTimeout(() => {
      if (e.composedPath().includes(this.app.shadowHost)) return;
      const s = window.getSelection();
      if (!this.isValidSelection(s) || !this.selectionToolbarEnabled) {
        if (this.app.ui && !this.app.ui.palette.classList.contains("visible") && !this.app.ui.isPickingCustomColor) this.app.ui.hideSelectionToolbar();
        return;
      }
      const b = s.getRangeAt(0).getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && this.app.ui) this.app.ui.showSelectionToolbar(b.left + b.width / 2, b.top, s.getRangeAt(0));
    }, CONSTANTS.SELECTION_DEBOUNCE);
  }
  isEditable(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.body) {
      if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') return true;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        if (this.allowReadonly && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.readOnly) return false;
        return true;
      }
      el = el instanceof ShadowRoot ? el.host : (el.parentElement || el.parentNode);
    }
    return false;
  }
  resolveStoredHighlights(highlights) {
    let fullDOMText = null;
    const resolved = [], unresolved = [];
    highlights.forEach(h => {
      let r = DOMUtils.resolveRange(h.anchor);
      const normalize = (s) => (s || "").replace(/\s+/g, " ").trim();
      const stored = normalize(h.text);
      if (stored && (!r || normalize(r.toString()) !== stored)) {
        if (fullDOMText === null) fullDOMText = DOMUtils.getDocumentText();
        const fr = DOMUtils.findFallbackRange(h.text, fullDOMText, h.start, h.docLength, h.anchor?.startOffset);
        if (fr) r = fr;
      }
      if (r && stored && normalize(r.toString()) !== stored) r = null;
      if (r) resolved.push({ id: h.id, range: r, highlight: h });
      else unresolved.push(h);
    });
    return { resolved, unresolved };
  }
  async applyHighlight(r, c, isHotkey = false) {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    if (this.isEditable(r.startContainer) || this.isEditable(r.endContainer)) {
      this.app.ui.showNotification("Cannot highlight editable content");
      return;
    }
    this.isProcessing = true;
    this.app.hasHighlights = true;
    this.app.pauseObserver();
    try {
      const url = SharedUtils.normalizeUrl(window.location.href);
      const page = await tinyIDB.get(url) || { url, highlights: [], drawings: [] };
      const newOffsets = DOMUtils.getGlobalOffsets(r);
      const text = r.toString();
      if (!newOffsets) throw new Error("Unable to calculate offsets");
      DOMUtils.stripHighlights();
      const { resolved: rangeRequests, unresolved: initiallyUnresolved } = this.resolveStoredHighlights(page.highlights);
      const offsetMap = DOMUtils.getBatchGlobalOffsets(rangeRequests);
      const resolvedHighlights = [];
      const unresolved = [...initiallyUnresolved];
      rangeRequests.forEach(req => {
        const off = offsetMap.get(req.id);
        if (off) resolvedHighlights.push({ ...req.highlight, start: off.start, end: off.end });
        else unresolved.push(req.highlight);
      });
      const merged = this.flattenIntervals(resolvedHighlights, { start: newOffsets.start, end: newOffsets.end, color: c, text });
      await this.renderAndSave(merged, page, url, unresolved);
      this.app.ui.trackRecentColor(c);
      window.getSelection().removeAllRanges();
      const newHighlight = merged.find(m => m.start <= newOffsets.start && m.end >= newOffsets.end);
      if (newHighlight && newHighlight.id && this.app.ui) {
          const newRange = DOMUtils.getRangeFromOffsets(newHighlight.start, newHighlight.end);
          if (newRange) {
              const rect = newRange.getBoundingClientRect();
              this.app.ui.showEditToolbar(rect.left + rect.width / 2, rect.top, newHighlight.id);
          }
      } else {
          this.app.ui.hideSelectionToolbar();
      }
    } catch (err) {
      console.error("Marklet:", err);
      this.loadHighlights();
    } finally {
      this.isProcessing = false;
      this.app.updateObserverState();
    }
  }
  flattenIntervals(ex, item) {
    const res = [];
    ex.forEach((x) => {
      if (x.end <= item.start || x.start >= item.end) res.push({ start: x.start, end: x.end, color: x.color, text: x.text });
      else {
        if (x.start < item.start) res.push({ start: x.start, end: item.start, color: x.color, text: null });
        if (x.end > item.end) res.push({ start: item.end, end: x.end, color: x.color, text: null });
      }
    });
    res.push(item);
    return this.mergeIntervals(res);
  }
  mergeIntervals(intervals) {
    if (intervals.length === 0) return [];
    intervals.sort((a, b) => a.start - b.start);
    const m = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const c = m[m.length - 1], n = intervals[i];
      if (n.start <= c.end && n.color === c.color) {
        c.end = Math.max(c.end, n.end);
        c.text = null;
      } else m.push(n);
    }
    return m;
  }
  renderIntervals(intervals) {
    const displayCache = new WeakMap();
    intervals.forEach(item => {
      const r = DOMUtils.getRangeFromOffsets(item.start, item.end);
      if (r) this.renderHighlight(r, item.color, item.id, displayCache);
    });
  }
  async renderAndSave(intervals, page, url, unresolved = []) {
    DOMUtils.stripHighlights();
    const docLength = DOMUtils.getDocumentText().length;
    const highlights = intervals.map(m => {
      const range = DOMUtils.getRangeFromOffsets(m.start, m.end);
      if (!range) return null;
      const id = m.id || crypto.randomUUID();
      m.id = id;
      return { id, url, color: m.color, text: m.text || range.toString(), anchor: DOMUtils.serializeRange(range), start: m.start, docLength, timestamp: Date.now() };
    }).filter(Boolean);
    if (this.app.isSavable) {
      page.highlights = [...highlights, ...unresolved];
      page.lastUpdated = Date.now();
      await tinyIDB.set(url, page);
    } else {
      this.localPage.highlights = [...highlights, ...unresolved];
      this.localPage.lastUpdated = Date.now();
    }
    this.renderIntervals(intervals);
  }
  async loadHighlights() {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    this.isProcessing = true;
    this.app.pauseObserver();
    try {
      const url = SharedUtils.normalizeUrl(window.location.href);
      let pageHighlights = [];
      if (this.app.isSavable) {
        const page = await tinyIDB.get(url);
        pageHighlights = page?.highlights || [];
      } else {
        pageHighlights = this.localPage.highlights || [];
      }
      DOMUtils.stripHighlights();
      this.app.hasHighlights = pageHighlights.length > 0;
      if (!this.app.hasHighlights) return;
      const { resolved: rangeRequests } = this.resolveStoredHighlights(pageHighlights);
      const offsetMap = DOMUtils.getBatchGlobalOffsets(rangeRequests);
      this.renderIntervals(rangeRequests.map(req => offsetMap.get(req.id) ? { start: offsetMap.get(req.id).start, end: offsetMap.get(req.id).end, color: req.highlight.color, id: req.id } : null).filter(Boolean));
    } catch (e) {
      console.error("Marklet:", e);
    } finally {
      this.isProcessing = false;
      this.app.updateObserverState();
    }
  }
  renderHighlight(r, c, id, displayCache = new WeakMap()) {
    const nodes = [];
    const w = document.createTreeWalker(r.commonAncestorContainer, NodeFilter.SHOW_TEXT, { acceptNode: (n) => r.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    while (w.nextNode()) nodes.push(w.currentNode);
    if (nodes.length === 0 && r.commonAncestorContainer.nodeType === Node.TEXT_NODE) nodes.push(r.commonAncestorContainer);
    const textColor = this.getContrastColor(c);
    const nodeData = nodes.map(n => ({ node: n, start: n === r.startContainer ? r.startOffset : 0, end: n === r.endContainer ? r.endOffset : n.textContent.length }));
    const wrappedParents = new Set();
    nodeData.forEach(({ node: n }) => {
      const p = n.parentNode;
      if (!p || p.nodeType !== 1 || wrappedParents.has(p) || p.classList.contains("marklet-flex-wrapper") || p.classList.contains("marklet-highlight")) return;
      
      let isFlexGrid = displayCache.get(p);
      if (isFlexGrid === undefined) {
        const display = window.getComputedStyle(p).display;
        isFlexGrid = display.includes("flex") || display.includes("grid");
        displayCache.set(p, isFlexGrid);
      }

      if (isFlexGrid) {
        let start = n, end = n;
        while (start.previousSibling && (start.previousSibling.nodeType === 3 || start.previousSibling.nodeName === "MARK")) start = start.previousSibling;
        while (end.nextSibling && (end.nextSibling.nodeType === 3 || end.nextSibling.nodeName === "MARK")) end = end.nextSibling;
        const wrapper = document.createElement("span"); wrapper.className = "marklet-flex-wrapper"; p.insertBefore(wrapper, start);
        let curr = start; while (curr) { const next = curr.nextSibling; wrapper.appendChild(curr); if (curr === end) break; curr = next; }
        wrappedParents.add(p);
      }
    });
    nodeData.forEach(({ node: n, start, end }) => {
      if (start >= end) return;
      const nr = document.createRange(); nr.setStart(n, start); nr.setEnd(n, end);
      const m = document.createElement("mark"); m.className = "marklet-highlight";
      m.style.cssText = `background-color: ${c} !important; color: ${textColor} !important; padding: 1px 0 !important; cursor: pointer !important; display: inline !important; border: none !important; transition: transform 0.2s, background-color 0.1s !important;`;
      m.dataset.id = id;
      try { m.appendChild(nr.extractContents()); nr.insertNode(m); } catch (e) {}
    });
  }
  getContrastColor(color) {
    if (!color) return "black";
    let r, g, b;
    if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            r = parseInt(rgb[0]); g = parseInt(rgb[1]); b = parseInt(rgb[2]);
        } else return "black";
    } else {
        let h = color.replace("#", "");
        if (h.length === 3) h = h.split("").map(x => x+x).join("");
        r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    }
    return (r * 299 + g * 587 + b * 114) / 1000 >= CONSTANTS.BRIGHTNESS_THRESHOLD ? "black" : "white";
  }
  handleHighlightClick(e) {
    const t = e.target.closest(".marklet-highlight");
    if (t) {
      const b = t.getBoundingClientRect();
      this.app.ui.showEditToolbar(b.left + b.width / 2, b.top, t.dataset.id);
      e.stopPropagation();
    }
  }
  async deleteHighlight(id) {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    this.isProcessing = true;
    this.app.pauseObserver();
    try {
      const url = SharedUtils.normalizeUrl(window.location.href);
      const page = await tinyIDB.get(url);
      if (page) {
        page.highlights = page.highlights.filter(h => h.id !== id);
        if (page.highlights.length === 0 && (!page.drawings || page.drawings.length === 0)) await tinyIDB.remove(url);
        else await tinyIDB.set(url, page);
        this.isProcessing = false;
        await this.loadHighlights();
      } else {
        this.isProcessing = false;
      }
      this.app.ui.hideEditToolbar();
    } catch (e) {
      console.error("Marklet:", e);
      this.isProcessing = false;
    } finally {
      this.app.updateObserverState();
    }
  }
  previewColor(id, c) {
    document.querySelectorAll(`.marklet-highlight[data-id="${id}"]`).forEach(m => {
      m.style.backgroundColor = c;
      m.style.color = this.getContrastColor(c);
    });
  }
  async changeColor(id, c) {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    this.isProcessing = true;
    this.app.pauseObserver();
    try {
      const url = SharedUtils.normalizeUrl(window.location.href);
      const page = await tinyIDB.get(url);
      const h = page?.highlights?.find(x => x.id === id);
      if (h) {
        h.color = c;
        await tinyIDB.set(url, page);
        this.isProcessing = false;
        await this.loadHighlights();
        this.app.ui.trackRecentColor(c);
        this.app.ui.hideEditToolbar();
      }
    } catch (e) {
      console.error("Marklet:", e);
      this.isProcessing = false;
      this.loadHighlights();
    } finally {
      this.isProcessing = false;
      this.app.updateObserverState();
    }
  }
  gotoHighlight(id) {
    const el = document.querySelector(`.marklet-highlight[data-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const marks = document.querySelectorAll(`.marklet-highlight[data-id="${id}"]`);
      marks.forEach(m => {
        m.classList.remove("marklet-flash", "marklet-spotlight");
        void m.offsetWidth;
        m.classList.add("marklet-spotlight");
      });
      setTimeout(() => marks.forEach(m => m.classList.remove("marklet-spotlight")), CONSTANTS.SPOTLIGHT_DURATION);
    }
  }
}
if (typeof module !== 'undefined') {
  module.exports = { Highlighter };
}
