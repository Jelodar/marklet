class DOMUtils {
  static isVisibleTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent) return false;
    let current = node.parentElement;
    if (!current) return false;
    const styleCache = new Map();
    while (current && current !== document.body) {
      const tag = current.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'HEAD' || tag === 'TITLE' || tag === 'META') return false;
      if (current.hasAttribute('hidden') || current.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      current = current.parentElement;
    }
    return true;
  }
  static createTextSnapshot() {
    const nodes = [];
    const starts = [];
    const lengths = [];
    const nodeOffsets = new Map();
    const styleCache = new Map();
    let text = "";

    const getStyle = (el) => {
      let s = styleCache.get(el);
      if (s !== undefined) return s;
      s = window.getComputedStyle(el);
      styleCache.set(el, s);
      return s;
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.nodeName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'HEAD' || tag === 'TITLE' || tag === 'META') return NodeFilter.FILTER_REJECT;
          if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
          if (getStyle(node).display === 'none') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP;
        }
        const parent = node.parentElement;
        if (!parent || getStyle(parent).visibility === 'hidden' || !node.textContent) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const start = text.length;
        nodes.push(node);
        starts.push(start);
        lengths.push(node.textContent.length);
        nodeOffsets.set(node, start);
        text += node.textContent;
      }
    }
    return { nodes, starts, lengths, nodeOffsets, text };
  }
  static getFirstTextNode(root) {
    if (!root) return null;
    if (root.nodeType === Node.TEXT_NODE) return root;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    return walker.nextNode();
  }
  static resolveBoundary(container, offset, isEnd) {
    if (container.nodeType === Node.TEXT_NODE) {
      return { node: container, offset };
    }
    const target = container.childNodes[isEnd ? offset - 1 : offset] || container;
    const node = DOMUtils.getFirstTextNode(target);
    if (!node) return null;
    return { node, offset: isEnd ? node.textContent.length : 0 };
  }
  static getGlobalOffsets(range, snapshot = DOMUtils.createTextSnapshot()) {
    const startBoundary = DOMUtils.resolveBoundary(range.startContainer, range.startOffset, false);
    const endBoundary = DOMUtils.resolveBoundary(range.endContainer, range.endOffset, true);
    if (!startBoundary || !endBoundary) return null;
    const startBase = snapshot.nodeOffsets.get(startBoundary.node);
    const endBase = snapshot.nodeOffsets.get(endBoundary.node);
    if (startBase === undefined || endBase === undefined) return null;
    return { start: startBase + startBoundary.offset, end: endBase + endBoundary.offset };
  }
  static getBatchGlobalOffsets(ranges, snapshot = DOMUtils.createTextSnapshot()) {
    const resultMap = new Map();
    ranges.forEach(({ id, range }) => {
      if (!range) return;
      const offsets = DOMUtils.getGlobalOffsets(range, snapshot);
      if (offsets) resultMap.set(id, offsets);
    });
    return resultMap;
  }
  static findTextNodeIndex(snapshot, offset, isEnd = false) {
    if (!snapshot.nodes.length) return -1;
    const probe = isEnd ? offset - 1 : offset;
    if (probe < 0) return -1;
    let low = 0, high = snapshot.starts.length - 1, result = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (snapshot.starts[mid] <= probe) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (result === -1) return -1;
    const nodeStart = snapshot.starts[result];
    const nodeEnd = nodeStart + snapshot.lengths[result];
    if (isEnd ? offset > nodeStart && offset <= nodeEnd : offset >= nodeStart && offset < nodeEnd) return result;
    return -1;
  }
  static getRangeFromOffsets(start, end, snapshot = DOMUtils.createTextSnapshot()) {
    const startIndex = DOMUtils.findTextNodeIndex(snapshot, start, false);
    const endIndex = DOMUtils.findTextNodeIndex(snapshot, end, true);
    if (startIndex === -1 || endIndex === -1) return null;
    const rsNode = snapshot.nodes[startIndex];
    const reNode = snapshot.nodes[endIndex];
    const rsOffset = start - snapshot.starts[startIndex];
    const reOffset = end - snapshot.starts[endIndex];
    if (rsNode && reNode) {
      const r = document.createRange();
      try { r.setStart(rsNode, rsOffset); r.setEnd(reNode, reOffset); return r; } catch (e) { return null; }
    }
    return null;
  }
  static getPath(node) {
    const p = [];
    let c = node;
    while (c && c !== document.body) {
      let i = 0, s = c.previousSibling;
      while (s) { if (s.nodeName === c.nodeName) i++; s = s.previousSibling; }
      p.unshift(`${c.nodeName}[${i}]`);
      c = c.parentNode;
    }
    return p.join("/");
  }
  static resolvePath(path) {
    try {
      const segs = path.split("/");
      let c = document.body;
      for (const s of segs) {
        const m = s.match(/^(.+)\[(\d+)\]$/);
        if (!m) return null;
        const [, name, idxStr] = m, idx = parseInt(idxStr);
        let matchCount = -1, found = null;
        for (const child of c.childNodes) {
          if (child.nodeName === name && ++matchCount === idx) { found = child; break; }
        }
        if (!found) return null;
        c = found;
      }
      return c;
    } catch { return null; }
  }
  static serializeRange(r) {
    return { startPath: DOMUtils.getPath(r.startContainer), startOffset: r.startOffset, endPath: DOMUtils.getPath(r.endContainer), endOffset: r.endOffset };
  }
  static resolveRange(anchor) {
    const s = DOMUtils.resolvePath(anchor.startPath), e = DOMUtils.resolvePath(anchor.endPath);
    if (s && e) {
      const r = document.createRange();
      try { r.setStart(s, anchor.startOffset); r.setEnd(e, anchor.endOffset); return r; } catch { return null; }
    }
    return null;
  }
  static getDocumentText(snapshot = DOMUtils.createTextSnapshot()) {
    return snapshot.text;
  }
  static findFallbackRange(targetText, fullDOMText, expectedStart, expectedDocLength, expectedNodeOffset, snapshot = DOMUtils.createTextSnapshot()) {
    const text = fullDOMText || snapshot.text;
    if (!targetText || !text) return null;
    const indices = [];
    let idx = text.indexOf(targetText);
    while (idx !== -1) { indices.push(idx); idx = text.indexOf(targetText, idx + 1); }
    if (indices.length === 0) return null;
    if (indices.length === 1) return DOMUtils.getRangeFromOffsets(indices[0], indices[0] + targetText.length, snapshot);
    const candidates = [];
    indices.forEach((startGlobal) => {
      const nodeIndex = DOMUtils.findTextNodeIndex(snapshot, startGlobal, false);
      if (nodeIndex === -1) return;
      candidates.push({ index: startGlobal, nodeOffset: startGlobal - snapshot.starts[nodeIndex] });
    });
    const currentDocLength = text.length;
    let projectedStart = -1;
    if (expectedStart !== undefined && expectedDocLength) projectedStart = (expectedStart / expectedDocLength) * currentDocLength;
    candidates.forEach((c) => {
      c.score = (expectedNodeOffset !== undefined && c.nodeOffset === expectedNodeOffset) ? 1000 : 0;
      c.drift = projectedStart !== -1 ? Math.abs(c.index - projectedStart) : Infinity;
    });
    candidates.sort((a, b) => (a.score !== b.score ? b.score - a.score : a.drift - b.drift));
    const best = candidates[0];
    if (best.score < 1000 && projectedStart !== -1 && best.drift > currentDocLength * 0.2) return null;
    return DOMUtils.getRangeFromOffsets(best.index, best.index + targetText.length, snapshot);
  }
  static stripHighlights() {
      document.querySelectorAll(".marklet-highlight, .marklet-flex-wrapper").forEach((el) => {
        const p = el.parentNode;
        if (p) { while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
      });
    document.body.normalize();
  }
  static getTextFragment(range) {
    const fullText = DOMUtils.getDocumentText(), offsets = DOMUtils.getGlobalOffsets(range);
    if (!offsets) return "";
    const rangeText = range.toString().trim().replace(/\s+/g, " ");
    if (!rangeText) return "";

    const isUnique = (text) => {
        const first = fullText.indexOf(text);
        return first !== -1 && first === fullText.lastIndexOf(text);
    };

    const getSafeWords = (text, count, fromEnd = false) => {
        const words = text.trim().split(/\s+/).filter(Boolean);
        if (fromEnd) return words.slice(-count).join(" ");
        return words.slice(0, count).join(" ");
    };

    if (rangeText.length <= 64 && isUnique(rangeText)) return `#:~:text=${encodeURIComponent(rangeText)}`;

    let textStart = rangeText, textEnd = "";
    if (rangeText.length > 64) {
        textStart = getSafeWords(rangeText, 3);
        textEnd = getSafeWords(rangeText, 3, true);
    }

    const contextLen = 100;
    const prefixFull = fullText.substring(Math.max(0, offsets.start - contextLen), offsets.start);
    const suffixFull = fullText.substring(offsets.end, Math.min(fullText.length, offsets.end + contextLen));
    
    const prefix = getSafeWords(prefixFull, 2, true);
    const suffix = getSafeWords(suffixFull, 2);

    let fragment = "#:~:text=";
    if (prefix) fragment += `${encodeURIComponent(prefix)}-,`;
    fragment += encodeURIComponent(textStart);
    if (textEnd) fragment += `,${encodeURIComponent(textEnd)}`;
    if (suffix) fragment += `,-${encodeURIComponent(suffix)}`;
    
    return fragment;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { DOMUtils };
}
