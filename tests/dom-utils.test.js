const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('DOMUtils', () => {
  beforeEach(() => {
      document.body.innerHTML = '';
  });

  afterEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should calculate global offsets correctly for simple text', () => {    document.body.innerHTML = 'Hello World';
    const range = document.createRange();
    range.setStart(document.body.firstChild, 0);
    range.setEnd(document.body.firstChild, 5);

    const offsets = DOMUtils.getGlobalOffsets(range);
    assert.deepStrictEqual(offsets, { start: 0, end: 5 });
  });

  it('should calculate global offsets across multiple nodes', () => {
    document.body.innerHTML = 'Hello <b>World</b>';
    const t1 = document.body.childNodes[0];
    const t2 = document.body.childNodes[1].firstChild;

    const range = document.createRange();
    range.setStart(t1, 3);
    range.setEnd(t2, 3);

    const offsets = DOMUtils.getGlobalOffsets(range);
    assert.deepStrictEqual(offsets, { start: 3, end: 9 });
  });

  it('should recover range from offsets', () => {
    document.body.innerHTML = 'Hello World';
    const offsets = { start: 0, end: 5 };
    const recoveredRange = DOMUtils.getRangeFromOffsets(offsets.start, offsets.end);

    assert.strictEqual(recoveredRange.toString(), 'Hello');
    assert.strictEqual(recoveredRange.startContainer, document.body.firstChild);
    assert.strictEqual(recoveredRange.startOffset, 0);
    assert.strictEqual(recoveredRange.endOffset, 5);
  });

  it('should exclude hidden and non-visible text from snapshots', () => {
    document.body.innerHTML = `
      Visible
      <span hidden>Hidden</span>
      <span style="display:none">Gone</span>
      <span style="visibility:hidden">Invisible</span>
      <script>ignored()</script>
      <style>.x { color: red; }</style>
      <span> Text</span>
    `;

    const snapshot = DOMUtils.createTextSnapshot();

    assert.strictEqual(snapshot.text.replace(/\s+/g, ' ').trim(), 'Visible Text');
    assert.strictEqual(snapshot.text.includes('Hidden'), false);
    assert.strictEqual(snapshot.text.includes('Gone'), false);
    assert.strictEqual(snapshot.text.includes('Invisible'), false);
  });
});
