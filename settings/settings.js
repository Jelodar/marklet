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
    const urlHashModeSelect = document.getElementById('url-hash-mode');
    const urlHashSiteInput = document.getElementById('url-hash-site-input');
    const urlHashSiteModeSelect = document.getElementById('url-hash-site-mode');
    const urlHashSiteAddButton = document.getElementById('url-hash-site-add');
    const urlHashSiteList = document.getElementById('url-hash-site-list');
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
    let isEnabledByDefault = true;
    let currentPage = 1;
    const itemsPerPage = 5;
    const drawingDefaults = SharedUtils.getDefaultDrawingSettings();
    let urlNormalizationSettings = SharedUtils.getDefaultUrlNormalizationSettings();
    let pageEntriesCache = [];
    let pageSearchTimer = null;
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
    const renderEmptyState = (container, text) => {
        const state = document.createElement('div');
        state.className = 'empty-state';
        state.textContent = text;
        container.replaceChildren(state);
    };
    const getOpenableUrl = (value, fragment = '') => {
        try {
            const url = new URL(value, window.location.href);
            if (['javascript:', 'vbscript:'].includes(url.protocol)) return null;
            return `${url.toString()}${fragment}`;
        } catch (err) {
            return null;
        }
    };
    const openUrlInNewTab = (value) => {
        const safeUrl = getOpenableUrl(value);
        if (!safeUrl) return;
        const opened = window.open(safeUrl, '_blank', 'noopener');
        if (opened) opened.opener = null;
    };
    const createSnippetButton = ({ className, title, icon, disabled = false, onClick }) => {
        const button = document.createElement('button');
        button.className = className;
        button.title = title;
        button.disabled = disabled;
        button.innerHTML = icon;
        if (onClick) button.onclick = onClick;
        return button;
    };
    const renderSiteList = (sites, isWhitelist) => {
        siteListHeader.textContent = isWhitelist ? "Enabled Sites (Exceptions)" : "Disabled Sites";
        if (!sites || sites.length === 0) {
            renderEmptyState(siteListContainer, `No ${isWhitelist ? 'enabled' : 'disabled'} sites.`);
            return;
        }
        const fragment = document.createDocumentFragment();
        sites.forEach((site) => {
            const item = document.createElement('div');
            item.className = 'site-item';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '8px';
            item.style.borderBottom = '1px solid var(--border-color)';

            const label = document.createElement('span');
            label.textContent = site;

            const button = document.createElement('button');
            button.className = 'btn danger mini-btn btn-remove-site';
            button.textContent = 'Remove';
            button.onclick = async () => {
                const key = isWhitelist ? 'enabledSites' : 'disabledSites';
                const s = await chrome.storage.local.get([key]);
                const newSites = (s[key] || []).filter(x => x !== site);
                await chrome.storage.local.set({ [key]: newSites });
                renderSiteList(newSites, isWhitelist);
            };
            item.append(label, button);
            fragment.appendChild(item);
        });
        siteListContainer.replaceChildren(fragment);
    };
    const persistUrlNormalizationSettings = async () => {
        SharedUtils.setUrlNormalizationSettings(urlNormalizationSettings);
        await chrome.storage.local.set(SharedUtils.toUrlNormalizationStorage(urlNormalizationSettings));
    };
    const renderUrlHashSiteList = () => {
        const siteHashModes = urlNormalizationSettings.siteHashModes || {};
        const hosts = Object.keys(siteHashModes).sort((a, b) => a.localeCompare(b));
        if (hosts.length === 0) {
            renderEmptyState(urlHashSiteList, 'No site overrides.');
            return;
        }
        const fragment = document.createDocumentFragment();
        hosts.forEach((hostname) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.gap = '12px';
            item.style.padding = '8px 0';
            item.style.borderBottom = '1px solid var(--border-color)';

            const info = document.createElement('div');
            info.style.minWidth = '0';

            const title = document.createElement('div');
            title.textContent = hostname;
            title.style.fontWeight = '600';

            const hint = document.createElement('div');
            hint.className = 'setting-hint';
            hint.textContent = siteHashModes[hostname] === 'include' ? 'Hash kept for this site' : 'Hash ignored for this site';

            info.append(title, hint);

            const button = document.createElement('button');
            button.className = 'btn danger mini-btn';
            button.type = 'button';
            button.textContent = 'Remove';
            button.onclick = async () => {
                delete urlNormalizationSettings.siteHashModes[hostname];
                await persistUrlNormalizationSettings();
                renderUrlHashSiteList();
            };

            item.append(info, button);
            fragment.appendChild(item);
        });
        urlHashSiteList.replaceChildren(fragment);
    };
    const saveUrlHashSiteRule = async () => {
        const hostname = SharedUtils.normalizeHostname(urlHashSiteInput.value);
        if (!hostname) {
            alert('Enter a valid hostname or URL');
            return;
        }
        urlNormalizationSettings.siteHashModes = {
            ...(urlNormalizationSettings.siteHashModes || {}),
            [hostname]: urlHashSiteModeSelect.value
        };
        urlHashSiteInput.value = '';
        await persistUrlNormalizationSettings();
        renderUrlHashSiteList();
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
    const refreshPageEntries = async () => {
        pageEntriesCache = (await tinyIDB.entries())
            .map(([url, page]) => [url, SharedUtils.normalizePageData(page, url)])
            .sort((a, b) => (b[1].lastUpdated || 0) - (a[1].lastUpdated || 0));
    };

    const renderPages = (filter = '') => {
        const searchLower = filter.toLowerCase();
        let filteredEntries = [];
        let paged = [];

        if (!filter) {
            filteredEntries = pageEntriesCache;
            const start = (currentPage - 1) * itemsPerPage;
            paged = filteredEntries.slice(start, start + itemsPerPage).map(([, p]) => p);
        } else {
            renderEmptyState(pagesList, 'Searching...');
            filteredEntries = pageEntriesCache.filter(([url, p]) => {
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

        if (paged.length === 0) {
            renderEmptyState(pagesList, filter ? 'No results match your search.' : 'No annotations found.');
            pagination.innerHTML = '';
            return;
        }
        const fragment = document.createDocumentFragment();

        paged.forEach((page) => {
            const firstHighlight = page.highlights && page.highlights.length > 0 ? page.highlights[0] : null;
            const firstHighlightText = firstHighlight?.text ? firstHighlight.text.replace(/\s+/g, ' ').trim() : '';
            const pageUrl = getOpenableUrl(page.url);
            const pageUrlWithFragment = pageUrl && firstHighlightText ? `${pageUrl}#:~:text=${encodeURIComponent(firstHighlightText)}` : pageUrl;

            const pageCard = document.createElement('div');
            pageCard.className = 'page-card';
            pageCard.dataset.url = page.url;

            const pageHeader = document.createElement('div');
            pageHeader.className = 'page-header';

            const titleWrap = document.createElement('div');
            titleWrap.style.flexGrow = '1';
            titleWrap.style.minWidth = '0';

            const titleText = truncateMiddle(page.url, 70);
            if (pageUrl) {
                const titleLink = document.createElement('a');
                titleLink.href = pageUrl;
                titleLink.target = '_blank';
                titleLink.className = 'page-title';
                titleLink.title = page.url;
                titleLink.textContent = titleText;
                titleWrap.appendChild(titleLink);
            } else {
                const titleLabel = document.createElement('span');
                titleLabel.className = 'page-title';
                titleLabel.title = page.url;
                titleLabel.textContent = titleText;
                titleWrap.appendChild(titleLabel);
            }

            const pageActions = document.createElement('div');
            pageActions.className = 'page-actions';

            const gotoButton = document.createElement('button');
            gotoButton.className = 'btn secondary mini-btn btn-goto';
            gotoButton.textContent = 'Go to Page';
            gotoButton.disabled = !pageUrlWithFragment;
            gotoButton.onclick = () => {
                openUrlInNewTab(pageUrlWithFragment);
            };

            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn danger mini-btn btn-delete-page';
            deleteButton.textContent = 'Delete';
            deleteButton.onclick = async () => {
                if (confirm(`Delete all annotations for ${page.url}?`)) {
                    await tinyIDB.remove(page.url);
                    await refreshPageEntries();
                    const remainingFilteredCount = filteredEntries.length - 1;
                    const totalPages = Math.ceil(remainingFilteredCount / itemsPerPage);
                    if (currentPage > totalPages && currentPage > 1) currentPage--;
                    renderPages(pageSearch.value);
                }
            };

            pageActions.append(gotoButton, deleteButton);
            pageHeader.append(titleWrap, pageActions);

            const summary = document.createElement('div');
            summary.className = 'highlights-summary';

            (page.highlights || []).slice(0, 3).forEach((highlight) => {
                const snippet = document.createElement('div');
                snippet.className = 'highlight-snippet';

                const indicator = document.createElement('div');
                indicator.className = 'highlight-indicator';
                indicator.style.backgroundColor = highlight.color || 'transparent';

                const text = document.createElement('div');
                const textValue = highlight.text || 'No text';
                text.className = 'highlight-text';
                text.title = textValue;
                text.textContent = textValue;

                const actions = document.createElement('div');
                actions.className = 'snippet-actions';

                const highlightText = highlight.text ? highlight.text.replace(/\s+/g, ' ').trim() : '';
                const highlightUrl = pageUrl && highlightText ? `${pageUrl}#:~:text=${encodeURIComponent(highlightText)}` : null;
                const gotoSnippetButton = createSnippetButton({
                    className: 'snippet-btn btn-snippet-goto',
                    title: 'Go To Highlight',
                    icon: GOTO_ICON,
                    disabled: !highlightUrl,
                    onClick: (e) => {
                        e.stopPropagation();
                        openUrlInNewTab(highlightUrl);
                    }
                });
                const copySnippetButton = createSnippetButton({
                    className: 'snippet-btn btn-snippet-copy',
                    title: 'Copy Text',
                    icon: COPY_ICON,
                    onClick: (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(highlight.text || '').then(() => {
                            const original = copySnippetButton.innerHTML;
                            copySnippetButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                            setTimeout(() => copySnippetButton.innerHTML = original, 2000);
                        });
                    }
                });
                const deleteSnippetButton = createSnippetButton({
                    className: 'snippet-btn delete btn-snippet-delete',
                    title: 'Delete Highlight',
                    icon: TRASH_ICON,
                    onClick: async (e) => {
                        e.stopPropagation();
                        if (confirm("Delete this highlight?")) {
                            const storedPage = SharedUtils.normalizePageData(await tinyIDB.get(page.url), page.url);
                            storedPage.highlights = storedPage.highlights.filter(h => h.id !== highlight.id);
                            storedPage.lastUpdated = Date.now();
                            if (storedPage.highlights.length === 0 && storedPage.drawings.length === 0) await tinyIDB.remove(page.url);
                            else await tinyIDB.set(page.url, storedPage);
                            await refreshPageEntries();
                            renderPages(filter);
                        }
                    }
                });

                actions.append(gotoSnippetButton, copySnippetButton, deleteSnippetButton);
                snippet.append(indicator, text, actions);
                summary.appendChild(snippet);
            });

            const summaryFooter = document.createElement('div');
            summaryFooter.className = 'summary-footer';

            if ((page.highlights || []).length > 3) {
                const moreBadge = document.createElement('div');
                moreBadge.className = 'summary-badge';
                moreBadge.textContent = `+ ${(page.highlights || []).length - 3} more highlights`;
                summaryFooter.appendChild(moreBadge);
            }
            if ((page.drawings || []).length > 0) {
                const drawingsBadge = document.createElement('div');
                drawingsBadge.className = 'summary-badge';
                drawingsBadge.textContent = `${page.drawings.length} drawing(s)`;
                summaryFooter.appendChild(drawingsBadge);
            }
            if ((page.highlights || []).length === 0 && (page.drawings || []).length === 0) {
                const emptyBadge = document.createElement('div');
                emptyBadge.className = 'summary-badge';
                emptyBadge.textContent = 'No annotations';
                summaryFooter.appendChild(emptyBadge);
            }

            summary.appendChild(summaryFooter);
            pageCard.append(pageHeader, summary);
            fragment.appendChild(pageCard);
        });

        pagesList.replaceChildren(fragment);
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
        let char = (e.code || e.key || "").replace(/^Key/, "").replace(/^Digit/, "");
        if (codeMap[char]) {
            char = codeMap[char];
        } else if (e.code && codeMap[e.code]) {
            char = codeMap[e.code];
        } else if (e.key && codeMap[e.key]) {
            char = codeMap[e.key];
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
            'urlHashMode',
            'urlHashSiteModes',
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
        urlNormalizationSettings = SharedUtils.setUrlNormalizationSettings(data);
        urlHashModeSelect.value = urlNormalizationSettings.defaultHashMode;
        renderUrlHashSiteList();
        shadowsToggle.checked = data.highlightShadowsEnabled !== false;
        roundedToggle.checked = data.highlightRounded !== false;
        readonlyHighlightToggle.checked = data.allowReadonlyHighlight !== false;
        toolbarToggle.checked = data.selectionToolbarEnabled !== false;
        highlightColorInput.value = data.defaultHighlightColor || '#ffff00';
        drawColorInput.value = data.defaultDrawColor || '#ff0000';
        const dOpacity = data.drawingOpacity !== undefined ? data.drawingOpacity : drawingDefaults.opacity;
        drawOpacityInput.value = dOpacity;
        drawOpacityVal.innerText = dOpacity;
        blendModeSelect.value = data.drawingBlendMode || drawingDefaults.blendMode;
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
        
        await refreshPageEntries();
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
    urlHashModeSelect.onchange = async () => {
        urlNormalizationSettings.defaultHashMode = urlHashModeSelect.value;
        await persistUrlNormalizationSettings();
        renderUrlHashSiteList();
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
    urlHashSiteAddButton.onclick = saveUrlHashSiteRule;
    urlHashSiteInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveUrlHashSiteRule();
        }
    };
    pageSearch.oninput = () => {
        currentPage = 1;
        if (pageSearchTimer) clearTimeout(pageSearchTimer);
        pageSearchTimer = setTimeout(() => renderPages(pageSearch.value), 120);
    };
    exportBtn.onclick = async () => {
        const data = await chrome.storage.local.get(null);
        const pages = {};
        pageEntriesCache.forEach(([url, page]) => pages[url] = SharedUtils.normalizePageData(page, url));
        data.pages = pages;
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `marklet-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    };
    importBtn.onclick = () => importFile.click();
    importFile.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid import payload');
                const data = { ...parsed };
                const rawPages = data.pages && typeof data.pages === 'object' && !Array.isArray(data.pages) ? data.pages : {};
                const pages = Object.entries(rawPages).reduce((acc, [url, page]) => {
                    if (typeof url === 'string' && url) acc[url] = SharedUtils.normalizePageData(page, url);
                    return acc;
                }, {});
                await tinyIDB.clear();
                for (const [url, page] of Object.entries(pages)) {
                    await tinyIDB.set(url, page);
                }
                delete data.pages;
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
            const defaults = {
                extensionEnabled: true,
                enableByDefault: true,
                theme: 'system',
                disabledSites: [],
                enabledSites: [],
                urlHashMode: SharedUtils.getDefaultUrlNormalizationSettings().defaultHashMode,
                urlHashSiteModes: {},
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
