document.addEventListener('DOMContentLoaded', async () => {
    const globalEnableToggle = document.getElementById('global-enable-toggle');
    const enableByDefaultToggle = document.getElementById('enable-by-default-toggle');
    const themeSelect = document.getElementById('theme-select');
    const shadowsToggle = document.getElementById('shadows-toggle');
    const roundedToggle = document.getElementById('rounded-toggle');
    const readonlyHighlightToggle = document.getElementById('readonly-highlight-toggle');
    const toolbarToggle = document.getElementById('toolbar-toggle');
    const highlightColorInput = document.getElementById('default-highlight-color');
    const drawColorInput = document.getElementById('default-draw-color');
    const drawOpacityInput = document.getElementById('drawing-opacity');
    const drawOpacityVal = document.getElementById('draw-opacity-val');
    const blendModeSelect = document.getElementById('blend-mode-select');
    const siteListContainer = document.getElementById('disabled-sites-list');
    const siteListHeader = siteListContainer.parentElement.parentElement.querySelector('h2');
    const pagesList = document.getElementById('pages-list');
    const pagination = document.getElementById('pagination');
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
    let allPagesMetadata = [];
    let isEnabledByDefault = true;
    let currentPage = 1;
    const itemsPerPage = 5;
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
    const renderPagination = (totalItems, filter) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        let html = `<button class="btn secondary mini-btn" ${currentPage === 1 ? 'disabled' : ''} id="prev-page">Prev</button>`;
        html += `<span style="font-size: 13px; color: var(--text-muted);">Page ${currentPage} of ${totalPages}</span>`;
        html += `<button class="btn secondary mini-btn" ${currentPage === totalPages ? 'disabled' : ''} id="next-page">Next</button>`;
        pagination.innerHTML = html;
        pagination.querySelector('#prev-page').onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderPages(filter);
            }
        };
        pagination.querySelector('#next-page').onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPages(filter);
            }
        };
    };
    const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path></svg>`;
    const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>`;
    const GOTO_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"></path></svg>`;

    const renderPages = async (filter = '') => {
        const searchLower = filter.toLowerCase();
        let filteredEntries = [];
        let paged = [];
        
        const allEntries = await tinyIDB.entries();
        allEntries.sort((a, b) => (b[1].lastUpdated || 0) - (a[1].lastUpdated || 0));

        if (!filter) {
            filteredEntries = allEntries;
            const start = (currentPage - 1) * itemsPerPage;
            paged = filteredEntries.slice(start, start + itemsPerPage).map(([, p]) => p);
        } else {
            pagesList.innerHTML = `<div class="empty-state">Searching...</div>`;
            filteredEntries = allEntries.filter(([url, p]) => {
                if (!p || !url) return false;
                const hasHighlights = p.highlights && p.highlights.length > 0;
                const hasDrawings = p.drawings && p.drawings.length > 0;
                if (!hasHighlights && !hasDrawings) return false;
                return url.toLowerCase().includes(searchLower) ||
                       (hasHighlights && p.highlights.some(h => (h.text || '').toLowerCase().includes(searchLower)));
            });
            const start = (currentPage - 1) * itemsPerPage;
            paged = filteredEntries.slice(start, start + itemsPerPage).map(([, p]) => p);
        }
        
        allPagesMetadata = allEntries.map(([url]) => url);

        if (paged.length === 0) {
            pagesList.innerHTML = `<div class="empty-state">${filter ? 'No results match your search.' : 'No annotations found.'}</div>`;
            pagination.innerHTML = '';
            return;
        }
        
        pagesList.innerHTML = paged.map(page => {
            const firstHighlight = page.highlights && page.highlights.length > 0 ? page.highlights[0] : null;
            const textFragment = firstHighlight ? `#:~:text=${encodeURIComponent(firstHighlight.text.replace(/\s+/g, ' ').trim())}` : '';
            const pageUrlWithFragment = `${page.url}${textFragment}`;
            
            return `
                <div class="page-card" data-url="${page.url}">
                    <div class="page-header">
                        <div style="flex-grow: 1; min-width: 0;">
                            <a href="${page.url}" target="_blank" class="page-title" title="${page.url}">${truncateMiddle(page.url, 70)}</a>
                        </div>
                        <div class="page-actions">
                            <button class="btn secondary mini-btn btn-goto" data-url="${pageUrlWithFragment}">Go to Page</button>
                            <button class="btn danger mini-btn btn-delete-page" data-url="${page.url}">Delete</button>
                        </div>
                    </div>
                    <div class="highlights-summary">
                        ${(page.highlights || []).slice(0, 3).map(h => {
                            const hFragment = `#:~:text=${encodeURIComponent(h.text.replace(/\s+/g, ' ').trim())}`;
                            return `
                                <div class="highlight-snippet">
                                    <div class="highlight-indicator" style="background-color: ${h.color};"></div>
                                    <div class="highlight-text" title="${h.text || ''}">${h.text || 'No text'}</div>
                                    <div class="snippet-actions">
                                        <button class="snippet-btn btn-snippet-goto" title="Go To Highlight" data-url="${page.url}${hFragment}">${GOTO_ICON}</button>
                                        <button class="snippet-btn btn-snippet-copy" title="Copy Text" data-text="${h.text || ''}">${COPY_ICON}</button>
                                        <button class="snippet-btn delete btn-snippet-delete" title="Delete Highlight" data-id="${h.id}" data-url="${page.url}">${TRASH_ICON}</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                        <div class="summary-footer">
                            ${(page.highlights || []).length > 3 ? `<div class="summary-badge">+ ${(page.highlights || []).length - 3} more highlights</div>` : ''}
                            ${(page.drawings || []).length > 0 ? `<div class="summary-badge">🎨 ${page.drawings.length} drawing(s)</div>` : ''}
                            ${(page.highlights || []).length === 0 && (page.drawings || []).length === 0 ? '<div class="summary-badge">No annotations</div>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        pagesList.querySelectorAll('.btn-goto').forEach(btn => {
            btn.onclick = () => window.open(btn.dataset.url, '_blank');
        });

        pagesList.querySelectorAll('.btn-snippet-goto').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); window.open(btn.dataset.url, '_blank'); };
        });

        pagesList.querySelectorAll('.btn-snippet-copy').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(btn.dataset.text).then(() => {
                    const original = btn.innerHTML;
                    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    setTimeout(() => btn.innerHTML = original, 2000);
                });
            };
        });

        pagesList.querySelectorAll('.btn-snippet-delete').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm("Delete this highlight?")) {
                    const url = btn.dataset.url, id = btn.dataset.id;
                    const page = await tinyIDB.get(url);
                    if (page) {
                        page.highlights = page.highlights.filter(h => h.id !== id);
                        page.lastUpdated = Date.now();
                        if (page.highlights.length === 0 && (!page.drawings || page.drawings.length === 0)) await tinyIDB.remove(url);
                        else await tinyIDB.set(url, page);
                        renderPages(filter);
                    }
                }
            };
        });
        pagesList.querySelectorAll('.btn-delete-page').forEach(btn => {
            btn.onclick = async () => {
                if (confirm(`Delete all annotations for ${btn.dataset.url}?`)) {
                    const url = btn.dataset.url;
                    await tinyIDB.remove(url);
                    allPagesMetadata = allPagesMetadata.filter(u => u !== url);
                    const remainingFilteredCount = filteredEntries.length - 1;
                    const totalPages = Math.ceil(remainingFilteredCount / itemsPerPage);
                    if (currentPage > totalPages && currentPage > 1) currentPage--;
                    renderPages(pageSearch.value);
                }
            };
        });
        renderPagination(filteredEntries.length, filter);
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
            'allowReadonlyHighlight',
            'selectionToolbarEnabled',
            'defaultHighlightColor',
            'defaultDrawColor',
            'drawingOpacity',
            'drawingBlendMode',
            'hotkeys'
        ]);
        globalEnableToggle.checked = data.extensionEnabled !== false;
        isEnabledByDefault = data.enableByDefault !== false;
        enableByDefaultToggle.checked = isEnabledByDefault;
        themeSelect.value = data.theme || 'system';
        applyTheme(data.theme || 'system');
        shadowsToggle.checked = data.highlightShadowsEnabled !== false;
        roundedToggle.checked = data.highlightRounded !== false;
        readonlyHighlightToggle.checked = data.allowReadonlyHighlight !== false;
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
        
        allPagesMetadata = (await tinyIDB.keys());
        await renderPages(pageSearch.value);
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
    readonlyHighlightToggle.onchange = async () => {
        await chrome.storage.local.set({ allowReadonlyHighlight: readonlyHighlightToggle.checked });
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
        currentPage = 1;
        renderPages(pageSearch.value);
    };
    exportBtn.onclick = async () => {
        const data = await chrome.storage.local.get(null);
        const entries = await tinyIDB.entries();
        const pages = {};
        entries.forEach(([url, page]) => pages[url] = page);
        data.pages = pages;
        
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
                const pages = data.pages || {};
                delete data.pages;
                await chrome.storage.local.set(data);
                await tinyIDB.clear();
                for (const [url, page] of Object.entries(pages)) {
                    await tinyIDB.set(url, page);
                }
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
            const defaults = {
                extensionEnabled: true,
                enableByDefault: true,
                theme: 'system',
                disabledSites: [],
                enabledSites: [],
                highlightShadowsEnabled: true,
                highlightRounded: true,
                allowReadonlyHighlight: true,
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
                ]
            };
            await chrome.storage.local.clear();
            await chrome.storage.local.set(defaults);
            loadData();
        }
    };
    Object.keys(hotkeyInputs).forEach(key => {
        hotkeyInputs[key].onkeydown = (e) => recordHotkey(e, key);
        hotkeyInputs[key].onfocus = () => hotkeyInputs[key].select();
    });
    loadData();
});
