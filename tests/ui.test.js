const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require("./test-setup.js");

describe('UI and Selection Handling', () => {
  let marklet;
  let ui;
  let shadowRoot;

  beforeEach(() => {
    document.body.innerHTML = '';
    const shadowHost = document.createElement('div');
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    marklet = {
      shadow: shadowRoot,
      shadowHost: shadowHost,
      whiteboard: { toggle: mock.fn(), setColor: mock.fn() },
      highlighter: { applyHighlight: mock.fn(), deleteHighlight: mock.fn(), changeColor: mock.fn() },
      toggleDrawingsVisibility: mock.fn(),
      pauseObserver: mock.fn(),
      resumeObserver: mock.fn()
    };
    ui = new UI(shadowRoot, marklet);
  });

  afterEach(async () => {
    if (ui) ui.destroy();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should hide toolbars when selectionTarget is removed from DOM', async () => {
    const target = document.createElement('div');
    target.textContent = 'test text';
    document.body.appendChild(target);

    const range = document.createRange();
    range.selectNodeContents(target);

    ui.showSelectionToolbar(0, 0, range);
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.ok(ui.selToolbar);
    assert.strictEqual(ui.selectionTarget, target);

    target.remove();

    ui.hideSelectionToolbar();
    assert.strictEqual(ui.selToolbar, null);
    assert.strictEqual(ui.selectionTarget, null);
  });

  it('should track recent colors correctly', async () => {
    const color = '#123456';
    await ui.trackRecentColor(color);
    assert.strictEqual(ui.recentColors[0], color);
    assert.strictEqual(ui.recentColors.length, 4);
  });

  it('should sanitize stored palette colors before rendering palette and selection swatches', async () => {
    chrome.storage.local.get = mock.fn(async (keys) => {
      if (Array.isArray(keys) && keys.includes('baseColors')) {
        return {
          baseColors: ['#123456', '" onmouseover="window.__xss = true'],
          originColors: ['#654321', 'bad-value']
        };
      }
      if (Array.isArray(keys) && keys.includes('customPresets')) {
        return { customPresets: ['#abcdef', '\"><img id="palette-xss">'] };
      }
      if (Array.isArray(keys) && keys.includes('recentColors')) {
        return { recentColors: ['#fedcba', 'url(javascript:alert(1))'] };
      }
      return {};
    });

    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const unsafeUI = new UI(root, marklet);
    await new Promise(resolve => setTimeout(resolve, 20));

    unsafeUI.togglePalette(true);
    document.body.textContent = 'visible text';
    const range = document.createRange();
    range.setStart(document.body.firstChild, 0);
    range.setEnd(document.body.firstChild, 7);
    unsafeUI.showSelectionToolbar(10, 10, range);
    await new Promise(resolve => setTimeout(resolve, 60));

    assert.strictEqual(unsafeUI.baseColors.includes('#123456'), true);
    assert.strictEqual(unsafeUI.baseColors.some((color) => color.includes('"')), false);
    assert.deepStrictEqual(unsafeUI.customPresets, ['#abcdef']);
    assert.deepStrictEqual(unsafeUI.recentColors, ['#fedcba']);
    assert.strictEqual(unsafeUI.palette.querySelector('#palette-xss'), null);
    assert.strictEqual(unsafeUI.selToolbar.querySelector('img'), null);

    unsafeUI.destroy();
  });

  it('should show a content-toolbar error when copying a highlight link fails', async () => {
    global.navigator.clipboard = {
      writeText: mock.fn(async () => {
        throw new Error('clipboard denied');
      })
    };
    marklet.highlighter.currentColor = '#ffff00';

    const highlight = document.createElement('mark');
    highlight.className = 'marklet-highlight';
    highlight.dataset.id = 'h-1';
    highlight.textContent = 'Example highlight';
    document.body.appendChild(highlight);

    ui.showEditToolbar(10, 10, 'h-1');
    await new Promise(resolve => setTimeout(resolve, 60));

    ui.editToolbar.querySelector('[title="Copy Highlight URL"]').click();
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(document.querySelector('img'), null);
    assert.strictEqual(document.body.querySelector('div.toast').textContent, 'Could not copy highlight link.');
  });
});

describe('SharedUtils.isValidExtension', () => {
  it('should return false if chrome runtime is missing', () => {
    const originalChrome = global.chrome;
    global.chrome = {};
    assert.strictEqual(SharedUtils.isValidExtension(), false);
    global.chrome = originalChrome;
  });
});
