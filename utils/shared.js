const SharedUtils = {
  normalizeUrl: (u) => {
    try {
      const url = new URL(u);
      const garbage = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'msclkid', '_ga', '_gl', 'ref'];
      garbage.forEach(p => url.searchParams.delete(p));
      url.hash = '';
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
