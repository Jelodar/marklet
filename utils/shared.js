const URL_HASH_MODE_IGNORE = 'ignore';
const URL_HASH_MODE_INCLUDE = 'include';
const VALID_URL_HASH_MODES = new Set([URL_HASH_MODE_IGNORE, URL_HASH_MODE_INCLUDE]);
const VALID_THEMES = new Set(['system', 'light', 'dark']);
const VALID_DOCK_POSITIONS = new Set(['left', 'right']);
const VALID_DRAWING_BLEND_MODES = new Set([
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
]);
const VALID_WHITEBOARD_TOOLS = new Set(['select', 'draw', 'rect', 'circle', 'arrow', 'text', 'erase']);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const EXPORTABLE_SETTING_KEYS = Object.freeze([
  'extensionEnabled',
  'enableByDefault',
  'theme',
  'disabledSites',
  'enabledSites',
  'urlHashMode',
  'urlHashSiteModes',
  'highlightShadowsEnabled',
  'highlightRounded',
  'allowReadonlyHighlight',
  'selectionToolbarEnabled',
  'highlightsVisible',
  'drawingsVisible',
  'defaultHighlightColor',
  'defaultDrawColor',
  'drawingOpacity',
  'drawingBlendMode',
  'lastWhiteboardTool',
  'recentColors',
  'customPresets',
  'baseColors',
  'originColors',
  'hotkeys',
  'dockPosition'
]);

const SETTINGS_GROUPS = Object.freeze([
  {
    id: 'general',
    label: 'General Settings',
    detail: 'Core behavior, theme, and default colors',
    badge: 'Core',
    keys: ['extensionEnabled', 'enableByDefault', 'theme', 'defaultHighlightColor', 'defaultDrawColor', 'drawingOpacity', 'drawingBlendMode']
  },
  {
    id: 'appearance',
    label: 'Appearance & UI',
    detail: 'Visual style and toolbar visibility',
    badge: 'UI',
    keys: ['highlightShadowsEnabled', 'highlightRounded', 'allowReadonlyHighlight', 'selectionToolbarEnabled', 'highlightsVisible', 'drawingsVisible', 'dockPosition']
  },
  {
    id: 'siteRules',
    label: 'Site Rules',
    detail: 'Enabled/disabled sites and URL normalization',
    badge: 'Rules',
    keys: ['disabledSites', 'enabledSites', 'urlHashMode', 'urlHashSiteModes']
  },
  {
    id: 'hotkeys',
    label: 'Hotkeys',
    detail: 'Keyboard shortcuts for common actions',
    badge: 'Keys',
    keys: ['hotkeys']
  },
  {
    id: 'colors',
    label: 'Palette & Presets',
    detail: 'Recent colors, custom presets, and palette swatch variants',
    badge: 'Palette',
    keys: ['recentColors', 'customPresets', 'baseColors', 'originColors']
  }
]);

let urlNormalizationSettings = {
  defaultHashMode: URL_HASH_MODE_IGNORE,
  siteHashModes: {}
};

const normalizeHostname = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  try {
    const candidate = /^[a-z]+:\/\//.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
    return new URL(candidate).hostname.toLowerCase();
  } catch (e) {
    return '';
  }
};

const normalizeUrlHashMode = (value) => VALID_URL_HASH_MODES.has(value) ? value : URL_HASH_MODE_IGNORE;

const normalizeUrlHashSiteModes = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce((acc, [hostname, mode]) => {
    const normalizedHost = normalizeHostname(hostname);
    if (!normalizedHost) return acc;
    acc[normalizedHost] = normalizeUrlHashMode(mode);
    return acc;
  }, {});
};

const cloneUrlNormalizationSettings = (value) => ({
  defaultHashMode: value.defaultHashMode,
  siteHashModes: { ...value.siteHashModes }
});

const normalizeStoredColor = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) return '';
  if (trimmed.length === 4) {
    return `#${trimmed.slice(1).split('').map((part) => `${part}${part}`).join('')}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

const sanitizeColorList = (value, {
  fallback = [],
  limit = Infinity,
  fixedLength = false,
  fallbackWhenEmpty = false
} = {}) => {
  const fallbackColors = (Array.isArray(fallback) ? fallback : []).map(normalizeStoredColor).filter(Boolean);
  if (fixedLength) {
    const source = Array.isArray(value) ? value : [];
    return fallbackColors.map((fallbackColor, index) => normalizeStoredColor(source[index]) || fallbackColor);
  }
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const items = [];
  source.forEach((item) => {
    const color = normalizeStoredColor(item);
    if (!color || seen.has(color) || items.length >= limit) return;
    seen.add(color);
    items.push(color);
  });
  if (items.length === 0 && fallbackWhenEmpty) return fallbackColors.slice(0, limit);
  return items;
};

const sanitizeSiteList = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.reduce((acc, item) => {
    const hostname = normalizeHostname(item);
    if (!hostname || seen.has(hostname)) return acc;
    seen.add(hostname);
    acc.push(hostname);
    return acc;
  }, []);
};

const sanitizeHotkeys = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.entries(DEFAULT_SETTINGS.hotkeys).reduce((acc, [key, fallback]) => {
    acc[key] = typeof source[key] === 'string' && source[key].trim() ? source[key].trim() : fallback;
    return acc;
  }, {});
};

const sanitizeUrlNormalizationSettings = (value = {}) => ({
  defaultHashMode: normalizeUrlHashMode(value.defaultHashMode || value.urlHashMode),
  siteHashModes: normalizeUrlHashSiteModes(value.siteHashModes || value.urlHashSiteModes)
});

const resolveUrlHashMode = (u, settings = urlNormalizationSettings) => {
  try {
    const url = new URL(u);
    return settings.siteHashModes[url.hostname.toLowerCase()] || settings.defaultHashMode;
  } catch (e) {
    return settings.defaultHashMode;
  }
};

const DEFAULT_SETTINGS = Object.freeze({
  extensionEnabled: true,
  enableByDefault: true,
  theme: 'system',
  disabledSites: [],
  enabledSites: [],
  urlHashMode: URL_HASH_MODE_IGNORE,
  urlHashSiteModes: {
    'mail.google.com': URL_HASH_MODE_INCLUDE
  },
  highlightShadowsEnabled: false,
  highlightRounded: false,
  allowReadonlyHighlight: true,
  selectionToolbarEnabled: true,
  highlightsVisible: true,
  drawingsVisible: true,
  defaultHighlightColor: '#ffff00',
  defaultDrawColor: '#ff0000',
  drawingOpacity: 75,
  drawingBlendMode: 'normal',
  lastWhiteboardTool: 'draw',
  recentColors: ['#FFFF00', '#FF4D4D', '#FF9800', '#4CAF50'],
  customPresets: [],
  hotkeys: {
    highlight: 'Alt+H',
    toggleWhiteboard: 'Alt+Shift+W',
    toggleDrawings: 'Alt+Shift+D',
    toggleHighlights: 'Alt+Shift+H',
    toggleAll: 'Alt+Shift+A'
  },
  baseColors: [
    '#f44336', '#ff5722', '#ff9800', '#ffc107', '#ffeb3b', '#cddc39',
    '#8bc34a', '#4caf50', '#009688', '#00bcd4', '#03a9f4', '#2196f3',
    '#3f51b5', '#673ab7', '#9c27b0', '#e91e63', '#795548', '#5d4037',
    '#607d8b', '#455a64', '#9e9e9e', '#424242', '#000000', '#ffffff'
  ],
  originColors: [
    '#f44336', '#ff5722', '#ff9800', '#ffc107', '#ffeb3b', '#cddc39',
    '#8bc34a', '#4caf50', '#009688', '#00bcd4', '#03a9f4', '#2196f3',
    '#3f51b5', '#673ab7', '#9c27b0', '#e91e63', '#795548', '#5d4037',
    '#607d8b', '#455a64', '#9e9e9e', '#424242', '#000000', '#ffffff'
  ],
  dockPosition: 'right'
});

const sanitizePaletteSettings = (value = {}) => ({
  baseColors: sanitizeColorList(value.baseColors, {
    fallback: DEFAULT_SETTINGS.baseColors,
    fixedLength: true
  }),
  originColors: sanitizeColorList(value.originColors, {
    fallback: DEFAULT_SETTINGS.originColors,
    fixedLength: true
  }),
  recentColors: sanitizeColorList(value.recentColors, {
    fallback: DEFAULT_SETTINGS.recentColors,
    limit: DEFAULT_SETTINGS.recentColors.length,
    fallbackWhenEmpty: true
  }),
  customPresets: sanitizeColorList(value.customPresets, {
    limit: 24
  }),
  defaultHighlightColor: normalizeStoredColor(value.defaultHighlightColor) || DEFAULT_SETTINGS.defaultHighlightColor,
  defaultDrawColor: normalizeStoredColor(value.defaultDrawColor) || DEFAULT_SETTINGS.defaultDrawColor
});

const sanitizeStoredSettings = (value = {}) => {
  const palette = sanitizePaletteSettings(value);
  return {
    extensionEnabled: typeof value.extensionEnabled === 'boolean' ? value.extensionEnabled : DEFAULT_SETTINGS.extensionEnabled,
    enableByDefault: typeof value.enableByDefault === 'boolean' ? value.enableByDefault : DEFAULT_SETTINGS.enableByDefault,
    theme: VALID_THEMES.has(value.theme) ? value.theme : DEFAULT_SETTINGS.theme,
    disabledSites: sanitizeSiteList(value.disabledSites),
    enabledSites: sanitizeSiteList(value.enabledSites),
    urlHashMode: normalizeUrlHashMode(value.urlHashMode),
    urlHashSiteModes: normalizeUrlHashSiteModes(value.urlHashSiteModes),
    highlightShadowsEnabled: typeof value.highlightShadowsEnabled === 'boolean' ? value.highlightShadowsEnabled : DEFAULT_SETTINGS.highlightShadowsEnabled,
    highlightRounded: typeof value.highlightRounded === 'boolean' ? value.highlightRounded : DEFAULT_SETTINGS.highlightRounded,
    allowReadonlyHighlight: typeof value.allowReadonlyHighlight === 'boolean' ? value.allowReadonlyHighlight : DEFAULT_SETTINGS.allowReadonlyHighlight,
    selectionToolbarEnabled: typeof value.selectionToolbarEnabled === 'boolean' ? value.selectionToolbarEnabled : DEFAULT_SETTINGS.selectionToolbarEnabled,
    highlightsVisible: typeof value.highlightsVisible === 'boolean' ? value.highlightsVisible : DEFAULT_SETTINGS.highlightsVisible,
    drawingsVisible: typeof value.drawingsVisible === 'boolean' ? value.drawingsVisible : DEFAULT_SETTINGS.drawingsVisible,
    defaultHighlightColor: palette.defaultHighlightColor,
    defaultDrawColor: palette.defaultDrawColor,
    drawingOpacity: Number.isFinite(Number(value.drawingOpacity))
      ? Math.max(0, Math.min(100, Math.round(Number(value.drawingOpacity))))
      : DEFAULT_SETTINGS.drawingOpacity,
    drawingBlendMode: VALID_DRAWING_BLEND_MODES.has(value.drawingBlendMode) ? value.drawingBlendMode : DEFAULT_SETTINGS.drawingBlendMode,
    lastWhiteboardTool: VALID_WHITEBOARD_TOOLS.has(value.lastWhiteboardTool) ? value.lastWhiteboardTool : DEFAULT_SETTINGS.lastWhiteboardTool,
    recentColors: palette.recentColors,
    customPresets: palette.customPresets,
    baseColors: palette.baseColors,
    originColors: palette.originColors,
    hotkeys: sanitizeHotkeys(value.hotkeys),
    dockPosition: VALID_DOCK_POSITIONS.has(value.dockPosition) ? value.dockPosition : DEFAULT_SETTINGS.dockPosition
  };
};

const SharedUtils = {
  getDefaultSettings: () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  getDefaultHotkeys: () => ({ ...DEFAULT_SETTINGS.hotkeys }),
  getDefaultUrlNormalizationSettings: () => cloneUrlNormalizationSettings({
    defaultHashMode: DEFAULT_SETTINGS.urlHashMode,
    siteHashModes: DEFAULT_SETTINGS.urlHashSiteModes
  }),
  getUrlNormalizationSettings: () => cloneUrlNormalizationSettings(urlNormalizationSettings),
  normalizeUrlNormalizationSettings: (value) => sanitizeUrlNormalizationSettings(value),
  setUrlNormalizationSettings: (value) => {
    urlNormalizationSettings = sanitizeUrlNormalizationSettings(value);
    return SharedUtils.getUrlNormalizationSettings();
  },
  toUrlNormalizationStorage: (value = urlNormalizationSettings) => {
    const normalized = sanitizeUrlNormalizationSettings(value);
    return {
      urlHashMode: normalized.defaultHashMode,
      urlHashSiteModes: { ...normalized.siteHashModes }
    };
  },
  getDefaultDrawingSettings: () => ({
    opacity: DEFAULT_SETTINGS.drawingOpacity,
    blendMode: DEFAULT_SETTINGS.drawingBlendMode
  }),
  getExportableSettingKeys: () => [...EXPORTABLE_SETTING_KEYS],
  getDefaultHighlightColor: () => DEFAULT_SETTINGS.defaultHighlightColor,
  getDefaultDrawColor: () => DEFAULT_SETTINGS.defaultDrawColor,
  getDefaultTheme: () => DEFAULT_SETTINGS.theme,
  getDefaultBaseColors: () => [...DEFAULT_SETTINGS.baseColors],
  getDefaultRecentColors: () => [...DEFAULT_SETTINGS.recentColors],
  getSettingsGroups: () => SETTINGS_GROUPS.map(g => ({ ...g, keys: [...g.keys] })),
  normalizeStoredColor,
  sanitizePaletteSettings,
  sanitizeStoredSettings,
  normalizePageData: (page, fallbackUrl = '') => {
    const source = page && typeof page === 'object' && !Array.isArray(page) ? page : {};
    const normalizeItems = (items) => Array.isArray(items)
      ? items.filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(item => ({ ...item }))
      : [];
    return {
      ...source,
      url: typeof source.url === 'string' && source.url ? source.url : fallbackUrl,
      highlights: normalizeItems(source.highlights),
      drawings: normalizeItems(source.drawings),
      lastUpdated: Number.isFinite(source.lastUpdated) ? source.lastUpdated : 0
    };
  },
  normalizeHostname,
  normalizeUrl: (u, settings = urlNormalizationSettings) => {
    try {
      const url = new URL(u);
      const garbage = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', '_ga', '_gl', 'ref'];
      garbage.forEach(p => url.searchParams.delete(p));
      const normalizedSettings = settings === urlNormalizationSettings ? settings : sanitizeUrlNormalizationSettings(settings);
      if (resolveUrlHashMode(u, normalizedSettings) !== URL_HASH_MODE_INCLUDE) url.hash = '';
      let s = url.toString();
      if (s.endsWith("/") && s.length > 1) s = s.slice(0, -1);
      return s;
    } catch(e) { return u; }
  },
  getHostname: (u) => {
    try {
      return new URL(u).hostname;
    } catch (e) { return null; }
  },
  isValidExtension: () => !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id),
  isSavable: (u) => {
    try {
      const url = new URL(u);
      return !['blob:', 'data:', 'chrome:', 'about:', 'chrome-extension:', 'edge:', 'devtools:', 'view-source:'].includes(url.protocol);
    } catch (e) { return false; }
  },
  isRestricted: (u) => {
    try {
      const url = new URL(u);
      return ['chrome:', 'about:', 'chrome-extension:', 'edge:', 'devtools:', 'view-source:'].includes(url.protocol);
    } catch (e) { return true; }
  },
  getSystemTheme: () => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
  applyTheme: (theme) => {
    try { localStorage.setItem('marklet-theme', theme || 'system'); } catch (e) {}
    const resolved = theme === 'system' ? SharedUtils.getSystemTheme() : theme;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', resolved || 'light');
      // For content scripts using data-marklet-theme
      if (document.documentElement.hasAttribute('data-marklet-theme')) {
        document.documentElement.setAttribute('data-marklet-theme', theme || 'system');
      }
    }
    return resolved;
  },
  parseHotkey: (hotkey) => {
    if (!hotkey) return null;
    const lastPlus = hotkey.lastIndexOf('+');
    const parts = lastPlus > 0 ? hotkey.slice(0, lastPlus).toLowerCase().split("+") : [];
    const key = (lastPlus >= 0 ? hotkey.slice(lastPlus + 1) : hotkey).toLowerCase();
    return {
      key: key === 'space' ? ' ' : key,
      meta: parts.some(p => ["meta", "cmd", "command"].includes(p)),
      ctrl: parts.some(p => ["ctrl", "control"].includes(p)),
      alt: parts.some(p => ["alt", "option"].includes(p)),
      shift: parts.includes("shift")
    };
  },
  normalizeKeyEvent: (e) => {
    const codeMap = {
      Period: '.', Comma: ',', Slash: '/', Backslash: '\\',
      BracketLeft: '[', BracketRight: ']', Quote: "'", Semicolon: ';',
      Minus: '-', Equal: '=', Backquote: '`', Space: ' '
    };
    const inputKey = (e.key || "").toLowerCase();
    let physicalKey = (e.code || "").replace(/^Key/, "").replace(/^Digit/, "").toLowerCase();
    if (codeMap[e.code]) physicalKey = codeMap[e.code];
    return { inputKey, physicalKey };
  }
};

if (typeof module !== 'undefined') {
  module.exports = SharedUtils;
}
