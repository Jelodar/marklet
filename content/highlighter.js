class Highlighter {
  constructor(app) { this.app = app; this.currentColor = "#FFFF00"; this.selectionToolbarEnabled = true; this.isProcessing = false; this.init(); }
  init() {
    this.mouseUpListener = (e) => this.handleSelection(e);
    this.selectionChangeListener = (e) => this.handleSelectionChange(e);
    this.clickListener = (e) => this.handleHighlightClick(e);
    this.storageListener = (c) => {
        if (SharedUtils.isValidExtension()) {
            if (c.pages && !this.isProcessing) this.loadHighlights();
            if (c.highlightShadowsEnabled) document.documentElement.classList.toggle("marklet-shadows", c.highlightShadowsEnabled.newValue);
            if (c.highlightRounded) document.documentElement.classList.toggle("marklet-rounded", c.highlightRounded.newValue);
        }
    };
    document.addEventListener("mouseup", this.mouseUpListener);
    document.addEventListener("selectionchange", this.selectionChangeListener);
    document.addEventListener("click", this.clickListener);
    chrome.storage.onChanged.addListener(this.storageListener);
    this.loadHighlights(); this.loadDefaultColor();
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
  async loadDefaultColor() { if (SharedUtils.isValidExtension()) { const d = await chrome.storage.local.get(["defaultHighlightColor"]); if (d.defaultHighlightColor) this.currentColor = d.defaultHighlightColor; } }
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
    }, 150);
  }
  isEditable(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.body) {
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return true;
      el = el instanceof ShadowRoot ? el.host : (el.parentElement || el.parentNode);
    }
    return false;
  }
  resolveStoredHighlights(highlights) {
    let fullDOMText = null;
    const rangeRequests = [];
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
      if (r) rangeRequests.push({ id: h.id, range: r, highlight: h });
    });
    return rangeRequests;
  }

  async applyHighlight(r, c, isHotkey = false) {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    if (this.isEditable(r.startContainer) || this.isEditable(r.endContainer)) { this.app.ui.showNotification("Cannot highlight editable content"); return; }
    this.isProcessing = true; this.app.hasHighlights = true; this.app.pauseObserver();
    try {
      const url = SharedUtils.normalizeUrl(window.location.href);
      const d = await chrome.storage.local.get(["pages"]);
      const pages = d.pages || {};
      if (!pages[url]) pages[url] = { url, highlights: [], drawings: [] };
      const newOffsets = DOMUtils.getGlobalOffsets(r);
      const text = r.toString();
      if (!newOffsets) throw new Error("Unable to calculate offsets");
      DOMUtils.stripHighlights();
      
      const rangeRequests = this.resolveStoredHighlights(pages[url].highlights);
      
      const offsetMap = DOMUtils.getBatchGlobalOffsets(rangeRequests);
      const resolvedHighlights = rangeRequests.map(req => { const off = offsetMap.get(req.id); return off ? { ...req.highlight, start: off.start, end: off.end } : null; }).filter(Boolean);
      const merged = this.flattenIntervals(resolvedHighlights, { start: newOffsets.start, end: newOffsets.end, color: c, text });
      await this.renderAndSave(merged, pages, url);
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
    } catch (err) { console.error("Marklet:", err); this.loadHighlights(); } finally { this.isProcessing = false; this.app.updateObserverState(); }
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
      if (n.start <= c.end && n.color === c.color) { c.end = Math.max(c.end, n.end); c.text = null; } else m.push(n);
    }
    return m;
  }
  renderIntervals(intervals) { intervals.forEach(item => { const r = DOMUtils.getRangeFromOffsets(item.start, item.end); if (r) this.renderHighlight(r, item.color, item.id); }); }
  async renderAndSave(intervals, pages, url) {
    DOMUtils.stripHighlights();
    const docLength = DOMUtils.getDocumentText().length;
    pages[url].highlights = intervals.map(m => {
      const range = DOMUtils.getRangeFromOffsets(m.start, m.end);
      if (!range) return null;
      const id = m.id || crypto.randomUUID(); m.id = id;
      return { id, url, color: m.color, text: m.text || range.toString(), anchor: DOMUtils.serializeRange(range), start: m.start, docLength, timestamp: Date.now() };
    }).filter(Boolean);
    this.renderIntervals(intervals);
    await chrome.storage.local.set({ pages });
  }
  async loadHighlights() {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    this.isProcessing = true; this.app.pauseObserver();
    try {
      const d = await chrome.storage.local.get(["pages"]);
      const url = SharedUtils.normalizeUrl(window.location.href);
      const pageHighlights = d.pages?.[url]?.highlights || [];
      DOMUtils.stripHighlights();
      this.app.hasHighlights = pageHighlights.length > 0;
      if (!this.app.hasHighlights) return;
      
      const rangeRequests = this.resolveStoredHighlights(pageHighlights);
      
      const offsetMap = DOMUtils.getBatchGlobalOffsets(rangeRequests);
      this.renderIntervals(rangeRequests.map(req => offsetMap.get(req.id) ? { start: offsetMap.get(req.id).start, end: offsetMap.get(req.id).end, color: req.highlight.color, id: req.id } : null).filter(Boolean));
    } catch (e) { console.error("Marklet:", e); } finally { this.isProcessing = false; this.app.updateObserverState(); }
  }
  renderHighlight(r, c, id) {
    const nodes = [];
    const w = document.createTreeWalker(r.commonAncestorContainer, NodeFilter.SHOW_TEXT, { acceptNode: (n) => r.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    while (w.nextNode()) nodes.push(w.currentNode);
    if (nodes.length === 0 && r.commonAncestorContainer.nodeType === Node.TEXT_NODE) nodes.push(r.commonAncestorContainer);
    const textColor = this.getContrastColor(c);
    const nodeData = nodes.map(n => ({ node: n, start: n === r.startContainer ? r.startOffset : 0, end: n === r.endContainer ? r.endOffset : n.textContent.length }));
    const processedParents = new Set();
    nodeData.forEach(({ node: n }) => {
      const p = n.parentNode;
      if (p && !processedParents.has(p) && (window.getComputedStyle(p).display.includes("flex") || window.getComputedStyle(p).display.includes("grid")) && !p.classList.contains("marklet-flex-wrapper")) {
        let start = n, end = n;
        while (start.previousSibling && (start.previousSibling.nodeType === 3 || start.previousSibling.nodeName === "MARK")) start = start.previousSibling;
        while (end.nextSibling && (end.nextSibling.nodeType === 3 || end.nextSibling.nodeName === "MARK")) end = end.nextSibling;
        const wrapper = document.createElement("span"); wrapper.className = "marklet-flex-wrapper"; p.insertBefore(wrapper, start);
        let curr = start; while (curr) { const next = curr.nextSibling; wrapper.appendChild(curr); if (curr === end) break; curr = next; }
        processedParents.add(p);
      }
    });
    nodeData.forEach(({ node: n, start, end }) => {
      if (start >= end) return;
      const nr = document.createRange(); nr.setStart(n, start); nr.setEnd(n, end);
      const m = document.createElement("mark"); m.className = "marklet-highlight"; m.style.cssText = `background-color: ${c} !important; color: ${textColor} !important;`; m.dataset.id = id;
      try { m.appendChild(nr.extractContents()); nr.insertNode(m); } catch (e) {}
    });
  }
  getContrastColor(color) {
    if (!color) return "black";
    if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            return (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000 >= 128 ? "black" : "white";
        }
        return "black";
    }
    let h = color.replace("#", ""); if (h.length === 3) h = h.split("").map(x => x+x).join("");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "black" : "white";
  }
  handleHighlightClick(e) {
    const t = e.target.closest(".marklet-highlight");
    if (t) { const b = t.getBoundingClientRect(); this.app.ui.showEditToolbar(b.left + b.width / 2, b.top, t.dataset.id); e.stopPropagation(); }
  }
  async deleteHighlight(id) {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    this.isProcessing = true; this.app.pauseObserver();
    try {
      const d = await chrome.storage.local.get(["pages"]);
      const url = SharedUtils.normalizeUrl(window.location.href);
      if (d.pages?.[url]) {
        d.pages[url].highlights = d.pages[url].highlights.filter(h => h.id !== id);
        if (d.pages[url].highlights.length === 0 && (!d.pages[url].drawings || d.pages[url].drawings.length === 0)) delete d.pages[url];
        await chrome.storage.local.set({ pages: d.pages });
        this.isProcessing = false;
        this.loadHighlights();
      } else {
        this.isProcessing = false;
      }
      this.app.ui.hideEditToolbar();
    } catch (e) { console.error("Marklet:", e); this.isProcessing = false; } finally { this.app.updateObserverState(); }
  }
  previewColor(id, c) { document.querySelectorAll(`.marklet-highlight[data-id="${id}"]`).forEach(m => { m.style.backgroundColor = c; m.style.color = this.getContrastColor(c); }); }
  async changeColor(id, c) {
    if (!SharedUtils.isValidExtension() || this.isProcessing) return;
    this.isProcessing = true; this.app.pauseObserver();
    try {
      const d = await chrome.storage.local.get(["pages"]);
      const url = SharedUtils.normalizeUrl(window.location.href);
      const h = d.pages?.[url]?.highlights?.find(x => x.id === id);
      if (h) {
        h.color = c;
        DOMUtils.stripHighlights();
        const rangeRequests = d.pages[url].highlights.map(item => ({ id: item.id, range: DOMUtils.resolveRange(item.anchor), color: item.color, text: item.text })).filter(x => x.range);
        const offsetMap = DOMUtils.getBatchGlobalOffsets(rangeRequests);
        const intervals = rangeRequests.map(req => { const off = offsetMap.get(req.id); return off ? { start: off.start, end: off.end, color: req.color, text: req.text } : null; }).filter(Boolean);
        await this.renderAndSave(this.mergeIntervals(intervals), d.pages, url);
        this.app.ui.trackRecentColor(c); this.app.ui.hideEditToolbar();
      }
    } catch (e) { console.error("Marklet:", e); this.loadHighlights(); } finally { this.isProcessing = false; this.app.updateObserverState(); }
  }
  gotoHighlight(id) {
    const el = document.querySelector(`.marklet-highlight[data-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const marks = document.querySelectorAll(`.marklet-highlight[data-id="${id}"]`);
      marks.forEach(m => { m.classList.remove("marklet-flash", "marklet-spotlight"); void m.offsetWidth; m.classList.add("marklet-spotlight"); });
      setTimeout(() => marks.forEach(m => m.classList.remove("marklet-spotlight")), 2500);
    }
  }
}
if (typeof module !== 'undefined') {
  module.exports = { Highlighter };
}
