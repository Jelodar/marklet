document.addEventListener('DOMContentLoaded', async () => {
    const globalEnableToggle = document.getElementById('global-enable-toggle');
    const enableByDefaultToggle = document.getElementById('enable-by-default-toggle');
    const themeSelect = document.getElementById('theme-select');
    const shadowsToggle = document.getElementById('shadows-toggle');
    const roundedToggle = document.getElementById('rounded-toggle');
    const toolbarToggle = document.getElementById('toolbar-toggle');
    const highlightColorInput = document.getElementById('default-highlight-color');
    const drawColorInput = document.getElementById('default-draw-color');
    const drawOpacityInput = document.getElementById('drawing-opacity');
    const drawOpacityVal = document.getElementById('draw-opacity-val');
    const blendModeSelect = document.getElementById('blend-mode-select');
    const siteListContainer = document.getElementById('disabled-sites-list');
    const siteListHeader = siteListContainer.parentElement.parentElement.querySelector('h2');
    const pagesList = document.getElementById('pages-list');
    const pageSearch = document.getElementById('page-search');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const resetBtn = document.getElementById('reset-defaults-btn');
    const hotkeyInputs = {
        highlight: document.getElementById('hotkey-highlight'),
        whiteboard: document.getElementById('hotkey-whiteboard'),
        drawings: document.getElementById('hotkey-drawings'),
        highlights: document.getElementById('hotkey-highlights'),
        all: document.getElementById('hotkey-all')
    };
    let allPages = {};
    let isEnabledByDefault = true;
    const applyTheme = (theme) => {
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    };
    const truncateMiddle = (str, maxLen) => {
        if (!str || str.length <= maxLen) return str;
        const front = Math.ceil((maxLen - 3) / 2);
        const back = Math.floor((maxLen - 3) / 2);
        return str.substring(0, front) + '...' + str.substring(str.length - back);
    };
    const renderSiteList = (sites, isWhitelist) => {
        siteListHeader.textContent = isWhitelist ? "Enabled Sites (Exceptions)" : "Disabled Sites";
        if (!sites || sites.length === 0) {
            siteListContainer.innerHTML = `<div class="empty-state">No ${isWhitelist ? 'enabled' : 'disabled'} sites.</div>`;
            return;
        }
        siteListContainer.innerHTML = sites.map(site => `
            <div class="site-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border-color);">
                <span>${site}</span>
                <button class="btn danger mini-btn btn-remove-site" data-site="${site}">Remove</button>
            </div>
        `).join('');
        siteListContainer.querySelectorAll('.btn-remove-site').forEach(btn => {
            btn.onclick = async () => {
                const key = isWhitelist ? 'enabledSites' : 'disabledSites';
                const s = await chrome.storage.local.get([key]);
                const newSites = (s[key] || []).filter(x => x !== btn.dataset.site);
                await chrome.storage.local.set({ [key]: newSites });
                renderSiteList(newSites, isWhitelist);
            };
        });
    };
    const renderPages = (filter = '') => {
        const pages = Object.values(allPages).filter(p => {
            if (!p || !p.url) return false;
            const searchLower = filter.toLowerCase();
            const hasHighlights = p.highlights && p.highlights.length > 0;
            const hasDrawings = p.drawings && p.drawings.length > 0;
            if (!hasHighlights && !hasDrawings) return false;
            return p.url.toLowerCase().includes(searchLower) ||
                   (hasHighlights && p.highlights.some(h => (h.text || '').toLowerCase().includes(searchLower)));
        });
        if (pages.length === 0) {
            pagesList.innerHTML = `<div class="empty-state">${filter ? 'No results match your search.' : 'No highlights or drawings found.'}</div>`;
            return;
        }
        pagesList.innerHTML = pages.map(page => `
            <div class="page-card" data-url="${page.url}">
                <div class="page-header">
                    <div style="flex-grow: 1; min-width: 0;">
                        <a href="${page.url}" target="_blank" class="page-title" title="${page.url}">${truncateMiddle(page.url, 60)}</a>
                    </div>
                    <div class="page-actions">
                        <button class="btn secondary mini-btn btn-goto" data-url="${page.url}">Go to Page</button>
                        <button class="btn danger mini-btn btn-delete-page" data-url="${page.url}">Delete</button>
                    </div>
                </div>
                <div class="highlights-summary">
                    ${(page.highlights || []).slice(0, 3).map(h => `
                        <div class="highlight-snippet">
                            <div class="highlight-indicator" style="background-color: ${h.color};"></div>
                            <div class="highlight-text">${h.text || 'No text'}</div>
                        </div>
                    `).join('')}
                    ${(page.highlights || []).length > 3 ? `<div style="font-size: 11px; color: var(--text-muted); padding-left: 16px;">+ ${(page.highlights || []).length - 3} more highlights</div>` : ''}
                    ${(page.drawings || []).length > 0 ? `<div style="font-size: 11px; color: var(--text-muted); padding-left: 16px; margin-top: 4px;">🎨 ${page.drawings.length} drawing(s)</div>` : ''}
                </div>
            </div>
        `).join('');
        pagesList.querySelectorAll('.btn-goto').forEach(btn => {
            btn.onclick = () => window.open(btn.dataset.url, '_blank');
        });
        pagesList.querySelectorAll('.btn-delete-page').forEach(btn => {
            btn.onclick = async () => {
                if (confirm(`Delete all highlights and drawings for ${btn.dataset.url}?`)) {
                    const url = btn.dataset.url;
                    delete allPages[url];
                    await chrome.storage.local.set({ pages: allPages });
                    renderPages(pageSearch.value);
                }
            };
        });
    };
    const recordHotkey = (e, key) => {
        e.preventDefault();
        e.stopPropagation();
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');
        const codeMap = {
            Period: '.', Comma: ',', Slash: '/', Backslash: '\\',
            BracketLeft: '[', BracketRight: ']', Quote: "'", Semicolon: ';',
            Minus: '-', Equal: '=', Backquote: '`', Space: 'Space',
            ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
            Enter: 'Enter', Tab: 'Tab', Escape: 'Esc', Backspace: 'Backspace', Delete: 'Delete'
        };
        let char = e.code.replace(/^Key/, "").replace(/^Digit/, "");
        if (codeMap[char]) {
            char = codeMap[char];
        } else if (codeMap[e.code]) {
            char = codeMap[e.code];
        } else {
            if (char.length > 1 && !codeMap[char] && !codeMap[e.code]) {
            }
        }
        if (char.length === 1) char = char.toUpperCase();
        parts.push(char);
        const shortcut = parts.join('+');
        hotkeyInputs[key].value = shortcut;
        hotkeyInputs[key].blur();
        saveHotkeys();
    };
    const saveHotkeys = async () => {
        const hotkeys = {
            highlight: hotkeyInputs.highlight.value,
            toggleWhiteboard: hotkeyInputs.whiteboard.value,
            toggleDrawings: hotkeyInputs.drawings.value,
            toggleHighlights: hotkeyInputs.highlights.value,
            toggleAll: hotkeyInputs.all.value
        };
        await chrome.storage.local.set({ hotkeys });
    };
    const loadData = async () => {
        const data = await chrome.storage.local.get([
            'extensionEnabled',
            'enableByDefault',
            'theme',
            'disabledSites',
            'enabledSites',
            'highlightShadowsEnabled',
            'highlightRounded',
            'selectionToolbarEnabled',
            'defaultHighlightColor',
            'defaultDrawColor',
            'drawingOpacity',
            'drawingBlendMode',
            'pages',
            'hotkeys'
        ]);
        globalEnableToggle.checked = data.extensionEnabled !== false;
        isEnabledByDefault = data.enableByDefault !== false;
        enableByDefaultToggle.checked = isEnabledByDefault;
        themeSelect.value = data.theme || 'system';
        applyTheme(data.theme || 'system');
        shadowsToggle.checked = data.highlightShadowsEnabled !== false;
        roundedToggle.checked = data.highlightRounded !== false;
        toolbarToggle.checked = data.selectionToolbarEnabled !== false;
        highlightColorInput.value = data.defaultHighlightColor || '#ffff00';
        drawColorInput.value = data.defaultDrawColor || '#ff0000';
        const dOpacity = data.drawingOpacity !== undefined ? data.drawingOpacity : 100;
        drawOpacityInput.value = dOpacity;
        drawOpacityVal.innerText = dOpacity;
        blendModeSelect.value = data.drawingBlendMode || 'screen';
        if (isEnabledByDefault) {
            renderSiteList(data.disabledSites || [], false);
        } else {
            renderSiteList(data.enabledSites || [], true);
        }
        const keys = data.hotkeys || {};
        hotkeyInputs.highlight.value = keys.highlight || 'Alt+H';
        hotkeyInputs.whiteboard.value = keys.toggleWhiteboard || 'Alt+Shift+W';
        hotkeyInputs.drawings.value = keys.toggleDrawings || 'Alt+Shift+D';
        hotkeyInputs.highlights.value = keys.toggleHighlights || 'Alt+Shift+H';
        hotkeyInputs.all.value = keys.toggleAll || 'Alt+Shift+A';
        allPages = data.pages || {};
        renderPages(pageSearch.value);
    };
    globalEnableToggle.onchange = async () => {
        await chrome.storage.local.set({ extensionEnabled: globalEnableToggle.checked });
    };
    enableByDefaultToggle.onchange = async () => {
        const newVal = enableByDefaultToggle.checked;
        await chrome.storage.local.set({ enableByDefault: newVal });
        loadData();
    };
    themeSelect.onchange = async () => {
        const theme = themeSelect.value;
        await chrome.storage.local.set({ theme });
        applyTheme(theme);
    };
    shadowsToggle.onchange = async () => {
        await chrome.storage.local.set({ highlightShadowsEnabled: shadowsToggle.checked });
    };
    roundedToggle.onchange = async () => {
        await chrome.storage.local.set({ highlightRounded: roundedToggle.checked });
    };
    toolbarToggle.onchange = async () => {
        await chrome.storage.local.set({ selectionToolbarEnabled: toolbarToggle.checked });
    };
    highlightColorInput.onchange = async () => {
        await chrome.storage.local.set({ defaultHighlightColor: highlightColorInput.value });
    };
    drawColorInput.onchange = async () => {
        await chrome.storage.local.set({ defaultDrawColor: drawColorInput.value });
    };
    drawOpacityInput.oninput = (e) => {
        drawOpacityVal.innerText = e.target.value;
    };
    drawOpacityInput.onchange = async () => {
        await chrome.storage.local.set({ drawingOpacity: parseInt(drawOpacityInput.value) });
    };
    blendModeSelect.onchange = async () => {
        await chrome.storage.local.set({ drawingBlendMode: blendModeSelect.value });
    };
    pageSearch.oninput = () => {
        renderPages(pageSearch.value);
    };
    exportBtn.onclick = async () => {
        const data = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marklet-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    };
    importBtn.onclick = () => importFile.click();
    importFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                await chrome.storage.local.clear();
                await chrome.storage.local.set(data);
                loadData();
                alert('Import successful!');
            } catch (err) {
                alert('Invalid file format');
            }
        };
        reader.readAsText(file);
    };
    resetBtn.onclick = async () => {
        if (confirm('Reset all settings to default? Highlights and drawings will effectively remain but settings will reset.')) {
            const currentPages = allPages;
            const defaults = {
                extensionEnabled: true,
                enableByDefault: true,
                theme: 'system',
                disabledSites: [],
                enabledSites: [],
                highlightShadowsEnabled: true,
                highlightRounded: true,
                selectionToolbarEnabled: true,
                defaultHighlightColor: '#ffff00',
                defaultDrawColor: '#ff0000',
                drawingOpacity: 75,
                drawingBlendMode: 'normal',
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
                pages: currentPages
            };
            await chrome.storage.local.set(defaults);
            loadData();
        }
    };
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.pages) {
            loadData();
        }
    });
    Object.keys(hotkeyInputs).forEach(key => {
        hotkeyInputs[key].onkeydown = (e) => recordHotkey(e, key);
        hotkeyInputs[key].onfocus = () => hotkeyInputs[key].select();
    });
    loadData();
});
