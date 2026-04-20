const SharedUI = {
  _root: document.body,
  _toastTimer: null,
  _toastRemoveTimer: null,

  init(root) {
    if (root) this._root = root;
  },

  /**
   * Versatile element creator
   * @param {string} tag - Tag name
   * @param {...*} args - Classes (string), Children (Node/Array), Props/Attrs (Object), or Callback (Function)
   */
  el(tag, ...args) {
    const el = document.createElement(tag);
    const children = [];
    for (const arg of args) {
      if (!arg) continue;
      if (typeof arg === 'string') {
        el.classList.add(...arg.trim().split(/\s+/).filter(Boolean));
      } else if (arg instanceof Node) {
        children.push(arg);
      } else if (Array.isArray(arg)) {
        children.push(...arg);
      } else if (typeof arg === 'function') {
        arg(el);
      } else if (typeof arg === 'object') {
        if (arg.text !== undefined) el.textContent = arg.text;
        if (arg.html !== undefined) el.innerHTML = arg.html;
        if (arg.className) el.classList.add(...arg.className.trim().split(/\s+/).filter(Boolean));
        if (arg.style && typeof arg.style === 'object') Object.assign(el.style, arg.style);
        if (arg.attrs) Object.entries(arg.attrs).forEach(([k, v]) => {
          if (v !== null && v !== undefined) el.setAttribute(k, v);
        });
        if (arg.on) Object.entries(arg.on).forEach(([k, v]) => el.addEventListener(k, v));
        const specials = ['text', 'html', 'className', 'style', 'attrs', 'on', 'parent'];
        Object.entries(arg).forEach(([k, v]) => {
          if (!specials.includes(k)) el[k] = v;
        });
        if (arg.parent instanceof Node) arg.parent.appendChild(el);
      }
    }
    children.forEach(child => {
      if (child) el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  },

  // Shortcuts
  div(...args) { return this.el('div', ...args); },
  span(...args) { return this.el('span', ...args); },
  button(...args) { return this.el('button', ...args); },
  icon(html) { return this.el('span', 'icon', { html }); },

  // Semantic Helpers
  empty(text) { return this.div('empty-state', { text }); },
  card(...args) { return this.div('settings-section', ...args); },
  row(...args) { return this.div('setting-item', ...args); },
  info(title, hint) {
    return this.div('setting-info', [
      this.span({ text: title }),
      hint ? this.div('setting-hint', { text: hint }) : null
    ].filter(Boolean));
  },

  alert(title, message) {
    return this.showModal({ title, message, showCancel: false });
  },

  confirm(title, message, options = {}) {
    return this.showModal({ title, message, showCancel: true, ...options });
  },

  showModal({
    title,
    message,
    body,
    showCancel = true,
    confirmText = 'OK',
    cancelText = 'Cancel',
    isDanger = false,
    panelClass = '',
    bodyClass = ''
  }) {
    return new Promise((resolve) => {
      const overlay = this.div('modal-overlay');
      const panel = this.div(`modal-panel ${panelClass}`.trim());
      const titleEl = this.div('modal-title', { text: title });
      
      let contentEl;
      if (body instanceof Node) {
        contentEl = this.div(`modal-body ${bodyClass}`.trim(), body);
      } else {
        contentEl = this.div('modal-message', { text: message });
      }

      const actions = this.div('modal-actions');
      const confirmBtn = this.button(`modal-btn ${isDanger ? 'modal-btn-danger' : 'modal-btn-primary'}`, { text: confirmText });

      const close = (result) => {
        document.removeEventListener('keydown', onKeydown);
        overlay.style.opacity = '0';
        panel.style.transform = 'scale(0.95) translateY(8px)';
        setTimeout(() => {
          overlay.remove();
          resolve(result);
        }, 250);
      };

      const onKeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          close(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (showCancel) close(false);
        }
      };

      document.addEventListener('keydown', onKeydown);
      confirmBtn.onclick = () => close(true);

      if (showCancel) {
        const cancelBtn = this.button('modal-btn modal-btn-secondary', { 
          text: cancelText, 
          onclick: () => close(false) 
        });
        actions.appendChild(cancelBtn);
      }

      actions.appendChild(confirmBtn);
      panel.append(titleEl, contentEl, actions);
      overlay.appendChild(panel);
      (this._root || document.body).appendChild(overlay);

      overlay.onclick = (e) => {
        if (e.target === overlay && showCancel) close(false);
      };
    });
  },

  toast(message, duration = 3000) {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    if (this._toastRemoveTimer) clearTimeout(this._toastRemoveTimer);

    let toast = (this._root || document.body).querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      (this._root || document.body).appendChild(toast);
    }

    toast.textContent = message;
    
    // Force reflow
    toast.offsetHeight;
    toast.classList.add('visible');

    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      this._toastRemoveTimer = setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, duration);
  }
};

if (typeof module !== 'undefined') {
  module.exports = { SharedUI };
}
