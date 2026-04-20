class Whiteboard {
  constructor(app) {
    const drawingDefaults = SharedUtils.getDefaultDrawingSettings();
    this.app = app; this.active = false; this.canvas = null; this.svg = null; this.strokes = []; this.history = []; this.color = SharedUtils.getDefaultDrawColor(); this.lineWidth = 5; this.mode = "draw"; this.blendMode = drawingDefaults.blendMode; this.opacity = drawingDefaults.opacity; this.localPage = SharedUtils.normalizePageData({ drawings: [] }, SharedUtils.normalizeUrl(window.location.href)); this.init();
  }
  init() {
    this.loadStrokes();
    this.resizeListener = () => { this.handleResize(); this.repositionTextInput(); };
    this.scrollListener = () => {
      if (!this.active || this.scrollFrame) return;
      this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = 0;
        if (this.active) {
            this.redraw();
            this.repositionTextInput();
        }
      });
    };
    window.addEventListener("resize", this.resizeListener); window.addEventListener("scroll", this.scrollListener, { passive: true });
    this.storageListener = (c) => {
        if (c.drawingBlendMode && SharedUtils.isValidExtension()) {
          this.blendMode = SharedUtils.sanitizeStoredSettings({ drawingBlendMode: c.drawingBlendMode.newValue }).drawingBlendMode;
          if (this.canvas) this.canvas.style.mixBlendMode = this.blendMode;
          if (this.svg) this.svg.style.mixBlendMode = this.blendMode;
        }
        if (c.drawingOpacity && SharedUtils.isValidExtension()) {
          this.opacity = SharedUtils.sanitizeStoredSettings({ drawingOpacity: c.drawingOpacity.newValue }).drawingOpacity;
          if (this.canvas) this.canvas.style.opacity = this.opacity / 100;
          if (this.svg) this.svg.style.opacity = this.opacity / 100;
        }
    };
    chrome.storage.onChanged.addListener(this.storageListener); this.loadDefaultColor(); this.loadBlendMode(); this.loadOpacity(); this.loadLastTool();
  }
  destroy() {
      window.removeEventListener("resize", this.resizeListener); window.removeEventListener("scroll", this.scrollListener); chrome.storage.onChanged.removeListener(this.storageListener);
      if (this.focusTimer) cancelAnimationFrame(this.focusTimer); if (this.scrollFrame) cancelAnimationFrame(this.scrollFrame); this.scrollFrame = 0; this.toggle(false); if (this.svg) { this.svg.remove(); this.svg = null; }
  }
  async loadLastTool() { if (SharedUtils.isValidExtension()) { const d = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get(["lastWhiteboardTool"])); this.mode = d.lastWhiteboardTool; if (this.active && this.app.ui) this.app.ui.setTool(this.mode); } }
  async loadDefaultColor() { if (SharedUtils.isValidExtension()) { const d = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get(["defaultDrawColor"])); this.color = d.defaultDrawColor; } }
  async loadBlendMode() {
    if (!SharedUtils.isValidExtension()) return;
    const d = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get(["drawingBlendMode"]));
    this.blendMode = d.drawingBlendMode;
    if (this.canvas) this.canvas.style.mixBlendMode = this.blendMode; if (this.svg) this.svg.style.mixBlendMode = this.blendMode;
    if (this.app.ui) this.app.ui.updateDockBlendText(this.blendMode);
  }
  async setBlendMode(m) {
    this.blendMode = m; if (this.canvas) this.canvas.style.mixBlendMode = m; if (this.svg) this.svg.style.mixBlendMode = m;
    if (SharedUtils.isValidExtension()) await chrome.storage.local.set({ drawingBlendMode: m });
  }
  async loadOpacity() { if (SharedUtils.isValidExtension()) { const d = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get(["drawingOpacity"])); this.opacity = d.drawingOpacity; if (this.canvas) this.canvas.style.opacity = this.opacity / 100; if (this.svg) this.svg.style.opacity = this.opacity / 100; } }
  setupCanvas() {
    if (this.canvas) return; if (this.svg) { this.svg.remove(); this.svg = null; }
    this.canvas = Object.assign(document.createElement("canvas"), { id: "marklet-canvas-main" });
    Object.assign(this.canvas.style, { mixBlendMode: this.blendMode, opacity: this.opacity / 100 });
    this.app.shadow.appendChild(this.canvas); this.ctx = this.canvas.getContext("2d");
    this.canvas.addEventListener("dblclick", (e) => { if (!this.active) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); this.handleDblClick(e); });
    this.handleResize();
    ["mousedown", "mousemove", "mouseup", "mouseleave"].forEach(e => {
        this.canvas.addEventListener(e, (evt) => {
            if (!this.active) return;
            if (e === "mousedown" && this.editStroke) {
                const input = this.app.shadow.querySelector('.marklet-text-input');
                if (input) input.blur();
            }
            evt.preventDefault(); evt.stopPropagation(); evt.stopImmediatePropagation();
            this[e === "mousemove" ? "draw" : e === "mousedown" ? "start" : "end"](evt);
        }, { passive: false });
    });
  }
  setupSVG() {
    if (this.svg) return; if (this.canvas) { this.canvas.remove(); this.canvas = null; this.ctx = null; }
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); this.svg.id = "marklet-svg-view";
    Object.assign(this.svg.style, { mixBlendMode: this.blendMode, opacity: this.opacity / 100 });
    this.app.shadow.appendChild(this.svg); this.updateSVGSize();
  }
  updateSVGSize() {
    if (!this.svg || this.strokes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.strokes.forEach(s => {
      const b = this.getBounds(s);
      const p = (s.type === 'text' ? 0 : (s.width || 0) / 2) + 10;
      minX = Math.min(minX, b.minX - p); minY = Math.min(minY, b.minY - p);
      maxX = Math.max(maxX, b.maxX + p); maxY = Math.max(maxY, b.maxY + p);
    });
    const w = maxX - minX, h = maxY - minY;
    Object.assign(this.svg.style, { left: `${minX}px`, top: `${minY}px`, width: `${w}px`, height: `${h}px` });
    this.svg.setAttribute("width", w); this.svg.setAttribute("height", h);
    this.svg.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
  }

  renderSVG() {
    if (this.strokes.length === 0) { if (this.svg) { this.svg.remove(); this.svg = null; } return; }
    if (!this.svg) this.setupSVG(); this.svg.innerHTML = ""; this.updateSVGSize();
    this.strokes.forEach(s => { const el = this.createSVGElement(s); if (el) this.svg.appendChild(el); });
  }
  createSVGElement(s) {
    let el; const b = this.getBounds(s);
    if (s.type === "text") {
        el = document.createElementNS("http://www.w3.org/2000/svg", "text");
        Object.assign(el.style, { fill: s.color, fontFamily: CONSTANTS.FONT_STACK, fontSize: `${s.size}px`, fontWeight: "500", dominantBaseline: "hanging", textRendering: "optimizeLegibility", webkitFontSmoothing: "antialiased", mozOsxFontSmoothing: "grayscale" });
        const lines = s.text.split('\n');
        lines.forEach((line, i) => {
            const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            tspan.setAttribute("x", s.x);
            tspan.setAttribute("y", s.y + i * s.size * 1.2);
            tspan.textContent = line;
            el.appendChild(tspan);
        });
    } else {
        el = document.createElementNS("http://www.w3.org/2000/svg", "path");
        el.setAttribute("stroke", s.color); el.setAttribute("stroke-width", s.width); el.setAttribute("fill", "none"); el.setAttribute("stroke-linecap", "round"); el.setAttribute("stroke-linejoin", "round");
        let d = "";
        if (s.type === "draw") d = `M ${s.points[0].x} ${s.points[0].y} ` + s.points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
        else if (s.type === "rect" && s.points[1]) { const x = Math.min(s.points[0].x, s.points[1].x), y = Math.min(s.points[0].y, s.points[1].y), w = Math.abs(s.points[1].x - s.points[0].x), h = Math.abs(s.points[1].y - s.points[0].y); d = `M ${x} ${y} h ${w} v ${h} h ${-w} z`; }
        else if (s.type === "circle" && s.points[1]) { const r = Math.hypot(s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y); d = `M ${s.points[0].x - r} ${s.points[0].y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`; }
        else if (s.type === "arrow" && s.points[1]) { const p1 = s.points[0], p2 = s.points[1], hl = 15, a = Math.atan2(p2.y - p1.y, p2.x - p1.x), h1x = p2.x - hl * Math.cos(a - Math.PI / 6), h1y = p2.y - hl * Math.sin(a - Math.PI / 6), h2x = p2.x - hl * Math.cos(a + Math.PI / 6), h2y = p2.y - hl * Math.sin(a + Math.PI / 6); d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} M ${p2.x} ${p2.y} L ${h1x} ${h1y} M ${p2.x} ${p2.y} L ${h2x} ${h2y}`; }
        el.setAttribute("d", d);
    }
    if (s.rotation) el.setAttribute("transform", `rotate(${(s.rotation * 180) / Math.PI}, ${b.cx}, ${b.cy})`); return el;
  }
  handleResize() {
    if (this.canvas) {
        const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
        if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) { this.canvas.width = w * dpr; this.canvas.height = h * dpr; this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.scale(dpr, dpr); this.redraw(); }
    }
    if (this.svg) this.updateSVGSize();
  }
  repositionTextInput() {
    const input = this.app.shadow.querySelector('.marklet-text-input');
    if (input && this.editStroke) {
      const rect = document.documentElement.getBoundingClientRect();
      input.style.left = `${this.editStroke.x + rect.left}px`;
      input.style.top = `${this.editStroke.y + rect.top}px`;
    }
  }
  toggle(a) {
    if (!a && this.active) {
        const input = this.app.shadow.querySelector('.marklet-text-input');
        if (input) input.blur();
    }
    this.active = a;
    if (a) { if (this.svg) { this.svg.remove(); this.svg = null; } this.setupCanvas(); if (this.canvas) this.canvas.style.pointerEvents = "all"; this.updateCursor(); this.redraw(); }
    else { if (this.canvas) { this.canvas.remove(); this.canvas = null; this.ctx = null; } if (this.strokes.length > 0) this.renderSVG(); else if (this.svg) { this.svg.remove(); this.svg = null; } this.selectedStroke = null; if (this.app.ui) this.app.ui.hideDrawingToolbar(); }
  }
  setMode(m) { this.mode = m; this.selectedStroke = null; this.hoveredStroke = null; this.interactionState = null; this.updateCursor(); this.redraw(); this.app.ui.updateDockPreview(); if (SharedUtils.isValidExtension()) chrome.storage.local.set({ lastWhiteboardTool: m }); }
  setThickness(v) {
    this.lineWidth = v;
    if (this.selectedStroke) {
        if (this.selectedStroke.type === "text") { this.selectedStroke.size = v * 3 + 10; this.ctx.font = `500 ${this.selectedStroke.size}px ${CONSTANTS.FONT_STACK}`; const m = this.ctx.measureText(this.selectedStroke.text); this.selectedStroke.width = m.width; this.selectedStroke.height = this.selectedStroke.size * 1.2; } else this.selectedStroke.width = v;
        this.redraw(); this.saveStrokes();
    }
    this.app.ui.updateDockPreview();
  }
  setColor(c) { this.color = c; if (this.selectedStroke) { this.selectedStroke.color = c; this.redraw(); this.saveStrokes(); } this.app.ui.updateDockPreview(); }
  updateCursor() { if (this.canvas) this.canvas.style.cursor = this.mode === "select" ? "default" : this.mode === "text" ? "text" : "crosshair"; }
  getBounds(s) {
    if (s.type === "circle" && s.points.length >= 2) { const cx = s.points[0].x, cy = s.points[0].y, r = Math.hypot(s.points[1].x - cx, s.points[1].y - cy); return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r, cx, cy, width: 2 * r, height: 2 * r }; }
    if (s.type === "text") return { minX: s.x, minY: s.y, maxX: s.x + s.width, maxY: s.y + s.height, cx: s.x + s.width / 2, cy: s.y + s.height / 2, width: s.width, height: s.height };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; s.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    return minX === Infinity ? { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0, width: 0, height: 0 } : { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
  }
  rotatePoint(x, y, cx, cy, angle) { const cos = Math.cos(angle), sin = Math.sin(angle); return { x: cos * (x - cx) - sin * (y - cy) + cx, y: sin * (x - cx) + cos * (y - cy) + cy }; }
  getSelectionPadding(s) { return CONSTANTS.SELECTION_PADDING + (s.type === 'text' ? 0 : (s.width || 0) / 2); }
  getResizeHandles(b, p) { return { nw: { x: b.minX - p, y: b.minY - p }, n: { x: b.cx, y: b.minY - p }, ne: { x: b.maxX + p, y: b.minY - p }, e: { x: b.maxX + p, y: b.cy }, se: { x: b.maxX + p, y: b.maxY + p }, s: { x: b.cx, y: b.maxY + p }, sw: { x: b.minX - p, y: b.maxY + p }, w: { x: b.minX - p, y: b.cy } }; }
  hitTestHandles(x, y, s) {
    if (!s) return null; const b = this.getBounds(s), p = this.getSelectionPadding(s), local = this.rotatePoint(x, y, b.cx, b.cy, -(s.rotation || 0));
    if (Math.hypot(local.x - b.cx, local.y - (b.minY - p - CONSTANTS.ROTATE_HANDLE_OFFSET)) <= CONSTANTS.HIT_TEST_TOLERANCE) return "rotate";
    for (const [key, pt] of Object.entries(this.getResizeHandles(b, p))) if (Math.hypot(local.x - pt.x, local.y - pt.y) <= CONSTANTS.HIT_TEST_TOLERANCE) return key;
    return null;
  }
  hitTest(x, y) {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const s = this.strokes[i], b = this.getBounds(s), local = this.rotatePoint(x, y, b.cx, b.cy, -(s.rotation || 0)), tol = Math.max(CONSTANTS.HIT_TEST_TOLERANCE, (s.width || 0) / 2 + 5);
      let hit = false;
      if (s.type === "rect" && s.points[1]) { const lx = Math.min(s.points[0].x, s.points[1].x), rx = Math.max(s.points[0].x, s.points[1].x), ty = Math.min(s.points[0].y, s.points[1].y), by = Math.max(s.points[0].y, s.points[1].y); hit = local.x >= lx - tol && local.x <= rx + tol && local.y >= ty - tol && local.y <= by + tol && !(local.x >= lx + tol && local.x <= rx - tol && local.y >= ty + tol && local.y <= by - tol); }
      else if (s.type === "circle" && s.points[1]) { const r = Math.hypot(s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y), d = Math.hypot(local.x - s.points[0].x, local.y - s.points[0].y); hit = Math.abs(d - r) <= tol; }
      else if (s.type === "text") { const b = this.getBounds(s), pad = CONSTANTS.HIT_TEST_TOLERANCE; hit = local.x >= b.minX - pad && local.x <= b.maxX + pad && local.y >= b.minY - pad && local.y <= b.maxY + pad; }
      else { hit = s.points.some((p2, idx) => { if (idx === 0) return false; const p1 = s.points[idx - 1], A = local.x - p1.x, B = local.y - p1.y, C = p2.x - p1.x, D = p2.y - p1.y, dot = A * C + B * D, lenSq = C * C + D * D; let param = lenSq !== 0 ? dot / lenSq : -1; const xx = param < 0 ? p1.x : param > 1 ? p2.x : p1.x + param * C, yy = param < 0 ? p1.y : param > 1 ? p2.y : p1.y + param * D; return Math.hypot(local.x - xx, local.y - yy) < tol; }); }
      if (hit) return s;
    }
    return null;
  }
  getMousePos(e) {
    const rect = document.documentElement.getBoundingClientRect();
    if (e.clientX !== undefined) return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    return { x: e.pageX || 0, y: e.pageY || 0 };
  }
  getShiftLockedPoint(start, point) {
    if (!start) return point;
    if (!this.shiftLockDir) this.shiftLockDir = Math.abs(point.x - start.x) >= Math.abs(point.y - start.y) ? "h" : "v";
    return this.shiftLockDir === "h"
      ? { x: point.x, y: start.y }
      : { x: start.x, y: point.y };
  }
  handleDblClick(e) { if (this.mode === 'select' || this.mode === 'text') { const p = this.getMousePos(e), hit = this.hitTest(p.x, p.y); if (hit && hit.type === 'text') this.enterTextEditMode(hit); } }
  start(e) {
    if (!this.active) return; const p = this.getMousePos(e);
    this.shiftLockDir = null;
    if (this.mode === "select") {
      if (this.selectedStroke) { const h = this.hitTestHandles(p.x, p.y, this.selectedStroke); if (h) { this.app.ui.hideDrawingToolbar(); this.interactionState = { type: h === "rotate" ? "rotate" : "resize", handle: h, start: p, initialBounds: this.getBounds(this.selectedStroke), initialRotation: this.selectedStroke.rotation || 0, initialPoints: this.selectedStroke.points ? JSON.parse(JSON.stringify(this.selectedStroke.points)) : null, initialStroke: this.selectedStroke.type === 'text' ? {...this.selectedStroke} : null }; return; } }
      const hit = this.hitTest(p.x, p.y); if (hit) { this.selectedStroke = hit; this.strokes = this.strokes.filter(s => s !== hit); this.strokes.push(hit); this.interactionState = { type: "move", start: p }; this.app.ui.syncWithSelection(hit); this.app.ui.hideDrawingToolbar(); }
      else { this.selectedStroke = null; this.app.ui.updateDockPreview(); this.app.ui.hideDrawingToolbar(); }
      this.redraw(); return;
    }
    if (this.mode === "text") {
        const size = this.lineWidth * 3 + 10; this.ctx.font = `500 ${size}px ${CONSTANTS.FONT_STACK}`; const text = "Text", m = this.ctx.measureText(text);
        const newStroke = { type: "text", text, x: p.x, y: p.y, color: this.color, size, width: m.width, height: size * 1.2, rotation: 0, timestamp: Date.now() };
        this.strokes.push(newStroke); this.selectedStroke = newStroke; this.mode = "select"; this.app.ui.setTool("select"); this.saveStrokes(); this.redraw(); this.enterTextEditMode(newStroke); return;
    }
    if (this.mode === "erase") { this.interactionState = { type: "erase" }; this.tryErase(p.x, p.y); return; }
    this.isDrawing = true; this.currentStroke = { type: this.mode, color: this.color, width: this.lineWidth, points: [p], rotation: 0, timestamp: Date.now() };
  }
  enterTextEditMode(s) {
      if (!s || s.type !== "text") return;
      this.editStroke = s; this.selectedStroke = null; this.strokes = this.strokes.filter(st => st !== s); this.redraw();
      const input = document.createElement("textarea"); input.className = "marklet-text-input"; input.value = s.text;
      const rect = document.documentElement.getBoundingClientRect();
      Object.assign(input.style, {
          left: `${s.x + rect.left}px`, top: `${s.y + rect.top}px`,
          width: `${s.width + 5}px`, height: `${s.height + 5}px`,
          color: s.color, fontSize: `${s.size}px`, lineHeight: "1.2",
          fontFamily: CONSTANTS.FONT_STACK, fontWeight: "500",
          textAlign: "left", wordBreak: "break-all",
          webkitFontSmoothing: "antialiased", mozOsxFontSmoothing: "grayscale",
          position: "fixed", verticalAlign: "top"
      });
      this.app.shadow.appendChild(input);
      if (this.focusTimer) cancelAnimationFrame(this.focusTimer);
      this.focusTimer = requestAnimationFrame(() => { input.focus(); input.select(); });
      const stop = (e) => { e.stopPropagation(); e.stopImmediatePropagation(); };
      input.addEventListener("mousedown", stop);
      input.addEventListener("keydown", (e) => {
          e.stopPropagation(); e.stopImmediatePropagation();
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); this.strokes.push(s); input.remove(); this.editStroke = null; this.redraw(); }
      });
      const updateSize = () => {
          this.ctx.font = `500 ${s.size}px ${CONSTANTS.FONT_STACK}`; const lines = input.value.split('\n'), maxWidth = lines.reduce((max, line) => Math.max(max, this.ctx.measureText(line).width), 0);
          input.style.width = `${Math.max(maxWidth + 5, 20)}px`; input.style.height = `${Math.max(lines.length * s.size * 1.2 + 5, s.size * 1.2 + 5)}px`;
      };
      input.addEventListener("input", updateSize);
      input.addEventListener("blur", () => {
          if (input.value.trim()) {
              s.text = input.value; this.ctx.font = `500 ${s.size}px ${CONSTANTS.FONT_STACK}`; const lines = s.text.split('\n'), maxWidth = lines.reduce((max, line) => Math.max(max, this.ctx.measureText(line).width), 0);
              s.width = maxWidth; s.height = lines.length * s.size * 1.2;
              this.strokes.push(s); this.selectedStroke = s; this.saveStrokes();
          } else if (s.text.trim()) { this.strokes.push(s); }
          input.remove(); this.editStroke = null; this.redraw();
          if (this.selectedStroke) this.app.ui.showDrawingToolbar(this.selectedStroke);
      });
      updateSize();
  }
  draw(e) {
    const p = this.getMousePos(e);
    if (this.mode === "select" && !this.interactionState) {
      if (this.selectedStroke && this.hitTestHandles(p.x, p.y, this.selectedStroke)) { this.canvas.style.cursor = "pointer"; this.hoveredStroke = null; return; }
      const h = this.hitTest(p.x, p.y); if (h !== this.hoveredStroke) { this.hoveredStroke = h; this.redraw(); } this.canvas.style.cursor = h ? "move" : "default"; return;
    }
    if (this.interactionState) {
      const s = this.interactionState;
      if (s.type === "move" && this.selectedStroke) {
        const dx = p.x - s.start.x, dy = p.y - s.start.y;
        if (this.selectedStroke.type === 'text') { this.selectedStroke.x += dx; this.selectedStroke.y += dy; } else this.selectedStroke.points.forEach(pt => { pt.x += dx; pt.y += dy; });
        s.start = p; this.redraw();
      } else if (s.type === "rotate" && this.selectedStroke) {
        const b = s.initialBounds, startA = Math.atan2(s.start.y - b.cy, s.start.x - b.cx), curA = Math.atan2(p.y - b.cy, p.x - b.cx);
        let newRot = s.initialRotation + (curA - startA); if (e.shiftKey) newRot = Math.round(newRot / (Math.PI / 12)) * (Math.PI / 12);
        this.selectedStroke.rotation = newRot; this.redraw();
      } else if (s.type === "resize" && this.selectedStroke) {
        const b = s.initialBounds, ang = s.initialRotation, c = { x: b.cx, y: b.cy }, lM = this.rotatePoint(p.x, p.y, c.x, c.y, -ang);
        let anchor = { x: 0, y: 0 }; if (s.handle.includes('n')) anchor.y = b.maxY; else if (s.handle.includes('s')) anchor.y = b.minY; else anchor.y = b.cy; if (s.handle.includes('w')) anchor.x = b.maxX; else if (s.handle.includes('e')) anchor.x = b.minX; else anchor.x = b.cx;
        const anchorWorld = this.rotatePoint(anchor.x, anchor.y, c.x, c.y, ang);
        let nMinX = b.minX, nMaxX = b.maxX, nMinY = b.minY, nMaxY = b.maxY; if (s.handle.includes('w')) nMinX = Math.min(lM.x, b.maxX - 10); if (s.handle.includes('e')) nMaxX = Math.max(lM.x, b.minX + 10); if (s.handle.includes('n')) nMinY = Math.min(lM.y, b.maxY - 10); if (s.handle.includes('s')) nMaxY = Math.max(lM.y, b.minY + 10);
        if (e.shiftKey && (s.handle.length === 2)) { const aspect = (b.width || 1) / (b.height || 1), w = nMaxX - nMinX, h = nMaxY - nMinY; if (w / h > aspect) { if (s.handle.includes('w')) nMinX = nMaxX - h * aspect; else nMaxX = nMinX + h * aspect; } else { if (s.handle.includes('n')) nMinY = nMaxY - w / aspect; else nMaxY = nMinY + w / aspect; } }
        const sX = (nMaxX - nMinX) / (b.width || 1), sY = (nMaxY - nMinY) / (b.height || 1);
        if (this.selectedStroke.type === 'text') {
            let scale = 1; if (s.handle.length === 1) scale = ['e', 'w'].includes(s.handle) ? sX : sY; else scale = Math.abs(sX - 1) > Math.abs(sY - 1) ? sX : sY; if (scale < 0.1) scale = 0.1;
            this.selectedStroke.size = s.initialStroke.size * scale; this.ctx.font = `${this.selectedStroke.size}px ${CONSTANTS.FONT_STACK}`; const lines = this.selectedStroke.text.split('\n'), maxWidth = lines.reduce((max, line) => Math.max(max, this.ctx.measureText(line).width), 0);
            this.selectedStroke.width = maxWidth; this.selectedStroke.height = lines.length * this.selectedStroke.size * 1.2;
            const nW = nMaxX - nMinX, nH = nMaxY - nMinY, nCx = nMinX + nW / 2, nCy = nMinY + nH / 2, rAnch = this.rotatePoint(anchor.x, anchor.y, nCx, nCy, ang), currAnch = { x: rAnch.x, y: rAnch.y }, diff = { x: anchorWorld.x - currAnch.x, y: anchorWorld.y - currAnch.y };
            let T = { x: 0, y: 0 }; if (Math.abs(ang) < 0.001) T = diff; else { const cosA = Math.cos(ang), sinA = Math.sin(ang), det = 2 - 2 * cosA; T.x = ((1 - cosA) * diff.x - (-sinA) * diff.y) / det; T.y = (sinA * diff.x + (1 - cosA) * diff.y) / det; }
            const finalCx = nCx + T.x, finalCy = nCy + T.y; this.selectedStroke.x = finalCx - this.selectedStroke.width / 2; this.selectedStroke.y = finalCy - this.selectedStroke.height / 2;
        } else {
            const newPointsRaw = s.initialPoints.map(pt => { const l = this.rotatePoint(pt.x, pt.y, c.x, c.y, -ang), nx = nMinX + (l.x - b.minX) * sX, ny = nMinY + (l.y - b.minY) * sY; return { x: nx, y: ny }; });
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity; newPointsRaw.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
            const nCx = (minX + maxX) / 2, nCy = (minY + maxY) / 2, nAnchorX = nMinX + (anchor.x - b.minX) * sX, nAnchorY = nMinY + (anchor.y - b.minY) * sY, rAnch2 = this.rotatePoint(nAnchorX, nAnchorY, nCx, nCy, ang), diff = { x: anchorWorld.x - rAnch2.x, y: anchorWorld.y - rAnch2.y };
            let T = { x: 0, y: 0 }; if (Math.abs(ang) < 0.001) T = diff; else { const cosA = Math.cos(ang), sinA = Math.sin(ang), det = 2 - 2 * cosA; T.x = ((1 - cosA) * diff.x - (-sinA) * diff.y) / det; T.y = (sinA * diff.x + (1 - cosA) * diff.y) / det; }
            this.selectedStroke.points = newPointsRaw.map(pt => { const r = this.rotatePoint(pt.x, pt.y, nCx, nCy, ang); return { x: r.x + T.x, y: r.y + T.y }; });
        }
        this.redraw();
      } else if (s.type === "erase") this.tryErase(p.x, p.y); return;
    }
    if (this.isDrawing) {
      if (this.mode === "draw") {
        const start = this.currentStroke.points[0];
        if (e.shiftKey && start) {
          this.currentStroke.points = [start, this.getShiftLockedPoint(start, p)];
        } else {
          this.shiftLockDir = null;
          this.currentStroke.points.push(p);
        }
      } else {
        this.currentStroke.points[1] = p;
      }
      this.redraw();
    }
  }
  end() {
    this.shiftLockDir = null;
    if (this.interactionState) { if (["move", "rotate", "resize"].includes(this.interactionState.type)) this.saveStrokes(); this.interactionState = null; if (this.selectedStroke && this.mode === "select") this.app.ui.showDrawingToolbar(this.selectedStroke); }
    if (this.isDrawing) {
      this.isDrawing = false;
      const s = this.currentStroke;
      let valid = false;
      if (s.type === "draw") {
        valid = s.points.length > 1 && s.points.some(p => p.x !== s.points[0].x || p.y !== s.points[0].y);
      } else if (s.points[1]) {
        valid = s.points[0].x !== s.points[1].x || s.points[0].y !== s.points[1].y;
      }
      if (valid) {
        this.strokes.push(s); this.history = []; this.saveStrokes();
      }
      this.redraw();
    }
  }
  tryErase(x, y) {
    const s = this.hitTest(x, y);
    if (s) { 
        this.strokes = this.strokes.filter(x => x !== s); if (this.selectedStroke === s) { this.selectedStroke = null; this.app.ui.hideDrawingToolbar(); } 
        if (this.strokes.length === 0) { if (this.canvas) { this.canvas.remove(); this.canvas = null; this.ctx = null; } if (this.svg) { this.svg.remove(); this.svg = null; } }
        else if (this.active) this.redraw(); else this.renderSVG();
        this.saveStrokes(); 
    }
  }
  redraw() {
    if (!this.ctx) return;
    const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
    const rect = document.documentElement.getBoundingClientRect();
    this.ctx.clearRect(0, 0, w, h); this.ctx.save(); this.ctx.translate(rect.left, rect.top);
    this.strokes.forEach(s => { const b = this.getBounds(s), pad = this.getSelectionPadding(s) + 50; if (b.maxX < -rect.left - pad || b.minX > -rect.left + w + pad || b.maxY < -rect.top - pad || b.minY > -rect.top + h + pad) return; this.drawStroke(s); });
    if (this.isDrawing && this.currentStroke) this.drawStroke(this.currentStroke);
    if (this.mode === "select") {
      if (this.selectedStroke) this.drawSelectionOverlay(this.selectedStroke);
      if (this.hoveredStroke && this.hoveredStroke !== this.selectedStroke) { this.ctx.save(); this.ctx.beginPath(); this.ctx.strokeStyle = "rgba(0, 123, 255, 0.5)"; this.ctx.lineWidth = 2; this.ctx.shadowColor = "rgba(0, 123, 255, 0.5)"; this.ctx.shadowBlur = 10; this.drawStrokePath(this.hoveredStroke); this.ctx.stroke(); this.ctx.restore(); }
    }
    this.ctx.restore();
  }
  drawStroke(s) {
    this.ctx.save(); const b = this.getBounds(s); if (s.rotation) { this.ctx.translate(b.cx, b.cy); this.ctx.rotate(s.rotation); this.ctx.translate(-b.cx, -b.cy); }
    if (s.type === "text") { this.ctx.font = `500 ${s.size}px ${CONSTANTS.FONT_STACK}`; this.ctx.fillStyle = s.color; this.ctx.textBaseline = "top"; const lines = s.text.split('\n'); lines.forEach((line, i) => { this.ctx.fillText(line, s.x, s.y + i * s.size * 1.2); }); }
    else { this.ctx.beginPath(); this.ctx.strokeStyle = s.color; this.ctx.lineWidth = s.width; this.ctx.lineCap = "round"; this.ctx.lineJoin = "round"; this.drawStrokePath(s); this.ctx.stroke(); }
    this.ctx.restore();
  }
  drawStrokePath(s) {
    if (s.type === "draw") { this.ctx.moveTo(s.points[0].x, s.points[0].y); for (let i = 1; i < s.points.length; i++) this.ctx.lineTo(s.points[i].x, s.points[i].y); }
    else if (s.type === "rect" && s.points[1]) this.ctx.rect(s.points[0].x, s.points[0].y, s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y);
    else if (s.type === "circle" && s.points[1]) { const r = Math.hypot(s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y); this.ctx.arc(s.points[0].x, s.points[0].y, r, 0, 2 * Math.PI); }
    else if (s.type === "arrow" && s.points[1]) this.drawArrow(s.points[0], s.points[1]);
  }
  drawSelectionOverlay(s) {
    this.ctx.save(); const b = this.getBounds(s); if (s.rotation) { this.ctx.translate(b.cx, b.cy); this.ctx.rotate(s.rotation); this.ctx.translate(-b.cx, -b.cy); }
    const p = this.getSelectionPadding(s); this.ctx.strokeStyle = "#007bff"; this.ctx.lineWidth = 1; this.ctx.setLineDash([5, 5]); this.ctx.strokeRect(b.minX - p, b.minY - p, b.width + p * 2, b.height + p * 2);
    this.ctx.beginPath(); this.ctx.moveTo(b.cx, b.minY - p); this.ctx.lineTo(b.cx, b.minY - p - CONSTANTS.ROTATE_HANDLE_OFFSET); this.ctx.stroke(); this.ctx.setLineDash([]); this.ctx.fillStyle = "#fff"; this.ctx.strokeStyle = "#007bff";
    this.ctx.beginPath(); this.ctx.arc(b.cx, b.minY - p - CONSTANTS.ROTATE_HANDLE_OFFSET, CONSTANTS.HANDLE_RADIUS, 0, 2 * Math.PI); this.ctx.fill(); this.ctx.stroke();
    Object.values(this.getResizeHandles(b, p)).forEach(h => { this.ctx.beginPath(); this.ctx.rect(h.x - CONSTANTS.RESIZE_HANDLE_SIZE/2, h.y - CONSTANTS.RESIZE_HANDLE_SIZE/2, CONSTANTS.RESIZE_HANDLE_SIZE, CONSTANTS.RESIZE_HANDLE_SIZE); this.ctx.fill(); this.ctx.stroke(); });
    this.ctx.restore();
  }
  drawArrow(p1, p2) { const hl = 15, a = Math.atan2(p2.y - p1.y, p2.x - p1.x); this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y); this.ctx.lineTo(p2.x - hl * Math.cos(a - Math.PI / 6), p2.y - hl * Math.sin(a - Math.PI / 6)); this.ctx.moveTo(p2.x, p2.y); this.ctx.lineTo(p2.x - hl * Math.cos(a + Math.PI / 6), p2.y - hl * Math.sin(a + Math.PI / 6)); }
  undo() { if (this.strokes.length) { this.history.push(this.strokes.pop()); this.selectedStroke = null; this.redraw(); this.saveStrokes(); if (this.app.ui) this.app.ui.hideDrawingToolbar(); } }
  redo() { if (this.history.length) { this.strokes.push(this.history.pop()); this.redraw(); this.saveStrokes(); } }
  clear() { 
    this.strokes = []; this.history = []; this.selectedStroke = null; 
    if (this.canvas) { if (!this.active) { this.canvas.remove(); this.canvas = null; this.ctx = null; } else this.redraw(); }
    if (this.svg) { this.svg.remove(); this.svg = null; }
    this.saveStrokes(); if (this.app.ui) this.app.ui.hideDrawingToolbar(); 
  }
  toggleVisibility(v) { if (this.canvas) this.canvas.style.display = v ? "block" : "none"; if (this.svg) this.svg.style.display = v ? "block" : "none"; }
  async saveStrokes() {
    if (!SharedUtils.isValidExtension()) return;
    const url = SharedUtils.normalizeUrl(window.location.href);
    if (this.app.isSavable) {
      if (this.strokes.length === 0) {
        await PageStorage.update(url, 'clear_drawings');
      } else {
        await PageStorage.update(url, 'replace_drawings', this.strokes);
      }
    } else { this.localPage.drawings = this.strokes; this.localPage.lastUpdated = Date.now(); }
  }
  async loadStrokes() {
    if (!SharedUtils.isValidExtension()) return;
    if (this.app.isSavable) {
      const url = SharedUtils.normalizeUrl(window.location.href);
      const page = SharedUtils.normalizePageData(await PageStorage.get(url), url);
      this.strokes = page.drawings;
    } else this.strokes = this.localPage.drawings || [];
    if (this.strokes.length > 0) { if (this.active) { this.setupCanvas(); this.redraw(); } else this.renderSVG(); }
    else { if (this.canvas) { this.canvas.remove(); this.canvas = null; this.ctx = null; } if (this.svg) { this.svg.remove(); this.svg = null; } }
  }
}
if (typeof module !== 'undefined') { module.exports = { Whiteboard }; }
