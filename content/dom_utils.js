class DOMUtils {
  static getGlobalOffsets(range) {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let offset = 0, start = -1, end = -1, node;
    const { startContainer: sc, endContainer: ec } = range;
    while ((node = w.nextNode())) {
      if (node === sc) start = offset + range.startOffset;
      if (node === ec) end = offset + range.endOffset;
      offset += node.textContent.length;
    }
    return (start === -1 || end === -1) ? null : { start, end };
  }
  static getBatchGlobalOffsets(ranges) {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let offset = 0, node;
    const resultMap = new Map(), nodeMap = new Map();
    ranges.forEach(({ id, range }) => {
      if (!range) return;
      const { startContainer: sc, endContainer: ec } = range;
      if (!nodeMap.has(sc)) nodeMap.set(sc, []);
      nodeMap.get(sc).push({ id, type: "start", localOffset: range.startOffset });
      if (!nodeMap.has(ec)) nodeMap.set(ec, []);
      nodeMap.get(ec).push({ id, type: "end", localOffset: range.endOffset });
    });
    while ((node = w.nextNode())) {
      if (nodeMap.has(node)) {
        nodeMap.get(node).forEach(({ id, type, localOffset }) => {
          if (!resultMap.has(id)) resultMap.set(id, {});
          resultMap.get(id)[type] = offset + localOffset;
        });
      }
      offset += node.textContent.length;
    }
    for (const [id, res] of resultMap) {
      if (res.start === undefined || res.end === undefined) resultMap.delete(id);
    }
    return resultMap;
  }
  static getRangeFromOffsets(start, end) {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let offset = 0, node, rsNode, rsOffset, reNode, reOffset;
    while ((node = w.nextNode())) {
      const len = node.textContent.length;
      if (rsNode === undefined && start >= offset && start < offset + len) {
        rsNode = node; rsOffset = start - offset;
      }
      if (end > offset && end <= offset + len) {
        reNode = node; reOffset = end - offset; break;
      }
      offset += len;
    }
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
  static getDocumentText() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text = "", node;
    while ((node = w.nextNode())) text += node.textContent;
    return text;
  }
  static findFallbackRange(targetText, fullDOMText, expectedStart, expectedDocLength, expectedNodeOffset) {
    if (!targetText || !fullDOMText) return null;
    const indices = [];
    let idx = fullDOMText.indexOf(targetText);
    while (idx !== -1) { indices.push(idx); idx = fullDOMText.indexOf(targetText, idx + 1); }
    if (indices.length === 0) return null;
    if (indices.length === 1) return DOMUtils.getRangeFromOffsets(indices[0], indices[0] + targetText.length);
    const candidates = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let offset = 0, node, ptr = 0;
    while ((node = w.nextNode())) {
      const len = node.textContent.length, nodeEnd = offset + len;
      while (ptr < indices.length) {
        const startGlobal = indices[ptr];
        if (startGlobal >= nodeEnd) break;
        candidates.push({ index: startGlobal, nodeOffset: startGlobal - offset });
        ptr++;
      }
      offset += len;
      if (ptr >= indices.length) break;
    }
    const currentDocLength = fullDOMText.length;
    let projectedStart = -1;
    if (expectedStart !== undefined && expectedDocLength) projectedStart = (expectedStart / expectedDocLength) * currentDocLength;
    candidates.forEach((c) => {
      c.score = (expectedNodeOffset !== undefined && c.nodeOffset === expectedNodeOffset) ? 1000 : 0;
      c.drift = projectedStart !== -1 ? Math.abs(c.index - projectedStart) : Infinity;
    });
    candidates.sort((a, b) => (a.score !== b.score ? b.score - a.score : a.drift - b.drift));
    const best = candidates[0];
    if (best.score < 1000 && projectedStart !== -1 && best.drift > currentDocLength * 0.2) return null;
    return DOMUtils.getRangeFromOffsets(best.index, best.index + targetText.length);
  }
  static stripHighlights() {
      document.querySelectorAll(".marklet-highlight, .marklet-flex-wrapper").forEach((el) => {
        const p = el.parentNode;
        if (p) { while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
      });
    document.body.normalize();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { DOMUtils };
}
