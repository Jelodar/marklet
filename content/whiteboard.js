class Whiteboard {
  constructor(app) { this.app = app; this.active = false; this.canvas = null; this.strokes = []; this.history = []; this.color = "#FF0000"; this.lineWidth = 5; this.mode = "draw"; this.blendMode = "normal"; this.opacity = 75; this.init(); }
  init() {
    this.loadStrokes();
    this.resizeListener = () => this.handleResize();
    window.addEventListener("resize", this.resizeListener);
    this.storageListener = (c) => {
        if (c.drawingBlendMode && SharedUtils.isValidExtension()) {
            this.blendMode = c.drawingBlendMode.newValue;
            if (this.canvas) this.canvas.style.mixBlendMode = this.blendMode;
        }
        if (c.drawingOpacity && SharedUtils.isValidExtension()) {
            this.opacity = c.drawingOpacity.newValue;
            if (this.canvas) this.canvas.style.opacity = this.opacity / 100;
        }
    };
    chrome.storage.onChanged.addListener(this.storageListener);
    this.loadDefaultColor();
    this.loadBlendMode();
    this.loadOpacity();
  }
  destroy() {
      window.removeEventListener("resize", this.resizeListener);
      chrome.storage.onChanged.removeListener(this.storageListener);
      if (this.focusTimer) cancelAnimationFrame(this.focusTimer);
      this.toggle(false);
  }
  async loadDefaultColor() { if (SharedUtils.isValidExtension()) { const d = await chrome.storage.local.get(["defaultDrawColor"]); if (d.defaultDrawColor) this.color = d.defaultDrawColor; } }
  async loadBlendMode() { if (SharedUtils.isValidExtension()) { const d = await chrome.storage.local.get(["drawingBlendMode"]); if (d.drawingBlendMode) { this.blendMode = d.drawingBlendMode; if (this.canvas) this.canvas.style.mixBlendMode = this.blendMode; } } }
  async loadOpacity() { if (SharedUtils.isValidExtension()) { const d = await chrome.storage.local.get(["drawingOpacity"]); if (d.drawingOpacity !== undefined) { this.opacity = d.drawingOpacity; if (this.canvas) this.canvas.style.opacity = this.opacity / 100; } } }
  setupCanvas() {
    if (this.canvas) return;
    this.canvas = Object.assign(document.createElement("canvas"), { id: "marklet-canvas-main" });
    Object.assign(this.canvas.style, { position: "absolute", top: "0", left: "0", zIndex: "2147483500", mixBlendMode: this.blendMode, opacity: this.opacity / 100 });
    this.canvas.style.setProperty("pointer-events", "none", "important");
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.canvas.addEventListener("dblclick", (e) => this.handleDblClick(e));
    this.handleResize();
    ["mousedown", "mousemove", "mouseup", "mouseleave"].forEach(e => this.canvas.addEventListener(e, (evt) => this[e === "mousemove" ? "draw" : e === "mousedown" ? "start" : "end"](evt)));
  }
  handleResize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, document.documentElement.clientWidth);
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.documentElement.clientHeight);
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + "px";
        this.canvas.style.height = h + "px";
        this.ctx.scale(dpr, dpr);
        this.redraw();
    }
  }
  toggle(a) {
    this.active = a;
    if (a) {
        this.setupCanvas();
        this.canvas.style.pointerEvents = "all";
        this.updateCursor();
    } else {
        if (this.canvas) this.canvas.style.pointerEvents = "none";
        this.selectedStroke = null;
        this.redraw();
        if (this.app.ui) this.app.ui.hideDrawingToolbar();
    }
  }
  setMode(m) { this.mode = m; this.selectedStroke = null; this.hoveredStroke = null; this.interactionState = null; this.updateCursor(); this.redraw(); this.app.ui.updateDockPreview(); }
  setThickness(v) {
    this.lineWidth = v;
    if (this.selectedStroke) {
        if (this.selectedStroke.type === "text") {
            this.selectedStroke.size = v * 3 + 10;
            this.ctx.font = `${this.selectedStroke.size}px sans-serif`;
            const m = this.ctx.measureText(this.selectedStroke.text);
            this.selectedStroke.width = m.width;
            this.selectedStroke.height = this.selectedStroke.size * 1.2;
        } else {
            this.selectedStroke.width = v;
        }
        this.redraw();
        this.saveStrokes();
    }
    this.app.ui.updateDockPreview();
  }
  setColor(c) { this.color = c; if (this.selectedStroke) { this.selectedStroke.color = c; this.redraw(); this.saveStrokes(); } this.app.ui.updateDockPreview(); }
  updateCursor() { if (this.canvas) this.canvas.style.cursor = this.mode === "select" ? "default" : this.mode === "text" ? "text" : "crosshair"; }
  getBounds(s) {
    if (s.type === "circle" && s.points.length >= 2) {
      const cx = s.points[0].x, cy = s.points[0].y, r = Math.hypot(s.points[1].x - cx, s.points[1].y - cy);
      return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r, cx, cy, width: 2 * r, height: 2 * r };
    }
    if (s.type === "text") {
        return { minX: s.x, minY: s.y, maxX: s.x + s.width, maxY: s.y + s.height, cx: s.x + s.width / 2, cy: s.y + s.height / 2, width: s.width, height: s.height };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    s.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    return minX === Infinity ? { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0, width: 0, height: 0 } : { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
  }
  rotatePoint(x, y, cx, cy, angle) { const cos = Math.cos(angle), sin = Math.sin(angle); return { x: cos * (x - cx) - sin * (y - cy) + cx, y: sin * (x - cx) + cos * (y - cy) + cy }; }
  getSelectionPadding(s) { return 10 + (s.type === 'text' ? 0 : (s.width || 0) / 2); }
  getResizeHandles(b, p) { return { nw: { x: b.minX - p, y: b.minY - p }, n: { x: b.cx, y: b.minY - p }, ne: { x: b.maxX + p, y: b.minY - p }, e: { x: b.maxX + p, y: b.cy }, se: { x: b.maxX + p, y: b.maxY + p }, s: { x: b.cx, y: b.maxY + p }, sw: { x: b.minX - p, y: b.maxY + p }, w: { x: b.minX - p, y: b.cy } }; }
  hitTestHandles(x, y, s) {
    if (!s) return null;
    const b = this.getBounds(s), p = this.getSelectionPadding(s), local = this.rotatePoint(x, y, b.cx, b.cy, -(s.rotation || 0));
    if (Math.hypot(local.x - b.cx, local.y - (b.minY - p - 25)) <= 10) return "rotate";
    for (const [key, pt] of Object.entries(this.getResizeHandles(b, p))) if (Math.hypot(local.x - pt.x, local.y - pt.y) <= 10) return key;
    return null;
  }
  hitTest(x, y) {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const s = this.strokes[i], b = this.getBounds(s), local = this.rotatePoint(x, y, b.cx, b.cy, -(s.rotation || 0)), tol = Math.max(10, s.width / 2 + 5);
      let hit = false;
      if (s.type === "rect" && s.points[1]) {
        const lx = Math.min(s.points[0].x, s.points[1].x), rx = Math.max(s.points[0].x, s.points[1].x), ty = Math.min(s.points[0].y, s.points[1].y), by = Math.max(s.points[0].y, s.points[1].y);
        hit = local.x >= lx - tol && local.x <= rx + tol && local.y >= ty - tol && local.y <= by + tol && !(local.x >= lx + tol && local.x <= rx - tol && local.y >= ty + tol && local.y <= by - tol);
      } else if (s.type === "circle" && s.points[1]) {
        const r = Math.hypot(s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y), d = Math.hypot(local.x - s.points[0].x, local.y - s.points[0].y);
        hit = Math.abs(d - r) <= tol;
      } else if (s.type === "text") {
        const b = this.getBounds(s);
        const pad = 10;
        hit = local.x >= b.minX - pad && local.x <= b.maxX + pad && local.y >= b.minY - pad && local.y <= b.maxY + pad;
      } else {
        hit = s.points.some((p2, idx) => {
          if (idx === 0) return false;
          const p1 = s.points[idx - 1], A = local.x - p1.x, B = local.y - p1.y, C = p2.x - p1.x, D = p2.y - p1.y, dot = A * C + B * D, lenSq = C * C + D * D;
          let param = lenSq !== 0 ? dot / lenSq : -1;
          const xx = param < 0 ? p1.x : param > 1 ? p2.x : p1.x + param * C, yy = param < 0 ? p1.y : param > 1 ? p2.y : p1.y + param * D;
          return Math.hypot(local.x - xx, local.y - yy) < tol;
        });
      }
      if (hit) return s;
    }
    return null;
  }
  handleDblClick(e) {
      if (this.mode === 'select' || this.mode === 'text') {
        const hit = this.hitTest(e.pageX, e.pageY);
        if (hit && hit.type === 'text') this.enterTextEditMode(hit);
      }
  }
  start(e) {
    if (!this.active) return;
    const p = { x: e.pageX, y: e.pageY };
    if (this.mode === "select") {
      if (this.selectedStroke) {
        const h = this.hitTestHandles(p.x, p.y, this.selectedStroke);
        if (h) {
          this.app.ui.hideDrawingToolbar();
          this.interactionState = { type: h === "rotate" ? "rotate" : "resize", handle: h, start: p, initialBounds: this.getBounds(this.selectedStroke), initialRotation: this.selectedStroke.rotation || 0, initialPoints: this.selectedStroke.points ? JSON.parse(JSON.stringify(this.selectedStroke.points)) : null, initialStroke: this.selectedStroke.type === 'text' ? {...this.selectedStroke} : null };
          return;
        }
      }
      const hit = this.hitTest(p.x, p.y);
      if (hit) {
          this.selectedStroke = hit;
          this.strokes = this.strokes.filter(s => s !== hit);
          this.strokes.push(hit);
          this.interactionState = { type: "move", start: p };
          this.app.ui.syncWithSelection(hit);
          this.app.ui.hideDrawingToolbar();
      }
      else { this.selectedStroke = null; this.app.ui.updateDockPreview(); this.app.ui.hideDrawingToolbar(); }
      this.redraw(); return;
    }
    if (this.mode === "text") {
        const size = this.lineWidth * 3 + 10;
        this.ctx.font = `${size}px sans-serif`;
        const text = "Text";
        const m = this.ctx.measureText(text);
        const newStroke = {
            type: "text",
            text,
            x: p.x, y: p.y,
            color: this.color,
            size,
            width: m.width,
            height: size * 1.2,
            rotation: 0
        };
        this.strokes.push(newStroke);
        this.selectedStroke = newStroke;
        this.mode = "select";
        this.app.ui.setTool("select");
        this.saveStrokes();
        this.redraw();
        this.enterTextEditMode(newStroke);
        return;
    }
    if (this.mode === "erase") { this.interactionState = { type: "erase" }; this.tryErase(p.x, p.y); return; }
    this.isDrawing = true; this.currentStroke = { type: this.mode, color: this.color, width: this.lineWidth, points: [p], rotation: 0 };
  }
  enterTextEditMode(s) {
      if (!s || s.type !== "text") return;
      this.editStroke = s;
      this.selectedStroke = null;
      this.strokes = this.strokes.filter(st => st !== s);
      this.redraw();
      const input = document.createElement("textarea");
      input.className = "marklet-text-input";
      input.value = s.text;
      Object.assign(input.style, {
          left: `${s.x}px`, top: `${s.y}px`,
          width: `${Math.max(s.width + 20, 100)}px`, height: `${s.height + 10}px`,
          color: s.color, fontSize: `${s.size}px`, lineHeight: "1.2"
      });
      document.body.appendChild(input);
      if (this.focusTimer) cancelAnimationFrame(this.focusTimer);
      this.focusTimer = requestAnimationFrame(() => { input.focus(); input.select(); });
      const stop = (e) => e.stopPropagation();
      input.addEventListener("mousedown", stop);
      input.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') {
              e.preventDefault();
              this.strokes.push(s);
              input.remove();
              this.editStroke = null;
              this.redraw();
          }
      });
      const updateSize = () => {
          this.ctx.font = `${s.size}px sans-serif`;
          const lines = input.value.split('\n');
          const maxWidth = lines.reduce((max, line) => Math.max(max, this.ctx.measureText(line).width), 0);
          input.style.width = `${Math.max(maxWidth + 20, 100)}px`;
          input.style.height = `${Math.max(lines.length * s.size * 1.2 + 10, s.size * 1.2 + 10)}px`;
      };
      input.addEventListener("input", updateSize);
      input.addEventListener("blur", () => {
          if (input.value.trim()) {
              s.text = input.value;
              this.ctx.font = `${s.size}px sans-serif`;
              const lines = s.text.split('\n');
              const maxWidth = lines.reduce((max, line) => Math.max(max, this.ctx.measureText(line).width), 0);
              s.width = maxWidth;
              s.height = lines.length * s.size * 1.2;
              this.strokes.push(s);
              this.selectedStroke = s;
              this.saveStrokes();
          } else {
              this.strokes.push(s);
          }
          input.remove();
          this.editStroke = null;
          this.redraw();
      });
      updateSize();
  }
  draw(e) {
    const p = { x: e.pageX, y: e.pageY };
    if (this.mode === "select" && !this.interactionState) {
      if (this.selectedStroke && this.hitTestHandles(p.x, p.y, this.selectedStroke)) { this.canvas.style.cursor = "pointer"; this.hoveredStroke = null; return; }
      const h = this.hitTest(p.x, p.y);
      if (h !== this.hoveredStroke) { this.hoveredStroke = h; this.redraw(); }
      this.canvas.style.cursor = h ? "move" : "default"; return;
    }
    if (this.interactionState) {
      const s = this.interactionState;
      if (s.type === "move" && this.selectedStroke) {
        const dx = p.x - s.start.x, dy = p.y - s.start.y;
        if (this.selectedStroke.type === 'text') {
            this.selectedStroke.x += dx; this.selectedStroke.y += dy;
        } else {
            this.selectedStroke.points.forEach(pt => { pt.x += dx; pt.y += dy; });
        }
        s.start = p; this.redraw();
      } else if (s.type === "rotate" && this.selectedStroke) {
        const b = s.initialBounds, startA = Math.atan2(s.start.y - b.cy, s.start.x - b.cx), curA = Math.atan2(p.y - b.cy, p.x - b.cx);
        let newRot = s.initialRotation + (curA - startA);
        if (e.shiftKey) newRot = Math.round(newRot / (Math.PI / 12)) * (Math.PI / 12);
        this.selectedStroke.rotation = newRot; this.redraw();
      } else if (s.type === "resize" && this.selectedStroke) {
        const b = s.initialBounds, ang = s.initialRotation, c = { x: b.cx, y: b.cy };
        const lM = this.rotatePoint(p.x, p.y, c.x, c.y, -ang);
        let anchor = { x: 0, y: 0 };
        if (s.handle.includes('n')) anchor.y = b.maxY; else if (s.handle.includes('s')) anchor.y = b.minY; else anchor.y = b.cy;
        if (s.handle.includes('w')) anchor.x = b.maxX; else if (s.handle.includes('e')) anchor.x = b.minX; else anchor.x = b.cx;
        const anchorWorld = this.rotatePoint(anchor.x, anchor.y, c.x, c.y, ang);
        let nMinX = b.minX, nMaxX = b.maxX, nMinY = b.minY, nMaxY = b.maxY;
        if (s.handle.includes('w')) nMinX = Math.min(lM.x, b.maxX - 10);
        if (s.handle.includes('e')) nMaxX = Math.max(lM.x, b.minX + 10);
        if (s.handle.includes('n')) nMinY = Math.min(lM.y, b.maxY - 10);
        if (s.handle.includes('s')) nMaxY = Math.max(lM.y, b.minY + 10);
        if (e.shiftKey && (s.handle.length === 2)) {
            const aspect = (b.width || 1) / (b.height || 1);
            const w = nMaxX - nMinX, h = nMaxY - nMinY;
            if (w / h > aspect) { if (s.handle.includes('w')) nMinX = nMaxX - h * aspect; else nMaxX = nMinX + h * aspect; }
            else { if (s.handle.includes('n')) nMinY = nMaxY - w / aspect; else nMaxY = nMinY + w / aspect; }
        }
        const sX = (nMaxX - nMinX) / (b.width || 1), sY = (nMaxY - nMinY) / (b.height || 1);
        if (this.selectedStroke.type === 'text') {
            let scale = 1;
            if (s.handle.length === 1) {
                if (['e', 'w'].includes(s.handle)) scale = sX;
                else scale = sY;
            } else {
                scale = Math.abs(sX - 1) > Math.abs(sY - 1) ? sX : sY;
            }
            if (scale < 0.1) scale = 0.1;
            this.selectedStroke.size = s.initialStroke.size * scale;
            this.ctx.font = `${this.selectedStroke.size}px sans-serif`;
            const lines = this.selectedStroke.text.split('\n');
            const maxWidth = lines.reduce((max, line) => Math.max(max, this.ctx.measureText(line).width), 0);
            this.selectedStroke.width = maxWidth;
            this.selectedStroke.height = lines.length * this.selectedStroke.size * 1.2;
            this.selectedStroke.x = anchorWorld.x - (anchor.x - b.minX) * scale + (s.handle.includes('w') ? -this.selectedStroke.width + (b.width * scale) : 0);
            this.selectedStroke.y = anchorWorld.y - (anchor.y - b.minY) * scale + (s.handle.includes('n') ? -this.selectedStroke.height + (b.height * scale) : 0);
             const nW = nMaxX - nMinX, nH = nMaxY - nMinY;
             const nCx = nMinX + nW / 2, nCy = nMinY + nH / 2;
             const rAnch = this.rotatePoint(anchor.x, anchor.y, nCx, nCy, ang);
             const currAnch = { x: rAnch.x, y: rAnch.y };
             const diff = { x: anchorWorld.x - currAnch.x, y: anchorWorld.y - currAnch.y };
             let T = { x: 0, y: 0 };
             if (Math.abs(ang) < 0.001) T = diff;
             else {
                 const c = Math.cos(ang), s = Math.sin(ang);
                 const det = 2 - 2 * c;
                 T.x = ((1 - c) * diff.x - (-s) * diff.y) / det;
                 T.y = (s * diff.x + (1 - c) * diff.y) / det;
             }
             const finalCx = nCx + T.x;
             const finalCy = nCy + T.y;
             this.selectedStroke.x = finalCx - this.selectedStroke.width / 2;
             this.selectedStroke.y = finalCy - this.selectedStroke.height / 2;
        } else {
            const newPointsRaw = s.initialPoints.map(pt => {
                const l = this.rotatePoint(pt.x, pt.y, c.x, c.y, -ang);
                const nx = nMinX + (l.x - b.minX) * sX;
                const ny = nMinY + (l.y - b.minY) * sY;
                return { x: nx, y: ny };
            });
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            newPointsRaw.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
            const nCx = (minX + maxX) / 2, nCy = (minY + maxY) / 2;
            const rAnch = this.rotatePoint(anchor.x * sX + (nMinX - b.minX * sX), anchor.y * sY + (nMinY - b.minY * sY), nCx, nCy, ang);
            const nAnchorX = nMinX + (anchor.x - b.minX) * sX;
            const nAnchorY = nMinY + (anchor.y - b.minY) * sY;
            const rAnch2 = this.rotatePoint(nAnchorX, nAnchorY, nCx, nCy, ang);
            const diff = { x: anchorWorld.x - rAnch2.x, y: anchorWorld.y - rAnch2.y };
            let T = { x: 0, y: 0 };
            if (Math.abs(ang) < 0.001) T = diff;
            else {
                 const c = Math.cos(ang), s = Math.sin(ang);
                 const det = 2 - 2 * c;
                 T.x = ((1 - c) * diff.x - (-s) * diff.y) / det;
                 T.y = (s * diff.x + (1 - c) * diff.y) / det;
            }
            this.selectedStroke.points = newPointsRaw.map(pt => {
                 const r = this.rotatePoint(pt.x, pt.y, nCx, nCy, ang);
                 return { x: r.x + T.x, y: r.y + T.y };
            });
        }
        this.redraw();
      } else if (s.type === "erase") this.tryErase(p.x, p.y);
      return;
    }
    if (this.isDrawing) { this.mode === "draw" ? this.currentStroke.points.push(p) : this.currentStroke.points[1] = p; this.redraw(); }
  }
  end() {
    if (this.interactionState) { if (["move", "rotate", "resize"].includes(this.interactionState.type)) this.saveStrokes(); this.interactionState = null; if (this.selectedStroke && this.mode === "select") this.app.ui.showDrawingToolbar(this.selectedStroke); }
    if (this.isDrawing) { this.isDrawing = false; this.strokes.push(this.currentStroke); this.history = []; this.saveStrokes(); this.redraw(); }
  }
  tryErase(x, y) {
    const s = this.hitTest(x, y);
    if (s) { this.strokes = this.strokes.filter(x => x !== s); if (this.selectedStroke === s) { this.selectedStroke = null; this.app.ui.hideDrawingToolbar(); } this.redraw(); this.saveStrokes(); }
  }
  redraw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes.forEach(s => this.drawStroke(s));
    if (this.isDrawing && this.currentStroke) this.drawStroke(this.currentStroke);
    if (this.mode === "select") {
      if (this.selectedStroke) this.drawSelectionOverlay(this.selectedStroke);
      if (this.hoveredStroke && this.hoveredStroke !== this.selectedStroke) {
        this.ctx.save(); this.ctx.beginPath(); this.ctx.strokeStyle = "rgba(0, 123, 255, 0.5)"; this.ctx.lineWidth = 2; this.ctx.shadowColor = "rgba(0, 123, 255, 0.5)"; this.ctx.shadowBlur = 10;
        this.drawStrokePath(this.hoveredStroke); this.ctx.stroke(); this.ctx.restore();
      }
    }
  }
  drawStroke(s) {
    this.ctx.save();
    const b = this.getBounds(s);
    if (s.rotation) { this.ctx.translate(b.cx, b.cy); this.ctx.rotate(s.rotation); this.ctx.translate(-b.cx, -b.cy); }
    if (s.type === "text") {
        this.ctx.font = `${s.size}px sans-serif`;
        this.ctx.fillStyle = s.color;
        this.ctx.textBaseline = "top";
        const lines = s.text.split('\n');
        lines.forEach((line, i) => {
            this.ctx.fillText(line, s.x, s.y + i * s.size * 1.2);
        });
    } else {
        this.ctx.beginPath(); this.ctx.strokeStyle = s.color; this.ctx.lineWidth = s.width; this.ctx.lineCap = "round"; this.ctx.lineJoin = "round";
        this.drawStrokePath(s); this.ctx.stroke();
    }
    this.ctx.restore();
  }
  drawStrokePath(s) {
    if (s.type === "draw") { this.ctx.moveTo(s.points[0].x, s.points[0].y); for (let i = 1; i < s.points.length; i++) this.ctx.lineTo(s.points[i].x, s.points[i].y); }
    else if (s.type === "rect" && s.points[1]) this.ctx.rect(s.points[0].x, s.points[0].y, s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y);
    else if (s.type === "circle" && s.points[1]) { const r = Math.hypot(s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y); this.ctx.arc(s.points[0].x, s.points[0].y, r, 0, 2 * Math.PI); }
    else if (s.type === "arrow" && s.points[1]) this.drawArrow(s.points[0], s.points[1]);
  }
  drawSelectionOverlay(s) {
    this.ctx.save();
    const b = this.getBounds(s);
    if (s.rotation) { this.ctx.translate(b.cx, b.cy); this.ctx.rotate(s.rotation); this.ctx.translate(-b.cx, -b.cy); }
    const p = this.getSelectionPadding(s);
    this.ctx.strokeStyle = "#007bff"; this.ctx.lineWidth = 1; this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(b.minX - p, b.minY - p, b.width + p * 2, b.height + p * 2);
    this.ctx.beginPath(); this.ctx.moveTo(b.cx, b.minY - p); this.ctx.lineTo(b.cx, b.minY - p - 25); this.ctx.stroke();
    this.ctx.setLineDash([]); this.ctx.fillStyle = "#fff"; this.ctx.strokeStyle = "#007bff";
    this.ctx.beginPath(); this.ctx.arc(b.cx, b.minY - p - 25, 5, 0, 2 * Math.PI); this.ctx.fill(); this.ctx.stroke();
    Object.values(this.getResizeHandles(b, p)).forEach(h => { this.ctx.beginPath(); this.ctx.rect(h.x - 4, h.y - 4, 8, 8); this.ctx.fill(); this.ctx.stroke(); });
    this.ctx.restore();
  }
  drawArrow(p1, p2) {
    const hl = 15, a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y);
    this.ctx.lineTo(p2.x - hl * Math.cos(a - Math.PI / 6), p2.y - hl * Math.sin(a - Math.PI / 6));
    this.ctx.moveTo(p2.x, p2.y); this.ctx.lineTo(p2.x - hl * Math.cos(a + Math.PI / 6), p2.y - hl * Math.sin(a + Math.PI / 6));
  }
  undo() { if (this.strokes.length) { this.history.push(this.strokes.pop()); this.redraw(); this.saveStrokes(); } }
  redo() { if (this.history.length) { this.strokes.push(this.history.pop()); this.redraw(); this.saveStrokes(); } }
  clear() { this.strokes = []; this.history = []; this.redraw(); this.saveStrokes(); }
  toggleVisibility(v) { if (this.canvas) this.canvas.style.display = v ? "block" : "none"; }
  async saveStrokes() {
    if (!SharedUtils.isValidExtension()) return;
    const d = await chrome.storage.local.get(["pages"]);
    const url = SharedUtils.normalizeUrl(window.location.href);
    if (this.strokes.length === 0) {
      if (d.pages?.[url]) { d.pages[url].drawings = []; if (!d.pages[url].highlights || !d.pages[url].highlights.length) delete d.pages[url]; }
    } else {
      if (!d.pages) d.pages = {}; if (!d.pages[url]) d.pages[url] = { url, highlights: [], drawings: [] };
      d.pages[url].drawings = this.strokes;
    }
    return chrome.storage.local.set({ pages: d.pages });
  }
  async loadStrokes() {
    if (!SharedUtils.isValidExtension()) return;
    const d = await chrome.storage.local.get(["pages"]);
    this.strokes = d.pages?.[SharedUtils.normalizeUrl(window.location.href)]?.drawings || [];
    if (this.strokes.length > 0) { this.setupCanvas(); this.redraw(); } else if (this.canvas) this.redraw();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Whiteboard };
}
