const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('Extension Page CSP', () => {
    it('should keep settings and popup theme bootstraps external', () => {
        const settingsHtml = read('settings/settings.html');
        const popupHtml = read('popup/popup.html');

        assert.match(settingsHtml, /<script src="\.\.\/utils\/theme-init\.js"><\/script>/);
        assert.match(popupHtml, /<script src="\.\.\/utils\/theme-init\.js"><\/script>/);
        assert.doesNotMatch(settingsHtml, /<script(?![^>]*\bsrc=)[^>]*>/);
        assert.doesNotMatch(popupHtml, /<script(?![^>]*\bsrc=)[^>]*>/);
    });
});
