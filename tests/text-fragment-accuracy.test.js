const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('DOMUtils.getTextFragment', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should generate basic fragment for unique text', () => {
        document.body.innerHTML = '<p>Unique text here</p>';
        const range = document.createRange();
        range.selectNodeContents(document.body.querySelector('p'));
        
        const fragment = DOMUtils.getTextFragment(range);
        assert.ok(fragment.includes('text=Unique%20text%20here'));
    });

    it('should include prefix when text is not unique (at start)', () => {
        document.body.innerHTML = '<p>Instance one: target</p><p>Instance two: target</p>';
        const targets = document.body.querySelectorAll('p');
        
        // Target the second one
        const range = document.createRange();
        const textNode = targets[1].firstChild;
        range.setStart(textNode, textNode.textContent.indexOf('target'));
        range.setEnd(textNode, textNode.textContent.indexOf('target') + 6);
        
        const fragment = DOMUtils.getTextFragment(range);
        // Expect prefix 'two:' or something similar
        assert.ok(fragment.includes('two%3A-'), `Expected prefix in ${fragment}`);
        assert.ok(fragment.includes('target'));
    });

    it('should include suffix when prefix is not enough', () => {
        document.body.innerHTML = '<p>common target unique1</p><p>common target unique2</p>';
        const targets = document.body.querySelectorAll('p');
        
        // Target the first 'target'
        const range = document.createRange();
        const textNode = targets[0].firstChild;
        range.setStart(textNode, textNode.textContent.indexOf('target'));
        range.setEnd(textNode, textNode.textContent.indexOf('target') + 6);
        
        const fragment = DOMUtils.getTextFragment(range);
        assert.ok(fragment.includes(',-unique1'), `Expected suffix in ${fragment}`);
    });

    it('should handle highlights spanning multiple elements', () => {
        document.body.innerHTML = '<p>Part 1 <span>Part 2</span> Part 3</p>';
        const p = document.body.querySelector('p');
        const range = document.createRange();
        range.setStart(p.firstChild, 0);
        range.setEnd(p.lastChild, p.lastChild.textContent.length);
        
        const fragment = DOMUtils.getTextFragment(range);
        const decoded = decodeURIComponent(fragment);
        assert.ok(decoded.includes('Part 1 Part 2 Part 3'), `Expected full text in ${decoded}`);
    });

    it('should use textStart,textEnd for long selections', () => {
        const longText = 'This is a very long selection that should probably be truncated into a start and end fragment to keep the URL manageable and robust against small changes in the middle of the text.';
        document.body.innerHTML = `<p>${longText}</p>`;
        const range = document.createRange();
        range.selectNodeContents(document.body.querySelector('p'));
        
        const fragment = DOMUtils.getTextFragment(range);
        // Should contain start and end separated by comma, but NOT as prefix/suffix
        // format: text=start,end
        const decoded = decodeURIComponent(fragment);
        assert.ok(decoded.includes('This is a'), 'Should have start');
        assert.ok(decoded.includes('of the text.'), 'Should have end');
        assert.ok(decoded.split(',').length >= 2, 'Should be comma-separated');
    });

    it('should handle absence of context (start of doc)', () => {
        document.body.innerHTML = '<p>Target at the very beginning</p>';
        const range = document.createRange();
        range.setStart(document.body.querySelector('p').firstChild, 0);
        range.setEnd(document.body.querySelector('p').firstChild, 6); // "Target"
        
        const fragment = DOMUtils.getTextFragment(range);
        assert.ok(!fragment.includes('-,'), 'Should not have prefix marker');
    });

    it('should handle absence of context (end of doc)', () => {
        document.body.innerHTML = '<p>End with Target</p>';
        const textNode = document.body.querySelector('p').firstChild;
        const range = document.createRange();
        range.setStart(textNode, textNode.textContent.indexOf('Target'));
        range.setEnd(textNode, textNode.textContent.length);
        
        const fragment = DOMUtils.getTextFragment(range);
        assert.ok(!fragment.includes(',-'), 'Should not have suffix marker');
    });

    it('should return empty string for empty range', () => {
        const range = document.createRange();
        const fragment = DOMUtils.getTextFragment(range);
        assert.strictEqual(fragment, '');
    });

    it('should return empty string for range with no text', () => {
        document.body.innerHTML = '<div></div>';
        const range = document.createRange();
        range.selectNodeContents(document.body.querySelector('div'));
        const fragment = DOMUtils.getTextFragment(range);
        assert.strictEqual(fragment, '');
    });
});
