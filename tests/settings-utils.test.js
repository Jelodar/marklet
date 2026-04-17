const assert = require('node:assert');
const { test, describe, beforeEach } = require('node:test');
require("./test-setup.js");

describe('Settings Logic (Mocked)', () => {
  beforeEach(() => {
    SharedUtils.setUrlNormalizationSettings(SharedUtils.getDefaultUrlNormalizationSettings());
  });

  test('should return correct string from truncateMiddle', () => {
    const truncateMiddle = (str, maxLen) => {
        if (!str || str.length <= maxLen) return str;
        const front = Math.ceil((maxLen - 3) / 2);
        const back = Math.floor((maxLen - 3) / 2);
        return str.substring(0, front) + '...' + str.substring(str.length - back);
    };

    assert.strictEqual(truncateMiddle('short', 10), 'short');
    assert.strictEqual(truncateMiddle('1234567890', 10), '1234567890');
    assert.strictEqual(truncateMiddle('123456789012345', 10), '1234...345');
    assert.strictEqual(truncateMiddle('', 10), '');
    assert.strictEqual(truncateMiddle(null, 10), null);
  });

  test('should ignore hashes by default when normalizing urls', () => {
    assert.strictEqual(
      SharedUtils.normalizeUrl('https://example.com/path?utm_source=test#section'),
      'https://example.com/path'
    );
  });

  test('should keep hashes when the global mode includes them', () => {
    SharedUtils.setUrlNormalizationSettings({ urlHashMode: 'include' });

    assert.strictEqual(
      SharedUtils.normalizeUrl('https://example.com/path?utm_source=test#section'),
      'https://example.com/path#section'
    );
  });

  test('should let site overrides win over the global hash mode', () => {
    SharedUtils.setUrlNormalizationSettings({
      urlHashMode: 'ignore',
      urlHashSiteModes: {
        'mail.example.com': 'include'
      }
    });

    assert.strictEqual(
      SharedUtils.normalizeUrl('https://mail.example.com/app#inbox'),
      'https://mail.example.com/app#inbox'
    );
    assert.strictEqual(
      SharedUtils.normalizeUrl('https://docs.example.com/app#section'),
      'https://docs.example.com/app'
    );
  });
});
