const URL_HASH_MODE_IGNORE = 'ignore';
const URL_HASH_MODE_INCLUDE = 'include';
const VALID_URL_HASH_MODES = new Set([URL_HASH_MODE_IGNORE, URL_HASH_MODE_INCLUDE]);

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

const SharedUtils = {
  getDefaultHotkeys: () => ({
    highlight: 'Alt+H',
    toggleWhiteboard: 'Alt+Shift+W',
    toggleDrawings: 'Alt+Shift+D',
    toggleHighlights: 'Alt+Shift+H',
    toggleAll: 'Alt+Shift+A'
  }),
  getDefaultUrlNormalizationSettings: () => cloneUrlNormalizationSettings({
    defaultHashMode: URL_HASH_MODE_IGNORE,
    siteHashModes: {}
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
    opacity: 75,
    blendMode: 'normal'
  }),
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
  }
};

if (typeof module !== 'undefined') {
  module.exports = SharedUtils;
}
