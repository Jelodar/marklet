const ICONS = {
  pen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg>`,
  highlighter: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-5 2-1 5H3v-3l2-1 9.5-9.5a2.121 2.121 0 0 1 3-3z"/></svg>`,
  select: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 19V2z"/></svg>`,
  rect: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5z"/></svg>`,
  circle: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  eraser: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17.02c-.78-.78-.78-2.05 0-2.83l9.19-9.19c.78-.78 2.05-.78 2.83 0l1.41 1.41z"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>`,
  capture: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 5H5l3.5-3.5z"/></svg>`,
  palette: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v3h5.5v12h3V7H19V4z"/></svg>`,
};

const CONSTANTS = { OBSERVER_DEBOUNCE: 1000, OBSERVER_MAX_WAIT: 3000 };

const SHADOW_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, system-ui, sans-serif;
    --mk-shadow: 0 8px 24px rgba(0,0,0,0.15);
    --mk-backdrop: blur(4px);
    --mk-radius: 14px;
    --mk-border-light: rgba(0,0,0,0.05);
    --mk-border-dark: rgba(255,255,255,0.1);
    --mk-bg-light: rgba(255, 255, 255, 0.75);
    --mk-bg-dark: rgba(28, 28, 30, 0.75);
    --mk-hover-light: rgba(0,0,0,0.05);
    --mk-hover-dark: rgba(255,255,255,0.1);
    --mk-z-base: 2147483600;
    --mk-z-toolbar: calc(var(--mk-z-base) + 10);
    --mk-z-palette: calc(var(--mk-z-base) + 20);
    --mk-z-overlay: calc(var(--mk-z-base) + 30);
    --mk-accent: #007bff;
    --mk-accent-hover: #0069d9;
    --mk-accent-active: #0056b3;
    --mk-accent-alpha: rgba(0,123,255,0.3);
    --mk-danger: #ff4d4d;
    --mk-white: #ffffff;
    --mk-text-light: #444444;
    --mk-text-dark: #333333;
    --mk-text-muted: #555555;
    --mk-text-inverted: #eeeeee;
    --mk-text-muted-dark: #cccccc;
    --mk-bg-button-dock: #222222;
    --mk-bg-button-dark: #3a3a3c;
    --mk-bg-button-dark-hover: #48484a;
    --mk-bg-button-light: #f0f0f0;
    --mk-bg-button-light-hover: #e0e0e0;
  }
  .marklet-ui { position: fixed; z-index: var(--mk-z-base); top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; }
  .marklet-absolute-ui { position: absolute; z-index: var(--mk-z-base); top: 0; left: 0; width: 100%; height: 0; overflow: visible; pointer-events: none; }
  .dock { position: fixed; bottom: 24px; right: 24px; background: var(--mk-bg-light); backdrop-filter: var(--mk-backdrop); border-radius: 16px; box-shadow: var(--mk-shadow); display: none; flex-direction: column; gap: 6px; padding: 10px; pointer-events: auto; border: 1px solid rgba(255,255,255,0.4); width: 48px; align-items: center; z-index: var(--mk-z-toolbar); }
  .dock-btn { width: 38px; height: 38px; border-radius: 10px; border: none; background: transparent; color: var(--mk-text-light); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
  .dock-btn svg { width: 22px; height: 22px; pointer-events: none; }
  .dock-btn:hover { background: var(--mk-hover-light); }
  .dock-btn.active { background: var(--mk-accent); color: var(--mk-white); box-shadow: 0 4px 12px var(--mk-accent-alpha); }
  .dock-btn.active:hover { background: var(--mk-accent-hover); }
  .color-preview-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); background: transparent; overflow: hidden; transition: transform 0.1s; }
  .color-preview-btn:hover { transform: scale(1.05); }
  .dock-color-btn { width: 38px; height: 38px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.1); background: var(--mk-bg-button-dock); color: var(--mk-text-light); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); padding: 0; }
  .dock-color-btn:hover { transform: scale(1.05); }
  .thickness-wrap { padding: 10px 0; border-top: 1px solid rgba(0,0,0,0.05); width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .thickness-slider { width: 24px; height: 80px; writing-mode: vertical-lr; direction: rtl; cursor: pointer; accent-color: var(--mk-accent); }
  .palette { position: fixed; pointer-events: auto; opacity: 0; visibility: hidden; background: var(--mk-bg-light); backdrop-filter: var(--mk-backdrop); border-radius: 16px; box-shadow: var(--mk-shadow); width: 240px; border: 1px solid var(--mk-border-light); z-index: var(--mk-z-palette); transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s; transform: translateY(15px); padding: 16px; }
  .palette.visible { opacity: 1; visibility: visible; transform: translateY(0); }
  .palette-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .palette-title { font-size: 13px; font-weight: 700; color: var(--mk-text-dark); }
  .color-preview { width: 40px; height: 24px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1); }
  .swatch-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; border-radius: 8px; overflow: hidden; }
  .color-swatch { aspect-ratio: 1; border: none; cursor: pointer; transition: transform 0.1s; position: relative; }
  .color-swatch:hover { transform: scale(1.1); z-index: 2; border-radius: 4px; box-shadow: 0 0 10px rgba(0,0,0,0.2); }
  .color-swatch::after { content: ''; position: absolute; bottom: 0; right: 0; width: 0; height: 0; border-left: 8px solid transparent; border-bottom: 8px solid rgba(0,0,0,0.3); }
  .color-swatch.active { border-radius: 4px; transform: scale(0.9); box-shadow: inset 0 0 0 2px white; }
  .palette-footer { display: flex; gap: 10px; margin-top: 16px; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 12px; }
  .palette-btn { flex: 1; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 700; transition: all 0.2s; }
  .palette-btn.ok { background: var(--mk-accent); color: var(--mk-white); }
  .palette-btn.ok:hover { background: var(--mk-accent-active); transform: translateY(-1px); }
  .palette-btn.cancel { background: var(--mk-bg-button-light); color: var(--mk-text-light); }
  .palette-btn.cancel:hover { background: var(--mk-bg-button-light-hover); }
  .preset-separator { grid-column: span 6; height: 1px; background: rgba(0,0,0,0.05); margin: 4px 0; }
  .custom-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.03); border-radius: 8px; }
  .custom-row label { font-size: 12px; color: var(--mk-text-muted); font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .custom-row input { width: 28px; height: 28px; border: none; padding: 0; background: none; cursor: pointer; }
  .add-preset-btn { background: var(--mk-text-dark); color: var(--mk-white); border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; }
  .varieties-popover { position: absolute; background: var(--mk-white); border-radius: 12px; box-shadow: var(--mk-shadow); display: grid; grid-template-columns: repeat(5, 1fr); padding: 8px; z-index: var(--mk-z-palette); gap: 6px; border: 1px solid var(--mk-border-light); animation: popIn 0.15s cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .variety-swatch { width: 28px; height: 28px; border-radius: 6px; cursor: pointer; border: 1px solid rgba(0,0,0,0.05); transition: transform 0.1s; }
  .variety-swatch:hover { transform: scale(1.1); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .selection-toolbar, .edit-toolbar { position: absolute; background: var(--mk-bg-light); backdrop-filter: var(--mk-backdrop); border-radius: var(--mk-radius); padding: 6px; display: flex; gap: 6px; pointer-events: auto; box-shadow: var(--mk-shadow); border: 1px solid var(--mk-border-light); z-index: var(--mk-z-toolbar); align-items: center; }
  .tool-btn { width: 36px; height: 36px; border-radius: 10px; border: none; background: transparent; color: var(--mk-text-dark); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .tool-btn:hover { background: var(--mk-hover-light); }
  .tool-btn.color-dot { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--mk-white); box-shadow: 0 0 0 1px rgba(0,0,0,0.1); flex-shrink: 0; }
  @media (prefers-color-scheme: dark) {
    .dock, .selection-toolbar, .edit-toolbar, .palette { background: var(--mk-bg-dark); border-color: var(--mk-border-dark); color: var(--mk-white); }
    .palette-title, .dock-btn, .tool-btn { color: var(--mk-text-inverted); }
    .dock-btn:hover, .tool-btn:hover { background: var(--mk-hover-dark); }
    .color-preview-btn { background: transparent; border-color: var(--mk-border-dark); }
    .dock-color-btn { background: var(--mk-bg-button-dark); border-color: var(--mk-border-dark); color: var(--mk-text-muted-dark); }
    .palette-btn.cancel { background: var(--mk-bg-button-dark); color: var(--mk-text-muted-dark); }
    .palette-btn.cancel:hover { background: var(--mk-bg-button-dark-hover); color: var(--mk-white); }
    .preset-separator { background: var(--mk-border-dark); }
    .custom-row { background: rgba(255,255,255,0.05); }
    .custom-row label { color: var(--mk-text-muted-dark); }
  }
  :host-context([data-marklet-theme="dark"]) .dock, :host-context([data-marklet-theme="dark"]) .selection-toolbar, :host-context([data-marklet-theme="dark"]) .edit-toolbar, :host-context([data-marklet-theme="dark"]) .palette { background: var(--mk-bg-dark); border-color: var(--mk-border-dark); color: var(--mk-white); }
  :host-context([data-marklet-theme="dark"]) .palette-title, :host-context([data-marklet-theme="dark"]) .dock-btn, :host-context([data-marklet-theme="dark"]) .tool-btn { color: var(--mk-text-inverted); }
  :host-context([data-marklet-theme="dark"]) .dock-btn:hover, :host-context([data-marklet-theme="dark"]) .tool-btn:hover { background: var(--mk-hover-dark); }
  :host-context([data-marklet-theme="dark"]) .color-preview-btn { background: transparent; border-color: var(--mk-border-dark); }
  :host-context([data-marklet-theme="dark"]) .dock-color-btn, :host-context([data-marklet-theme="dark"]) .palette-btn.cancel { background: var(--mk-bg-button-dark); border-color: var(--mk-border-dark); color: var(--mk-text-muted-dark); }
  :host-context([data-marklet-theme="dark"]) .palette-btn.cancel:hover { background: var(--mk-bg-button-dark-hover); color: var(--mk-white); }
  :host-context([data-marklet-theme="dark"]) .preset-separator { background: var(--mk-border-dark); }
  :host-context([data-marklet-theme="dark"]) .custom-row { background: rgba(255,255,255,0.05); }
  :host-context([data-marklet-theme="dark"]) .custom-row label { color: var(--mk-text-muted-dark); }
  :host-context([data-marklet-theme="light"]) .dock, :host-context([data-marklet-theme="light"]) .selection-toolbar, :host-context([data-marklet-theme="light"]) .edit-toolbar, :host-context([data-marklet-theme="light"]) .palette { background: var(--mk-bg-light); border-color: var(--mk-border-light); color: var(--mk-text-dark); }
  :host-context([data-marklet-theme="light"]) .palette-title, :host-context([data-marklet-theme="light"]) .dock-btn, :host-context([data-marklet-theme="light"]) .tool-btn { color: var(--mk-text-dark); }
  :host-context([data-marklet-theme="light"]) .dock-btn:hover, :host-context([data-marklet-theme="light"]) .tool-btn:hover { background: var(--mk-hover-light); }
  :host-context([data-marklet-theme="light"]) .color-preview-btn { background: transparent; border-color: rgba(0,0,0,0.1); }
  :host-context([data-marklet-theme="light"]) .dock-color-btn { background: var(--mk-white); border-color: rgba(0,0,0,0.1); }
  :host-context([data-marklet-theme="light"]) .palette-btn.cancel { background: var(--mk-bg-button-light); color: var(--mk-text-light); }
  :host-context([data-marklet-theme="light"]) .palette-btn.cancel:hover { background: var(--mk-bg-button-light-hover); }
  :host-context([data-marklet-theme="light"]) .preset-separator { background: rgba(0,0,0,0.05); }
  :host-context([data-marklet-theme="light"]) .custom-row { background: rgba(0,0,0,0.03); }
  :host-context([data-marklet-theme="light"]) .custom-row label { color: var(--mk-text-muted); }

   .toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(28,28,30,0.85);color:white;padding:10px 20px;border-radius:8px;font-size:14px;z-index:var(--mk-z-overlay);pointer-events:none;opacity:0;transition: all 0.2s;box-shadow:var(--mk-shadow);backdrop-filter:var(--mk-backdrop);border:1px solid rgba(255,255,255,0.1);z-index:6}
`;

if (typeof module !== 'undefined') {
  module.exports = { ICONS, CONSTANTS, SHADOW_STYLES };
}
