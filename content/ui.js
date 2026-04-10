class UI {
  constructor(root, app) {
    this.root = root; this.app = app;
    this.container = Object.assign(document.createElement("div"), { className: "marklet-ui" });
    this.absoluteContainer = Object.assign(document.createElement("div"), { className: "marklet-absolute-ui" });
    this.root.append(this.absoluteContainer, this.container);
    this.recentColors = ["#FFFF00", "#FF4D4D", "#FF9800", "#4CAF50"];
    this.baseColors = ["#f44336", "#ff5722", "#ff9800", "#ffc107", "#ffeb3b", "#cddc39", "#8bc34a", "#4caf50", "#009688", "#00bcd4", "#03a9f4", "#2196f3", "#3f51b5", "#673ab7", "#9c27b0", "#e91e63", "#795548", "#5d4037", "#607d8b", "#455a64", "#9e9e9e", "#424242", "#000000", "#ffffff"];
    this.originColors = [...this.baseColors];
    this.pendingColor = "#FFFF00";
    this.init();
  }
  async init() {
    if (!SharedUtils.isValidExtension()) return;
    const d = await chrome.storage.local.get(["baseColors", "originColors"]);
    if (d.baseColors) this.baseColors = d.baseColors;
    if (d.originColors) this.originColors = d.originColors;
    else this.originColors = [...this.baseColors];
    this.renderDock(); this.renderPalette(); this.loadCustomPresets(); this.loadRecentColors();
  }
  renderDock() {
    this.dock = document.createElement("div");
    this.dock.className = "dock";
    this.dock.innerHTML = `<button class="dock-color-btn" title="Choose Color" id="btn-palette-dock"><div class="color-preview-btn" id="dock-color-prev"></div></button><button class="dock-btn" title="Select / Move (S)" id="btn-select">${ICONS.select}</button><button class="dock-btn" title="Draw (P)" id="btn-draw">${ICONS.pen}</button><button class="dock-btn" title="Rectangle (R)" id="btn-rect">${ICONS.rect}</button><button class="dock-btn" title="Circle (C)" id="btn-circle">${ICONS.circle}</button><button class="dock-btn" title="Arrow (A)" id="btn-arrow">${ICONS.arrow}</button><button class="dock-btn" title="Text (T)" id="btn-text">${ICONS.text}</button><button class="dock-btn" title="Eraser (E)" id="btn-erase">${ICONS.eraser}</button><button class="dock-btn" title="Clear All Drawings" id="btn-clear-draw-dock">${ICONS.trash}</button><div class="thickness-wrap"><input type="range" class="thickness-slider" id="stroke-thickness" min="1" max="20" value="5"></div><div class="dock-sep"></div><div class="blend-wrap" title="Canvas Blend Mode"><span class="blend-text" id="dock-blend-text">Normal</span><select id="dock-blend-select" class="dock-select"><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="darken">Darken</option><option value="lighten">Lighten</option><option value="color-dodge">Color Dodge</option><option value="color-burn">Color Burn</option><option value="hard-light">Hard Light</option><option value="soft-light">Soft Light</option><option value="difference">Difference</option><option value="exclusion">Exclusion</option><option value="hue">Hue</option><option value="saturation">Saturation</option><option value="color">Color</option><option value="luminosity">Luminosity</option></select></div><div class="dock-sep"></div><button class="dock-btn" title="Undo (Ctrl+Z)" id="btn-undo">${ICONS.undo}</button><button class="dock-btn" title="Redo (Ctrl+Y)" id="btn-redo">${ICONS.redo || ICONS.undo}</button><button class="dock-btn" title="Move Dock" id="btn-move-dock">${ICONS.left}</button><div class="dock-sep"></div><button class="dock-btn" title="Exit Whiteboard (Esc)" id="btn-exit-whiteboard">${ICONS.close}</button>`;
    this.container.appendChild(this.dock);
    this.updateDockColorPrev();
    this.dock.onmousedown = (e) => { if (e.target.id !== "stroke-thickness" && e.target.id !== "dock-blend-select") e.preventDefault(); };
    this.dock.querySelector("#btn-palette-dock").onclick = (e) => { e.stopPropagation(); this.togglePalette(undefined, e.currentTarget); };
    this.dock.querySelector("#btn-clear-draw-dock").onclick = (e) => { e.stopPropagation(); if (confirm("Clear all drawings on this page?")) this.app.whiteboard.clear(); };
    const blendSelect = this.dock.querySelector("#dock-blend-select");
    blendSelect.value = this.app.whiteboard.blendMode;
    this.updateDockBlendText(this.app.whiteboard.blendMode);
    blendSelect.onchange = (e) => { this.app.whiteboard.setBlendMode(e.target.value); this.updateDockBlendText(e.target.value); };
    ["select", "draw", "rect", "circle", "arrow", "text", "erase"].forEach(t => {
      const btn = this.dock.querySelector(`#btn-${t}`);
      if (btn) btn.onclick = () => this.setTool(t);
    });
    this.dock.querySelector("#btn-undo").onclick = () => this.app.whiteboard.undo();
    this.dock.querySelector("#btn-redo").onclick = () => this.app.whiteboard.redo();
    this.dock.querySelector("#btn-exit-whiteboard").onclick = () => { this.app.whiteboardActive = false; this.toggleWhiteboardMode(false); };
    this.dock.querySelector("#stroke-thickness").oninput = (e) => this.app.whiteboard.setThickness(parseInt(e.target.value));

    const moveBtn = this.dock.querySelector("#btn-move-dock");
    chrome.storage.local.get(["dockPosition"], (res) => {
      if (res.dockPosition === "left") {
        this.dock.classList.add("dock-left");
        moveBtn.innerHTML = ICONS.right;
      }
    });
    moveBtn.onclick = () => {
      const isLeft = this.dock.classList.toggle("dock-left");
      moveBtn.innerHTML = isLeft ? ICONS.right : ICONS.left;
      chrome.storage.local.set({ dockPosition: isLeft ? "left" : "right" });
      if (this.palette.classList.contains("visible")) this.togglePalette(false);
    };
  }
  updateDockBlendText(m) {
    if (!this.dock) return;
    const el = this.dock.querySelector("#dock-blend-text");
    if (el) el.textContent = m;
  }
  triggerKey(e) {
    if (!this.app.whiteboard.active) return;
    if ((e.ctrlKey || e.metaKey)) {
      if (e.key === "z") { this.app.whiteboard.undo(); }
      else if (e.key === "y") { this.app.whiteboard.redo(); }
    }
    if (this.app.whiteboard.mode === "select" && this.app.whiteboard.selectedStroke) {
      if (e.key === "Delete" || e.key === "Backspace") {
        this.app.whiteboard.strokes = this.app.whiteboard.strokes.filter(s => s !== this.app.whiteboard.selectedStroke);
        this.app.whiteboard.selectedStroke = null; this.app.whiteboard.redraw(); this.app.whiteboard.saveStrokes();
        this.hideDrawingToolbar();
      } else if (e.key.startsWith("Arrow")) {
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        const s = this.app.whiteboard.selectedStroke;
        if (s.type === 'text') { s.x += dx; s.y += dy; }
        else { s.points.forEach(pt => { pt.x += dx; pt.y += dy; }); }
        this.app.whiteboard.redraw(); this.app.whiteboard.saveStrokes();
      }
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      const t = { s: "select", p: "draw", r: "rect", c: "circle", a: "arrow", e: "erase", t: "text" }[e.key.toLowerCase()];
      if (t) {
        this.setTool(t);
      }
    }
  }
  destroy() {
    if (this.showToolbarTimer) clearTimeout(this.showToolbarTimer);
    if (this.showEditTimer) clearTimeout(this.showEditTimer);
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    if (this.notificationRemoveTimer) clearTimeout(this.notificationRemoveTimer);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    if (this.pickerTimer) clearTimeout(this.pickerTimer);
    this.container.remove();
    this.absoluteContainer.remove();
  }
  updateDockColorPrev() { this.updateDockPreview(); }
  updateDockPreview() {
    const btn = this.dock.querySelector("#btn-palette-dock");
    const el = this.dock.querySelector("#dock-color-prev");
    if (!el || !btn) return;
    el.innerHTML = "";
    if (!this.app.whiteboard.active) { btn.style.backgroundColor = ""; btn.style.borderColor = ""; el.style.backgroundColor = this.app.highlighter.currentColor; return; }
    el.style.backgroundColor = "transparent";
    const wb = this.app.whiteboard;
    const s = wb.selectedStroke;
    const color = s ? s.color : wb.color;
    const width = Math.min(12, s ? s.width : wb.lineWidth);
    const mode = s ? s.type : wb.mode;
    btn.style.backgroundColor = "#222";
    btn.style.borderColor = "rgba(255,255,255,0.2)";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 32 32"); Object.assign(svg.style, { width: "100%", height: "100%" });
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    Object.assign(path.style, { fill: "none", stroke: color, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" });
    if (mode === "draw" || mode === "select" || mode === "text") path.setAttribute("d", "M6 20 C10 10, 22 10, 26 20");
    else if (mode === "rect") path.setAttribute("d", "M6 8 H26 V24 H6 Z");
    else if (mode === "circle") path.setAttribute("d", "M16 6 A10 10 0 1 1 15.9 6");
    else if (mode === "arrow") path.setAttribute("d", "M6 20 L26 12");
    else if (mode === "erase") { path.setAttribute("stroke", "#eee"); path.setAttribute("d", "M8 8 L24 24 M24 8 L8 24"); }
    svg.appendChild(path); el.appendChild(svg);
  }
  syncThickness(v) { this.dock.querySelector("#stroke-thickness").value = v; this.updateDockPreview(); }
  syncWithSelection(s) {
    if (s) {
      if (s.type === 'text') {
        this.syncThickness((s.size - 10) / 3);
      } else {
        this.syncThickness(s.width);
      }
      this.updateDockPreview();
    }
  }
  setTool(t) {
    this.app.whiteboard.setMode(t);
    this.dock.querySelectorAll(".dock-btn").forEach(b => b.classList.remove("active"));
    const btn = this.dock.querySelector(`#btn-${t === "draw" ? "draw" : t}`);
    if (btn) btn.classList.add("active");
  }
  async loadCustomPresets() { if (SharedUtils.isValidExtension()) { const d = await chrome.storage.local.get(["customPresets"]); this.customPresets = d.customPresets || []; this.updatePaletteDOM(); } }
  async loadRecentColors() { if (SharedUtils.isValidExtension()) { const d = await chrome.storage.local.get(["recentColors"]); if (d.recentColors) this.recentColors = d.recentColors; else await this.trackRecentColor("#FFFF00"); } }
  async trackRecentColor(c) { if (SharedUtils.isValidExtension()) { this.recentColors = [c, ...this.recentColors.filter(x => x !== c)].slice(0, 4); await chrome.storage.local.set({ recentColors: this.recentColors }); } }
  getColorVarieties(hex) {
    const parse = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const toHex = (rgb) => "#" + rgb.map(x => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, "0")).join("");
    const mix = (c1, c2, f) => c1.map((v, i) => v + (c2[i] - v) * f);
    try { const rgb = parse(hex); return [...[0.8, 0.6, 0.4, 0.2].map(f => toHex(mix(rgb, [255, 255, 255], f))).reverse(), hex, ...[0.2, 0.4, 0.6, 0.8].map(f => toHex(mix(rgb, [0, 0, 0], f)))]; } catch { return [hex]; }
  }
  renderPalette() {
    this.palette = Object.assign(document.createElement("div"), { className: "palette" });
    this.container.appendChild(this.palette);
    this.updatePaletteDOM();
    this.palette.onmousedown = (e) => e.preventDefault();
  }
  updatePendingColor(c) {
    this.pendingColor = c;
    const preview = this.palette.querySelector("#pal-prev");
    const picker = this.palette.querySelector("#pal-picker");
    if (preview) preview.style.backgroundColor = c;
    if (picker) picker.value = this.rgbToHex(c);

    if (this.paletteContext === "highlight") {
      if (this.currentEditId) this.app.highlighter.previewColor(this.currentEditId, c);
    } else if (this.paletteContext === "whiteboard" && this.app.whiteboard.selectedStroke) {
      this.app.whiteboard.selectedStroke.color = c;
      this.app.whiteboard.redraw();
      this.updateDockColorPrev();
    }
  }
  updatePaletteDOM() {
    const base = this.baseColors, custom = this.customPresets || [];
    this.palette.innerHTML = `<div class="palette-header"><span class="palette-title">Colors</span><div class="color-preview" id="pal-prev"></div></div><div class="swatch-grid">${base.map((c, i) => `<div class="color-swatch" style="background:${c}" data-color="${c}" data-index="${i}"></div>`).join("")}${custom.length > 0 ? `<div class="preset-separator"></div>` + custom.map(c => `<div class="color-swatch" style="background:${c}" data-color="${c}"></div>`).join("") : ""}</div><div class="custom-row"><label id="custom-label"><input type="color" id="pal-picker" value="#ff0000"><span>Custom Color</span></label><button class="add-preset-btn" id="add-preset">Save Preset</button></div><div class="palette-footer"><button class="palette-btn cancel" id="pal-cancel">Cancel</button><button class="palette-btn ok" id="pal-ok">Apply</button></div>`;

    const picker = this.palette.querySelector("#pal-picker");
    const customLabel = this.palette.querySelector("#custom-label");
    const preview = this.palette.querySelector("#pal-prev");

    preview.style.backgroundColor = this.pendingColor;
    picker.value = this.rgbToHex(this.pendingColor);
    const swatches = this.palette.querySelectorAll(".color-swatch");

    swatches.forEach(s => {
      if (s.dataset.color.toLowerCase() === this.pendingColor.toLowerCase()) s.classList.add("active");
      s.onmousedown = (e) => {
        if (e.button === 2) return;
        e.preventDefault();
        this.longPressed = false;
        this.longPressTimer = setTimeout(() => {
          this.showVarieties(s.dataset.color, s, s.dataset.index);
          this.longPressed = true;
        }, CONSTANTS.LONG_PRESS_DURATION);
      };
      s.oncontextmenu = (e) => {
        e.preventDefault();
        this.showVarieties(s.dataset.color, s, s.dataset.index);
      };
      s.onmouseup = s.onmouseleave = () => {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
      };
    });

    this.palette.onclick = (e) => {
      const s = e.target.closest(".color-swatch");
      if (s && !this.longPressed) {
        swatches.forEach(x => x.classList.remove("active"));
        customLabel.style.color = "";
        s.classList.add("active");
        this.updatePendingColor(s.dataset.color);
      }
    };
    picker.onmousedown = () => { this.isPickingCustomColor = true; };
    picker.oninput = (e) => { swatches.forEach(x => x.classList.remove("active")); customLabel.style.color = "#007bff"; this.updatePendingColor(e.target.value); };
    picker.onchange = () => {
      if (this.pickerTimer) clearTimeout(this.pickerTimer);
      this.pickerTimer = setTimeout(() => this.isPickingCustomColor = false, CONSTANTS.PICKER_DEBOUNCE);
    };
    this.palette.querySelector("#pal-ok").onclick = (e) => {
      if (!SharedUtils.isValidExtension()) return;
      e.stopPropagation(); this.isPickingCustomColor = false;
      if (this.pendingColor) {
        if (this.paletteContext === "whiteboard") this.applyColor(this.pendingColor);
        else {
          if (this.currentEditId) { this.app.highlighter.changeColor(this.currentEditId, this.pendingColor); this.currentEditId = null; }
          else { this.applyColor(this.pendingColor); if (this.currentSelectionRange) { this.app.highlighter.applyHighlight(this.currentSelectionRange, this.pendingColor); this.currentSelectionRange = null; } }
        }
      }
      this.togglePalette(false);
    };
    this.palette.querySelector("#pal-cancel").onclick = (e) => {
      e.stopPropagation(); this.isPickingCustomColor = false;
      if (this.paletteContext === "highlight" && this.currentEditId && this.originalColor) this.app.highlighter.previewColor(this.currentEditId, this.originalColor);
      if (this.paletteContext === "whiteboard" && this.app.whiteboard.selectedStroke && this.originalColor) { this.app.whiteboard.selectedStroke.color = this.originalColor; this.app.whiteboard.redraw(); this.updateDockColorPrev(); }
      this.currentEditId = null; this.currentSelectionRange = null; this.togglePalette(false);
    };
    this.palette.querySelector("#add-preset").onclick = async (e) => {
      e.stopPropagation();
      this.customPresets = [...new Set([...(this.customPresets || []), picker.value])];
      await chrome.storage.local.set({ customPresets: this.customPresets });
      this.updatePaletteDOM();
    };
  }
  showVarieties(color, target, index) {
    if (this.varietiesPopover) this.varietiesPopover.remove();
    const origin = (index !== undefined) ? this.originColors[index] : color;
    this.varietiesPopover = Object.assign(document.createElement("div"), { className: "varieties-popover", innerHTML: this.getColorVarieties(origin).map(v => `<div class="variety-swatch" style="background:${v}" data-color="${v}"></div>`).join("") });
    const rect = target.getBoundingClientRect(), popWidth = 178;
    let left = Math.max(10, Math.min(window.innerWidth - popWidth - 10, rect.left - popWidth / 2 + rect.width / 2)), top = Math.max(10, rect.top - 90);
    if (top < 10) top = rect.bottom + 10;
    Object.assign(this.varietiesPopover.style, { left: `${left}px`, top: `${top}px`, width: `${popWidth}px`, pointerEvents: "auto" });
    this.varietiesPopover.onmousedown = (e) => e.stopPropagation();
    this.varietiesPopover.onclick = (e) => {
      e.stopPropagation();
      const v = e.target.closest(".variety-swatch");
      if (v) {
        const newColor = v.dataset.color;
        if (index !== undefined) {
          this.baseColors[index] = newColor;
          chrome.storage.local.set({ baseColors: this.baseColors, originColors: this.originColors });
          this.updatePendingColor(newColor);
          this.updatePaletteDOM();
        } else {
          this.updatePendingColor(newColor);
          const swatches = this.palette.querySelectorAll(".color-swatch");
          swatches.forEach(x => x.classList.remove("active"));
          const picker = this.palette.querySelector("#pal-picker");
          const customLabel = this.palette.querySelector("#custom-label");
          if (picker) picker.value = this.rgbToHex(newColor);
          if (customLabel) customLabel.style.color = "#007bff";
        }
        this.varietiesPopover.remove(); this.varietiesPopover = null;
      }
    };
    this.container.appendChild(this.varietiesPopover);
    const close = (e) => { if (this.varietiesPopover && !e.composedPath().includes(this.varietiesPopover)) { this.varietiesPopover.remove(); this.varietiesPopover = null; document.removeEventListener("mousedown", close); } };
    setTimeout(() => document.addEventListener("mousedown", close), 10);
  }
  applyColor(c) {
    if (!SharedUtils.isValidExtension()) return;
    if (this.paletteContext === "whiteboard") { this.app.whiteboard.setColor(c); this.trackRecentColor(c); this.updateDockColorPrev(); chrome.storage.local.set({ defaultDrawColor: c }); }
    else { this.app.highlighter.currentColor = c; this.trackRecentColor(c); chrome.storage.local.set({ defaultHighlightColor: c }); }
  }
  rgbToHex(color) {
    if (!color) return "#000000";
    if (color.startsWith('#')) return color;
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return "#000000";
    return "#" + ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2])).toString(16).slice(1);
  }
  togglePalette(f, targetBtn) {
    const show = f !== undefined ? f : !this.palette.classList.contains("visible");
    if (show) {
      const isDock = targetBtn && this.dock.contains(targetBtn);
      this.paletteContext = (this.app.whiteboard.active && (!targetBtn || isDock)) ? "whiteboard" : "highlight";
      const curColor = this.paletteContext === "whiteboard" ? (this.app.whiteboard.selectedStroke ? this.app.whiteboard.selectedStroke.color : this.app.whiteboard.color) : (this.currentEditId ? document.querySelector(`.marklet-highlight[data-id="${this.currentEditId}"]`)?.style.backgroundColor || this.app.highlighter.currentColor : this.app.highlighter.currentColor);
      this.pendingColor = curColor; this.originalColor = curColor;
      this.palette.querySelector("#pal-prev").style.backgroundColor = curColor;
      this.palette.querySelector("#pal-picker").value = this.rgbToHex(curColor);
      if (targetBtn) {
        const rect = targetBtn.getBoundingClientRect();
        if (isDock) {
          this.palette.style.position = 'fixed';
          this.container.appendChild(this.palette);
          let left = Math.max(10, rect.left - 260), top = rect.top;
          if (left < 10) left = rect.right + 10;
          if (top + 300 > window.innerHeight) top = window.innerHeight - 320;
          Object.assign(this.palette.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
        } else {
          this.palette.style.position = 'absolute';
          this.absoluteContainer.appendChild(this.palette);
          let left = Math.max(10, rect.left + window.scrollX - 260), top = rect.top + window.scrollY;
          if (left < 10) left = rect.right + window.scrollX + 10;
          Object.assign(this.palette.style, { left: `${left}px`, top: `${top}px`, right: "auto", bottom: "auto" });
        }
      } else {
        this.palette.style.position = 'fixed';
        this.container.appendChild(this.palette);
        Object.assign(this.palette.style, { left: "auto", right: "80px", top: "auto", bottom: "24px" });
      }
    } else { this.originalColor = null; this.paletteContext = null; }
    this.palette.classList.toggle("visible", show);
  }
  toggleDock(v) { this.dock.style.display = v ? "flex" : "none"; }
  toggleWhiteboardMode(activate) {
    this.app.whiteboard.toggle(activate);
    this.toggleDock(activate);
    if (activate) {
      this.app.toggleDrawingsVisibility(true);
      this.setTool("draw"); this.updateDockColorPrev();
      if (!this.app.isSavable) {
        setTimeout(() => this.showNotification("⚠️ This page type (blob/data/etc) doesn't support saving. Your annotations will be lost on reload."), 1000);
      }
    }
  }
  showSelectionToolbar(x, y, r) {
    if (this.showToolbarTimer) clearTimeout(this.showToolbarTimer);
    this.showToolbarTimer = setTimeout(() => {
      if (this.selToolbar) this.selToolbar.remove();
      this.hideEditToolbar();
      this.selectionTarget = r.commonAncestorContainer;
      this.selToolbar = Object.assign(document.createElement("div"), { className: "selection-toolbar", innerHTML: this.recentColors.map(c => `<button class="tool-btn color-dot" style="background:${c}" data-color="${c}"></button>`).join("") + `<button class="tool-btn" id="sel-more">${ICONS.palette}</button>` });
      Object.assign(this.selToolbar.style, { left: `${Math.min(x + window.scrollX, document.documentElement.scrollWidth - 180)}px`, top: `${Math.max(10, y + window.scrollY - 50)}px`, opacity: '0', transition: 'opacity 0.1s' });
      this.selToolbar.onmousedown = (e) => e.preventDefault();
      this.selToolbar.querySelectorAll(".color-dot").forEach(b => b.onclick = (e) => { e.stopPropagation(); this.app.highlighter.applyHighlight(r, b.dataset.color, true); });
      this.selToolbar.querySelector("#sel-more").onclick = (e) => { e.stopPropagation(); this.currentSelectionRange = r; this.togglePalette(true, e.currentTarget); };
      this.absoluteContainer.appendChild(this.selToolbar);
      requestAnimationFrame(() => { if (this.selToolbar) this.selToolbar.style.opacity = '1'; });
    }, CONSTANTS.TOOLBAR_DEBOUNCE);
  }
  hideSelectionToolbar() {
    if (this.showToolbarTimer) clearTimeout(this.showToolbarTimer);
    if (this.selToolbar) { this.selToolbar.remove(); this.selToolbar = null; this.selectionTarget = null; }
  }
  showEditToolbar(x, y, id) {
    if (this.showEditTimer) clearTimeout(this.showEditTimer);
    this.showEditTimer = setTimeout(() => {
      if (this.editToolbar) this.editToolbar.remove();
      this.selectionTarget = document.querySelector(`.marklet-highlight[data-id="${id}"]`);
      this.editToolbar = Object.assign(document.createElement("div"), { className: "edit-toolbar" });
      Object.assign(this.editToolbar.style, { left: `${Math.min(x + window.scrollX, document.documentElement.scrollWidth - 220)}px`, top: `${Math.max(10, y + window.scrollY - 50)}px`, opacity: '0', transition: 'opacity 0.1s' });
      this.editToolbar.onmousedown = (e) => e.preventDefault();
      const btnTrash = Object.assign(document.createElement("button"), { className: "tool-btn", innerHTML: ICONS.trash, onclick: (e) => { e.stopPropagation(); this.app.highlighter.deleteHighlight(id); } }); btnTrash.style.color = "var(--mk-danger)";
      this.editToolbar.appendChild(btnTrash);
      const btnLink = Object.assign(document.createElement("button"), { className: "tool-btn", innerHTML: ICONS.link, title: "Copy Highlight URL", onclick: (e) => {
          e.stopPropagation();
          const mark = document.querySelector(`.marklet-highlight[data-id="${id}"]`);
          if (mark) {
              const range = document.createRange(); range.selectNodeContents(mark);
              const url = window.location.origin + window.location.pathname + window.location.search + DOMUtils.getTextFragment(range);
              navigator.clipboard.writeText(url).then(() => {
                  const original = btnLink.innerHTML; btnLink.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
                  setTimeout(() => btnLink.innerHTML = original, 2000);
                  this.showNotification("Link copied to clipboard!");
              });
          }
      } });
      this.editToolbar.appendChild(btnLink);
      this.recentColors.forEach(c => this.editToolbar.appendChild(Object.assign(document.createElement("button"), { className: "tool-btn color-dot edit-color-dot", style: `background:${c}`, onclick: (e) => { e.stopPropagation(); this.app.highlighter.changeColor(id, c); } })));
      this.editToolbar.appendChild(Object.assign(document.createElement("button"), { className: "tool-btn", innerHTML: ICONS.palette, onclick: (e) => { e.stopPropagation(); const mark = document.querySelector(`.marklet-highlight[data-id="${id}"]`); if (mark) this.originalColor = mark.style.backgroundColor; this.currentEditId = id; this.togglePalette(true, e.currentTarget); } }));
      this.editToolbar.appendChild(Object.assign(document.createElement("button"), { className: "tool-btn", innerHTML: ICONS.close, onclick: (e) => { e.stopPropagation(); this.hideEditToolbar(); } }));
      this.absoluteContainer.appendChild(this.editToolbar);
      requestAnimationFrame(() => { if (this.editToolbar) this.editToolbar.style.opacity = '1'; });
    }, CONSTANTS.TOOLBAR_DEBOUNCE);
  }
  hideEditToolbar() {
    if (this.showEditTimer) clearTimeout(this.showEditTimer);
    if (this.editToolbar) { this.editToolbar.remove(); this.editToolbar = null; this.selectionTarget = null; }
  }
  showDrawingToolbar(s) {
    if (this.drawToolbar) this.drawToolbar.remove();
    this.drawToolbar = Object.assign(document.createElement("div"), { className: "edit-toolbar" });
    const b = this.app.whiteboard.getBounds(s), p = this.app.whiteboard.getSelectionPadding(s);
    Object.assign(this.drawToolbar.style, { left: `${Math.min(Math.max(10, b.cx - 110), document.documentElement.scrollWidth - 230)}px`, top: `${Math.max(10, b.minY - p - 90)}px` });
    this.drawToolbar.onmousedown = (e) => e.preventDefault();
    this.drawToolbar.innerHTML = `<button class="tool-btn" id="draw-trash" style="color:var(--mk-danger)">${ICONS.trash}</button>${this.recentColors.map(c => `<button class="tool-btn color-dot draw-color-dot" style="background:${c}" data-color="${c}"></button>`).join("")}<button class="tool-btn" id="draw-palette">${ICONS.palette}</button><button class="tool-btn" id="draw-close">${ICONS.close}</button>`;
    this.drawToolbar.querySelectorAll(".draw-color-dot").forEach(b => b.onclick = (e) => { e.stopPropagation(); this.app.whiteboard.setColor(b.dataset.color); });
    this.drawToolbar.querySelector("#draw-palette").onclick = (e) => { e.stopPropagation(); this.togglePalette(true, e.currentTarget); };
    this.drawToolbar.querySelector("#draw-trash").onclick = (e) => { e.stopPropagation(); const wb = this.app.whiteboard; if (wb.selectedStroke) { wb.strokes = wb.strokes.filter(st => st !== wb.selectedStroke); wb.selectedStroke = null; wb.redraw(); wb.saveStrokes(); this.hideDrawingToolbar(); } };
    this.drawToolbar.querySelector("#draw-close").onclick = () => this.hideDrawingToolbar();
    this.absoluteContainer.appendChild(this.drawToolbar);
  }
  hideDrawingToolbar() { if (this.drawToolbar) { this.drawToolbar.remove(); this.drawToolbar = null; } }
  showNotification(msg) {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    if (this.notificationRemoveTimer) clearTimeout(this.notificationRemoveTimer);
    let toast = this.container.querySelector('.toast');
    if (!toast) {
      toast = Object.assign(document.createElement("div"), { textContent: msg, className: 'toast' });
      this.container.appendChild(toast);
    } else {
      toast.textContent = msg;
    }
    requestAnimationFrame(() => toast.style.opacity = "1");
    this.notificationTimer = setTimeout(() => {
      toast.style.opacity = "0";
      this.notificationRemoveTimer = setTimeout(() => toast.remove(), CONSTANTS.TRANSITION_DURATION);
    }, CONSTANTS.NOTIFICATION_DURATION);
  }
}
if (typeof module !== 'undefined') {
  module.exports = { UI };
}
