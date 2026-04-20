require('./test-setup.js');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('assert');
const { JSDOM } = require('jsdom');

function setSelection(startNode, startOffset, endNode, endOffset) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return range;
}

describe('Bug Reproduction: Overlapping Highlights', () => {
    let highlighter;
    let app;

    beforeEach(() => {
        document.body.innerHTML = 'He explained that he wanted all sides, including the movement';
        
        mockStorage.clear();

        app = { 
            ui: { 
                trackRecentColor: () => {}, 
                showEditToolbar: () => {}, 
                hideSelectionToolbar: () => {},
                showNotification: () => {}
            },
            pauseObserver: () => {},
            resumeObserver: () => {},
            updateObserverState: () => {},
            shadowHost: document.createElement('div'),
            isSavable: true
        };
        highlighter = new Highlighter(app);
    });

    afterEach(async () => {
        if (highlighter && highlighter.destroy) highlighter.destroy();
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should correctly handle the user reported sequence', async () => {
        const textNode = document.body.firstChild;
        const textContent = textNode.textContent;
        
        const start1 = textContent.indexOf("that");
        const end1 = start1 + 4;
        setSelection(textNode, start1, textNode, end1);
        await highlighter.applyHighlight(window.getSelection().getRangeAt(0), "yellow");
        
        let marks = document.querySelectorAll('mark');
        assert.strictEqual(marks.length, 1);
        assert.strictEqual(marks[0].textContent, "that");
        assert.strictEqual(marks[0].style.backgroundColor, "yellow");
        
        const markText = marks[0].firstChild;
        const afterMarkText = marks[0].nextSibling;
        
        const range2 = setSelection(markText, 3, afterMarkText, 9);
        await highlighter.applyHighlight(range2, "orange");
        
        const step3Start = 25;
        const step3End = step3Start + "ed all side".length;
        
        const range3 = DOMUtils.getRangeFromOffsets(step3Start, step3End);
        setSelection(range3.startContainer, range3.startOffset, range3.endContainer, range3.endOffset);
        await highlighter.applyHighlight(range3, "red");       
        const marksFinal = document.querySelectorAll('.marklet-highlight');

        const hasTha = Array.from(marksFinal).some(m => m.textContent === "tha" && m.style.backgroundColor === "yellow");
        assert.ok(hasTha, 'Should have "tha" highlighted in yellow');
        
        const hasThat = Array.from(marksFinal).some(m => m.textContent === "that");
        assert.ok(!hasThat, 'Should NOT have "that" fully highlighted (split)');
        
        let highlightedText = "";
        marksFinal.forEach(m => highlightedText += m.textContent);
        
        const expected = "that he wanted all side";
        assert.strictEqual(highlightedText.replace(/\s/g, ''), expected.replace(/\s/g, ''), 'Highlighted text content should match expected merged intervals');
    });
});
