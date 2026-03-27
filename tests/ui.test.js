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
});

describe('SharedUtils.isValidExtension', () => {
  it('should return false if chrome runtime is missing', () => {
    const originalChrome = global.chrome;
    global.chrome = {};
    assert.strictEqual(SharedUtils.isValidExtension(), false);
    global.chrome = originalChrome;
  });
});
