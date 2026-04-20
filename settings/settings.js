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
    const urlHashResetButton = document.getElementById('url-hash-reset');
    const urlHashSiteList = document.getElementById('url-hash-site-list');
    const urlHashSitePagination = document.getElementById('url-hash-site-pagination');
    const siteListContainer = document.getElementById('disabled-sites-list');
    const siteListPagination = document.getElementById('disabled-sites-pagination');
    const disabledSiteInput = document.getElementById('disabled-site-input');
    const disabledSiteAddButton = document.getElementById('disabled-site-add');
    const siteListResetButton = document.getElementById('site-list-reset');
    const siteListHeader = document.getElementById('site-list-title');
    const pagesList = document.getElementById('pages-list');
    const annotationPaginationTop = document.getElementById('annotation-pagination-top') || document.getElementById('pagination');
    const annotationPaginationBottom = document.getElementById('annotation-pagination-bottom') || document.getElementById('pagination');
    const pageSearch = document.getElementById('page-search');
    const exportBtn = document.getElementById('export-btn');
    const exportAnnotationsToggle = document.getElementById('export-annotations-toggle');
    const exportSettingsToggle = document.getElementById('export-settings-toggle');
    const importBtn = document.getElementById('import-btn');
    const importSettingsToggle = document.getElementById('import-settings-toggle');
    const importFile = document.getElementById('import-file');
    const dataFeedback = document.getElementById('data-feedback');
    const clearAnnotationsBtn = document.getElementById('clear-annotations-btn');
    const resetBtn = document.getElementById('reset-defaults-btn');
    const resetGeneralBtn = document.getElementById('reset-general-btn');
    const resetHotkeysBtn = document.getElementById('reset-hotkeys-btn');
    const resetHighlightsBtn = document.getElementById('reset-highlights-btn');
    const resetDrawingsBtn = document.getElementById('reset-drawings-btn');

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTitle = document.getElementById('loading-title');
    const loadingText = document.getElementById('loading-text');
    const loadingProgress = document.getElementById('loading-progress');
    const loadingCancel = document.getElementById('loading-cancel');
    const hotkeyInputs = {
        highlight: document.getElementById('hotkey-highlight'),
        whiteboard: document.getElementById('hotkey-whiteboard'),
        drawings: document.getElementById('hotkey-drawings'),
        highlights: document.getElementById('hotkey-highlights'),
        all: document.getElementById('hotkey-all')
    };

    const annotationState = {
        page: 1,
        pageSize: 8,
        total: 0,
        items: [],
        search: '',
        requestId: 0,
        timer: null,
        token: null,
        expanded: new Set(),
        showAllHighlights: new Set()
    };
    const siteRuleState = { page: 1, pageSize: 8 };
    const siteListState = { page: 1, pageSize: 8 };
    const busyState = { token: null, onCancel: null };
    const drawingDefaults = SharedUtils.getDefaultDrawingSettings();
    let isEnabledByDefault = true;
    let urlNormalizationSettings = SharedUtils.getDefaultUrlNormalizationSettings();
    const normalizeStoredPage = (page, url = '') => SharedUtils.normalizePageData(page, url);
    const countPageContent = (pages) => Object.values(pages).reduce((totals, page) => {
        const normalized = normalizeStoredPage(page);
        totals.pages += 1;
        totals.highlights += normalized.highlights.length;
        totals.drawings += normalized.drawings.length;
        return totals;
    }, { pages: 0, highlights: 0, drawings: 0 });
    const formatCount = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
    const pageStore = PageStorage;
    const exportableSettingKeys = SharedUtils.getExportableSettingKeys();
    const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"></path></svg>`;
    const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>`;
    const GOTO_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"></path></svg>`;

    const applyTheme = (theme) => {
        SharedUtils.applyTheme(theme);
    };

    const createCancelToken = () => ({ cancelled: false });
    const cancelToken = (token) => {
        if (token) token.cancelled = true;
    };

    const showLoading = ({ title, text, progress = 0, cancelable = true, onCancel = null }) => {
        busyState.onCancel = onCancel;
        if (!loadingOverlay) return;
        loadingOverlay.hidden = false;
        if (loadingTitle) loadingTitle.textContent = title;
        if (loadingText) loadingText.textContent = text;
        if (loadingProgress) loadingProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        if (loadingCancel) {
            loadingCancel.hidden = !cancelable;
            loadingCancel.disabled = !cancelable;
        }
    };

    const updateLoading = ({ title, text, progress }) => {
        if (title && loadingTitle) loadingTitle.textContent = title;
        if (text && loadingText) loadingText.textContent = text;
        if (typeof progress === 'number' && loadingProgress) {
            loadingProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        }
    };

    const hideLoading = () => {
        busyState.onCancel = null;
        if (!loadingOverlay) return;
        loadingOverlay.hidden = true;
        if (loadingProgress) loadingProgress.style.width = '0%';
    };

    const showListLoading = (container, message) => {
        if (!container) return;
        hideListLoading(container);
        const overlay = document.createElement('div');
        overlay.className = 'list-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-icon"></div>
                <span>${message}</span>
            </div>
        `;
        container.appendChild(overlay);
    };

    const hideListLoading = (container) => {
        if (!container) return;
        const overlays = container.querySelectorAll('.list-overlay');
        overlays.forEach(o => o.remove());
    };

    if (loadingCancel) {
        loadingCancel.onclick = () => {
            if (typeof busyState.onCancel === 'function') busyState.onCancel();
        };
    }

    const truncateMiddle = (str, maxLen) => {
        if (!str || str.length <= maxLen) return str;
        const front = Math.ceil((maxLen - 3) / 2);
        const back = Math.floor((maxLen - 3) / 2);
        return str.substring(0, front) + '...' + str.substring(str.length - back);
    };

    const renderEmptyState = (container, text) => {
        if (!container) return;
        const state = document.createElement('div');
        state.className = 'empty-state';
        state.textContent = text;
        container.replaceChildren(state);
    };

    const setDataFeedback = (text) => {
        if (!dataFeedback) return;
        if (!text) {
            dataFeedback.hidden = true;
            dataFeedback.textContent = '';
            return;
        }
        dataFeedback.hidden = false;
        dataFeedback.textContent = text;
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

    const clampPage = (page, totalItems, pageSize) => {
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        return Math.min(Math.max(1, page), totalPages);
    };

    const getPageRange = (currentPage, totalPages) => {
        const pages = new Set([currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2]);
        return [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
    };

    const setPagerEmpty = (container) => {
        if (!container) return;
        container.classList.add('is-empty');
        const placeholder = document.createElement('span');
        placeholder.className = 'pagination-status';
        placeholder.textContent = ' ';
        container.replaceChildren(placeholder);
    };

    const renderPaginationControls = (container, totalItems, pageSize, currentPage, onChange) => {
        if (!container) return;
        const totalPages = Math.ceil(totalItems / pageSize);
        if (totalPages <= 1) {
            setPagerEmpty(container);
            return;
        }
        container.classList.remove('is-empty');
        const fragment = document.createDocumentFragment();

        const status = document.createElement('span');
        status.className = 'pagination-status';
        status.textContent = `Page ${currentPage} of ${totalPages} • ${formatCount(totalItems, 'item')}`;
        fragment.appendChild(status);

        const group = document.createElement('div');
        group.className = 'pagination-group';

        const appendButton = (label, nextPage, disabled, extraClass = '') => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `pagination-btn ${extraClass}`.trim();
            button.textContent = label;
            button.disabled = disabled;
            button.onclick = () => onChange(nextPage);
            group.appendChild(button);
        };

        appendButton('«', 1, currentPage === 1, 'first-btn');
        appendButton('‹', currentPage - 1, currentPage === 1, 'prev-btn');

        getPageRange(currentPage, totalPages).forEach((pageNumber) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `pagination-page${pageNumber === currentPage ? ' is-current' : ''}`;
            button.textContent = String(pageNumber);
            button.disabled = pageNumber === currentPage;
            button.onclick = () => onChange(pageNumber);
            group.appendChild(button);
        });

        appendButton('›', currentPage + 1, currentPage === totalPages, 'next-btn');
        appendButton('»', totalPages, currentPage === totalPages, 'last-btn');

        fragment.appendChild(group);
        container.replaceChildren(fragment);
    };

    const persistUrlNormalizationSettings = async () => {
        SharedUtils.setUrlNormalizationSettings(urlNormalizationSettings);
        await chrome.storage.local.set(SharedUtils.toUrlNormalizationStorage(urlNormalizationSettings));
    };

    const renderSiteItems = (items, container, paginationContainer, state, emptyText, renderItem) => {
        if (!container) return;
        if (!items || items.length === 0) {
            renderEmptyState(container, emptyText);
            setPagerEmpty(paginationContainer);
            return;
        }
        state.page = clampPage(state.page, items.length, state.pageSize);
        const start = (state.page - 1) * state.pageSize;
        const fragment = document.createDocumentFragment();
        items.slice(start, start + state.pageSize).forEach((item) => {
            fragment.appendChild(renderItem(item));
        });
        container.replaceChildren(fragment);
        renderPaginationControls(paginationContainer, items.length, state.pageSize, state.page, (nextPage) => {
            state.page = nextPage;
            renderSiteItems(items, container, paginationContainer, state, emptyText, renderItem);
        });
    };

    const renderSiteList = (sites, isWhitelist) => {
        if (siteListHeader) siteListHeader.textContent = isWhitelist ? 'Enabled Sites (Exceptions)' : 'Disabled Sites';
        renderSiteItems(sites || [], siteListContainer, siteListPagination, siteListState, `No ${isWhitelist ? 'enabled' : 'disabled'} sites.`, (site) => {
            const item = document.createElement('div');
            item.className = 'site-item';

            const label = document.createElement('span');
            label.className = 'site-item-label';
            label.textContent = site;

            const button = document.createElement('button');
            button.className = 'btn danger mini-btn btn-remove-site';
            button.type = 'button';
            button.textContent = 'Remove';
            button.onclick = async () => {
                const key = isWhitelist ? 'enabledSites' : 'disabledSites';
                const data = await chrome.storage.local.get([key]);
                const nextSites = (data[key] || []).filter((value) => value !== site);
                await chrome.storage.local.set({ [key]: nextSites });
                renderSiteList(nextSites, isWhitelist);
            };

            item.append(label, button);
            return item;
        });
    };

    const renderUrlHashSiteList = () => {
        const siteHashModes = urlNormalizationSettings.siteHashModes || {};
        const hosts = Object.keys(siteHashModes).sort((a, b) => a.localeCompare(b));
        renderSiteItems(hosts, urlHashSiteList, urlHashSitePagination, siteRuleState, 'No site overrides.', (hostname) => {
            const item = document.createElement('div');
            item.className = 'site-item';

            const info = document.createElement('div');
            info.className = 'site-item-label';

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
            return item;
        });
    };

    const saveUrlHashSiteRule = async () => {
        const hostname = SharedUtils.normalizeHostname(urlHashSiteInput?.value || '');
        if (!hostname) {
            await SharedUI.alert('Invalid Input', 'Please enter a valid hostname (e.g., example.com).');
            return;
        }
        urlNormalizationSettings.siteHashModes = {
            ...(urlNormalizationSettings.siteHashModes || {}),
            [hostname]: urlHashSiteModeSelect.value
        };
        siteRuleState.page = 1;
        urlHashSiteInput.value = '';
        await persistUrlNormalizationSettings();
        renderUrlHashSiteList();
    };

    const updateAnnotationPagination = () => {
        renderPaginationControls(annotationPaginationTop, annotationState.total, annotationState.pageSize, annotationState.page, async (nextPage) => {
            annotationState.page = nextPage;
            await loadAnnotations();
        });
        renderPaginationControls(annotationPaginationBottom, annotationState.total, annotationState.pageSize, annotationState.page, async (nextPage) => {
            annotationState.page = nextPage;
            await loadAnnotations();
        });
    };

    const renderAnnotationCards = () => {
        if (!pagesList) return;
        if (annotationState.items.length === 0) {
            renderEmptyState(pagesList, annotationState.search ? 'No results match your search.' : 'No annotations found.');
            updateAnnotationPagination();
            return;
        }

        const fragment = document.createDocumentFragment();

        annotationState.items.forEach((page) => {
            const pageUrl = getOpenableUrl(page.url);
            const firstHighlight = page.highlights[0] || null;
            const firstHighlightText = firstHighlight?.text ? firstHighlight.text.replace(/\s+/g, ' ').trim() : '';
            const pageUrlWithFragment = pageUrl && firstHighlightText ? `${pageUrl}#:~:text=${encodeURIComponent(firstHighlightText)}` : pageUrl;
            const isExpanded = annotationState.expanded.has(page.url);

            const pageCard = SharedUI.el('section', 'page-card', {
                attrs: { 'data-url': page.url }
            });

            const titleText = truncateMiddle(page.url, 70);
            const titleEl = pageUrl 
                ? SharedUI.el('a', 'page-title', { href: pageUrl, target: '_blank', title: page.url, text: titleText })
                : SharedUI.span('page-title', { title: page.url, text: titleText });

            SharedUI.div('page-header', { parent: pageCard }, [
                SharedUI.div('flex-1 min-w-0', [titleEl]),
                SharedUI.div('page-actions', [
                    SharedUI.button('btn secondary mini-btn btn-goto', {
                        type: 'button',
                        text: 'Go to Page',
                        disabled: !pageUrlWithFragment,
                        on: { click: () => openUrlInNewTab(pageUrlWithFragment) }
                    }),
                    SharedUI.button('btn danger mini-btn btn-delete-page', {
                        type: 'button',
                        text: 'Delete',
                        on: { click: async () => {
                            if (await SharedUI.confirm('Delete Annotations', `Delete all annotations for ${page.url}?`, { isDanger: true })) {
                                await PageStorage.remove(page.url);
                                annotationState.expanded.delete(page.url);
                                await loadAnnotations();
                            }
                        }}
                    })
                ])
            ]);

            SharedUI.div('page-meta', { parent: pageCard }, [
                SharedUI.div('flex gap-8', [
                    SharedUI.div('summary-badge', { text: `${page.highlightCount} highlight${page.highlightCount === 1 ? '' : 's'}` }),
                    SharedUI.div('summary-badge', { text: `${page.drawingCount} drawing${page.drawingCount === 1 ? '' : 's'}` })
                ]),
                SharedUI.button(`btn secondary mini-btn page-toggle ${isExpanded ? 'active' : ''}`, {
                    type: 'button',
                    text: isExpanded ? 'Hide Details' : 'Show Details',
                    on: { click: () => {
                        if (annotationState.expanded.has(page.url)) annotationState.expanded.delete(page.url);
                        else annotationState.expanded.add(page.url);
                        renderAnnotationCards();
                    }}
                })
            ]);

            if (isExpanded) {
                const body = document.createElement('div');
                body.className = 'page-body';

                const summary = document.createElement('div');
                summary.className = 'highlights-summary';

                if (page.highlights.length === 0) {
                    const emptyBadge = document.createElement('div');
                    emptyBadge.className = 'summary-badge';
                    emptyBadge.textContent = page.drawingCount > 0 ? 'This page only has drawings.' : 'No annotations.';
                    summary.appendChild(emptyBadge);
                }

                const highlightLimit = 10;
                const isShowingAll = annotationState.showAllHighlights.has(page.url);
                const highlightsToRender = isShowingAll ? page.highlights : page.highlights.slice(0, highlightLimit);

                highlightsToRender.forEach((highlight) => {
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
                        onClick: (event) => {
                            event.stopPropagation();
                            openUrlInNewTab(highlightUrl);
                        }
                    });
                    const copySnippetButton = createSnippetButton({
                        className: 'snippet-btn btn-snippet-copy',
                        title: 'Copy Text',
                        icon: COPY_ICON,
                        onClick: async (event) => {
                            event.stopPropagation();
                            try {
                                await navigator.clipboard.writeText(highlight.text || '');
                                const original = copySnippetButton.innerHTML;
                                copySnippetButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                                setTimeout(() => {
                                    copySnippetButton.innerHTML = original;
                                }, 1600);
                            } catch (error) {
                                SharedUI.toast('Could not copy highlight text.');
                            }
                        }
                    });
                    const deleteSnippetButton = createSnippetButton({
                        className: 'snippet-btn delete btn-snippet-delete',
                        title: 'Delete Highlight',
                        icon: TRASH_ICON,
                        onClick: async (event) => {
                            event.stopPropagation();
                                if (await SharedUI.confirm('Delete Highlight', 'Delete this highlight?', { isDanger: true })) {
                                    await PageStorage.update(page.url, 'delete_highlight', { id: highlight.id });
                                    await loadAnnotations();
                                }
                        }
                    });

                    actions.append(gotoSnippetButton, copySnippetButton, deleteSnippetButton);
                    snippet.append(indicator, text, actions);
                    summary.appendChild(snippet);
                });

                if (page.highlightCount > highlightLimit) {
                    const footer = document.createElement('div');
                    footer.className = 'summary-footer';
                    footer.style.display = 'flex';
                    footer.style.justifyContent = 'space-between';
                    footer.style.alignItems = 'center';

                    const badge = document.createElement('div');
                    badge.className = 'summary-badge';
                    badge.textContent = isShowingAll ? `Showing all ${page.highlightCount} highlights` : `Showing ${highlightLimit} of ${page.highlightCount} highlights`;
                    
                    const toggleBtn = document.createElement('button');
                    toggleBtn.type = 'button';
                    toggleBtn.className = 'btn secondary mini-btn';
                    toggleBtn.textContent = isShowingAll ? 'Show Less' : 'Show All';
                    toggleBtn.onclick = () => {
                        if (isShowingAll) annotationState.showAllHighlights.delete(page.url);
                        else annotationState.showAllHighlights.add(page.url);
                        renderAnnotationCards();
                    };

                    footer.append(badge, toggleBtn);
                    summary.appendChild(footer);
                } else if (page.highlightCount > 3) {
                    const footer = document.createElement('div');
                    footer.className = 'summary-footer';

                    const badge = document.createElement('div');
                    badge.className = 'summary-badge';
                    badge.textContent = `Showing all ${page.highlightCount} highlights`;
                    footer.appendChild(badge);

                    summary.appendChild(footer);
                }

                body.appendChild(summary);
                pageCard.appendChild(body);
            }

            fragment.appendChild(pageCard);
        });

        pagesList.replaceChildren(fragment);
        updateAnnotationPagination();
    };

    const runOverlayTask = async ({ title, initialText, total = 0, task }) => {
        const token = createCancelToken();
        busyState.token = token;
        showLoading({
            title,
            text: initialText,
            progress: total > 0 ? 0 : 20,
            cancelable: true,
            onCancel: () => cancelToken(token)
        });
        try {
            return await task({
                token,
                setProgress: (processed, text) => {
                    const progress = total > 0 ? (processed / total) * 100 : 0;
                    updateLoading({ text, progress });
                }
            });
        } finally {
            if (busyState.token === token) busyState.token = null;
            hideLoading();
        }
    };

    const loadAnnotations = async ({ forceOverlay = false } = {}) => {
        annotationState.search = (pageSearch?.value || '').trim();
        annotationState.page = clampPage(annotationState.page, Math.max(annotationState.total, annotationState.pageSize), annotationState.pageSize);
        cancelToken(annotationState.token);
        const token = createCancelToken();
        const requestId = ++annotationState.requestId;
        annotationState.token = token;

        const renderLoadingState = () => {
            if (!pagesList) return;
            renderEmptyState(pagesList, annotationState.search ? 'Searching...' : 'Loading annotations...');
        };

        try {
            const hasItems = annotationState.items.length > 0;
            const useOverlay = forceOverlay || !!annotationState.search;
            const useListOverlay = hasItems && !useOverlay;
            
            if (useOverlay) {
                const totalPages = await pageStore.count();
                showLoading({
                    title: annotationState.search ? 'Searching annotations' : 'Loading annotations',
                    text: totalPages > 0 ? `Scanning 0 of ${totalPages} pages...` : 'Scanning pages...',
                    progress: 0,
                    cancelable: true,
                    onCancel: () => cancelToken(token)
                });
            } else if (useListOverlay) {
                showListLoading(pagesList, annotationState.search ? 'Searching...' : 'Loading annotations...');
            } else {
                renderLoadingState();
            }

            const totalPages = useOverlay ? await pageStore.count() : 0; // Keep for progress calculation if needed
            const result = await pageStore.queryPages({
                search: annotationState.search,
                offset: (annotationState.page - 1) * annotationState.pageSize,
                limit: annotationState.pageSize,
                cancelToken: token,
                progress: useOverlay ? ({ processed }) => {
                    const progress = totalPages > 0 ? (processed / totalPages) * 100 : 0;
                    updateLoading({
                        text: totalPages > 0 ? `Scanning ${Math.min(processed, totalPages)} of ${totalPages} pages...` : 'Scanning pages...',
                        progress
                    });
                } : null
            });

            if (annotationState.token !== token || requestId !== annotationState.requestId || token.cancelled) return;

            const maxPage = clampPage(annotationState.page, result.total || annotationState.pageSize, annotationState.pageSize);
            if (annotationState.page !== maxPage) {
                annotationState.page = maxPage;
                await loadAnnotations({ forceOverlay });
                return;
            }

            annotationState.total = result.total;
            annotationState.items = result.items;
            hideListLoading(pagesList);
            renderAnnotationCards();
        } catch (error) {
            if (error?.name !== 'AbortError') {
                hideListLoading(pagesList);
                renderEmptyState(pagesList, 'Could not load annotations.');
                updateAnnotationPagination();
                await SharedUI.alert('Error', 'Could not load annotations.');
            }
        } finally {
            if (annotationState.token === token) annotationState.token = null;
            hideLoading();
            hideListLoading(pagesList);
        }
    };

    const recordHotkey = (event, key) => {
        event.preventDefault();
        event.stopPropagation();
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (event.metaKey) parts.push('Meta');
        
        const { physicalKey } = SharedUtils.normalizeKeyEvent(event);
        let char = physicalKey;
        const displayMap = {
            ' ': 'Space',
            'arrowup': 'Up', 'arrowdown': 'Down', 'arrowleft': 'Left', 'arrowright': 'Right',
            'enter': 'Enter', 'tab': 'Tab', 'escape': 'Esc', 'backspace': 'Backspace', 'delete': 'Delete'
        };
        if (displayMap[char]) char = displayMap[char];
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

    const exportData = async () => {
        const includeAnnotations = exportAnnotationsToggle ? exportAnnotationsToggle.checked : true;
        const includeSettings = exportSettingsToggle ? exportSettingsToggle.checked : true;
        if (!includeAnnotations && !includeSettings) {
            await SharedUI.alert('Selection Required', 'Select annotations, settings, or both to export.');
            return;
        }

        let payload = {};
        let exportedAnnotationCounts = { pages: 0, highlights: 0, drawings: 0 };

        if (includeSettings) {
            payload = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get(exportableSettingKeys));
        }

        if (includeAnnotations) {
            const total = await pageStore.count();
            const exported = await runOverlayTask({
                title: 'Exporting data',
                initialText: total > 0 ? `Packing 0 of ${total} pages...` : 'Preparing export...',
                total,
                task: async ({ token, setProgress }) => pageStore.exportPages({
                    cancelToken: token,
                    progress: ({ processed }) => {
                        setProgress(processed, total > 0 ? `Packing ${Math.min(processed, total)} of ${total} pages...` : 'Preparing export...');
                    }
                })
            });
            payload.pages = exported.pages;
            exportedAnnotationCounts = countPageContent(exported.pages);
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `marklet-backup-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        const summary = [];
        if (includeAnnotations) summary.push(`Exported ${formatCount(exportedAnnotationCounts.pages, 'page')}, ${formatCount(exportedAnnotationCounts.highlights, 'highlight')}, and ${formatCount(exportedAnnotationCounts.drawings, 'drawing')}.`);
        if (includeSettings) summary.push('Included settings.');
        else summary.push('Settings were not included.');
        setDataFeedback(summary.join(' '));
    };

    const promptImportSelection = async (parsed) => {
        const rawPages = parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages) ? parsed.pages : {};
        const pages = Object.entries(rawPages).reduce((acc, [url, page]) => {
            if (typeof url !== 'string' || !url) return acc;
            acc[url] = SharedUtils.normalizePageData(page, url);
            return acc;
        }, {});
        
        const pageCount = Object.keys(pages).length;
        const counts = countPageContent(pages);
        const hasSettingsInFile = Object.keys(parsed).some(k => k !== 'pages' && k !== 'highlights' && k !== 'drawings');
        
        const groups = SharedUtils.getSettingsGroups();
        const applySettingsDefault = importSettingsToggle ? importSettingsToggle.checked : true;
        let selection = {
            settings: groups.reduce((acc, g) => { acc[g.id] = applySettingsDefault; return acc; }, {}),
            annotations: {
                highlights: pageCount > 0 && counts.highlights > 0,
                drawings: pageCount > 0 && counts.drawings > 0
            },
            mode: 'append'
        };

        const body = SharedUI.div('import-modal-body');
        const importLead = pageCount > 0 || hasSettingsInFile
            ? 'Review what to bring in before changing existing data.'
            : 'This backup does not include annotations or settings that can be imported.';

        const renderStat = (label, value, detail) => SharedUI.div('import-stat-card', [
            SharedUI.div('import-stat-label', { text: label }),
            SharedUI.div('import-stat-value', { text: value }),
            SharedUI.div('import-stat-detail', { text: detail })
        ]);

        const renderSection = ({ kicker, title, copy, content }) => SharedUI.div('import-section-card', { parent: body }, [
            SharedUI.div('import-section-head', [
                SharedUI.div('import-section-kicker', { text: kicker }),
                SharedUI.div('import-section-title', { text: title }),
                SharedUI.div('import-section-copy', { text: copy })
            ]),
            SharedUI.div('import-section-content', content)
        ]);

        const renderOption = ({ title, detail, checked, badge = '', disabled = false, onChange }) => {
            const row = SharedUI.el('label', `import-option-row${disabled ? ' is-disabled' : ''}`, { attrs: { 'aria-disabled': disabled ? 'true' : 'false' } });
            
            const input = SharedUI.el('input', {
                type: 'checkbox',
                checked,
                disabled,
                on: {
                    change: (event) => {
                        row.classList.toggle('is-checked', event.target.checked);
                        onChange(event.target.checked);
                    }
                }
            });

            const switchEl = SharedUI.el('div', 'switch', [
                input,
                SharedUI.el('span', 'slider')
            ]);

            row.classList.toggle('is-checked', checked);
            row.append(
                SharedUI.div('import-option-main', [
                    SharedUI.div('import-option-title-row', [
                        SharedUI.div('import-option-title', { text: title }),
                        badge ? SharedUI.div('import-option-badge', { text: badge }) : null
                    ].filter(Boolean)),
                    SharedUI.div('import-option-copy', { text: detail })
                ]),
                switchEl
            );
            return row;
        };

        SharedUI.div('import-modal-lead', { parent: body, text: importLead });
        SharedUI.div('import-modal-stats', { parent: body }, [
            renderStat('Pages', String(pageCount), pageCount === 1 ? '1 page found' : `${pageCount} pages found`),
            renderStat('Highlights', String(counts.highlights), counts.highlights === 1 ? '1 highlight available' : `${counts.highlights} highlights available`),
            renderStat('Drawings', String(counts.drawings), counts.drawings === 1 ? '1 drawing available' : `${counts.drawings} drawings available`),
            renderStat(hasSettingsInFile ? 'Settings' : 'Reset', String(groups.length), hasSettingsInFile ? 'Categories in scope' : 'Categories can reset')
        ]);

        const settingsSummary = hasSettingsInFile ? 'Settings from the file can be applied category by category.' : 'This file has no saved settings. Selected categories will reset to defaults.';

        renderSection({
            kicker: hasSettingsInFile ? 'Settings' : 'Reset',
            title: hasSettingsInFile ? 'Settings to Apply' : 'Reset Settings',
            copy: settingsSummary,
            content: groups.map(g => renderOption({
                title: g.label,
                detail: g.detail,
                checked: selection.settings[g.id],
                badge: g.badge,
                onChange: (value) => selection.settings[g.id] = value
            }))
        });

        if (pageCount > 0) {
            const modeCards = SharedUI.div('import-mode-list');
            const modeSummary = SharedUI.div('import-mode-summary');
            const modeMeta = {
                'append': {
                    title: 'Append',
                    detail: 'Keep what is already stored and add imported highlights and drawings.'
                },
                'replace-matching': {
                    title: 'Replace Matching Pages',
                    detail: 'Overwrite only the pages included in this file.'
                },
                'replace-all': {
                    title: 'Replace All',
                    detail: 'Clear current annotations first, then import this file.'
                }
            };
            const modeRows = [];
            const syncModeSelection = () => {
                modeRows.forEach(({ value, row, input }) => {
                    const isSelected = selection.mode === value;
                    input.checked = isSelected;
                    row.classList.toggle('is-selected', isSelected);
                });
                modeSummary.textContent = modeMeta[selection.mode].detail;
            };
            const renderMode = (value) => {
                const input = SharedUI.el('input', {
                    type: 'radio',
                    name: 'import-annotation-mode',
                    value,
                    checked: selection.mode === value,
                    on: {
                        change: () => {
                            selection.mode = value;
                            syncModeSelection();
                        }
                    }
                });
                const row = SharedUI.el('label', 'import-mode-card', [
                    input,
                    SharedUI.div('import-mode-body', [
                        SharedUI.div('import-mode-title', { text: modeMeta[value].title }),
                        SharedUI.div('import-mode-copy', { text: modeMeta[value].detail })
                    ])
                ]);
                modeRows.push({ value, row, input });
                return row;
            };

            modeCards.append(
                renderMode('append'),
                renderMode('replace-matching'),
                renderMode('replace-all')
            );
            syncModeSelection();

            renderSection({
                kicker: 'Annotations',
                title: 'Annotation Content',
                copy: 'Choose which annotation types to import, then choose how the imported pages should merge with what is already stored.',
                content: [
                    renderOption({
                        title: 'Highlights',
                        detail: counts.highlights > 0 ? 'Text highlights and their saved colors' : 'No highlights found in this file',
                        checked: selection.annotations.highlights,
                        badge: formatCount(counts.highlights, 'item'),
                        disabled: counts.highlights === 0,
                        onChange: (value) => selection.annotations.highlights = value
                    }),
                    renderOption({
                        title: 'Drawings',
                        detail: counts.drawings > 0 ? 'Freehand strokes, shapes, and text drawings' : 'No drawings found in this file',
                        checked: selection.annotations.drawings,
                        badge: formatCount(counts.drawings, 'item'),
                        disabled: counts.drawings === 0,
                        onChange: (value) => selection.annotations.drawings = value
                    }),
                    SharedUI.div('import-mode-wrap', [
                        SharedUI.div('import-mode-label', { text: 'Import Mode' }),
                        modeCards,
                        modeSummary
                    ])
                ]
            });
        } else {
            renderSection({
                kicker: 'Annotations',
                title: 'No Annotation Content',
                copy: 'This file does not include any saved pages, highlights, or drawings.',
                content: [
                    SharedUI.div('import-empty-note', { text: 'Only the settings section can be applied from this file.' })
                ]
            });
        }

        const confirmed = await SharedUI.showModal({
            title: 'Selective Import',
            body,
            panelClass: 'modal-panel-import',
            bodyClass: 'import-modal-shell',
            confirmText: 'Import Selected',
            cancelText: 'Cancel'
        });

        if (!confirmed) return null;

        const anySetting = Object.values(selection.settings).some(v => v);
        const anyAnnotation = selection.annotations.highlights || selection.annotations.drawings;

        if (!anySetting && !anyAnnotation) {
            SharedUI.toast('Nothing selected to import');
            return null;
        }

        return { ...selection, pages };
    };

    const buildImportSuccessMessage = ({ counts, settingsCount }) => {
        const parts = [];
        if (counts.pages > 0) {
            parts.push(`Imported ${formatCount(counts.pages, 'page')}, ${formatCount(counts.highlights, 'highlight')}, and ${formatCount(counts.drawings, 'drawing')}.`);
        }
        if (settingsCount > 0) {
            parts.push(`Applied ${settingsCount} settings categor${settingsCount === 1 ? 'y' : 'ies'}.`);
        }
        return parts.length ? parts.join(' ') : 'No data was imported.';
    };

    const importData = async (rawText) => {
        const parsed = JSON.parse(rawText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid import payload');

        const result = await promptImportSelection(parsed);
        if (!result) return false;

        const { pages, settings, annotations, mode } = result;

        // 1. Process Annotations
        let importedCounts = { pages: 0, highlights: 0, drawings: 0 };
        const hasAnnotationSelection = annotations.highlights || annotations.drawings;
        
        if (hasAnnotationSelection) {
            // Filter content if only a subset is selected
            const filteredPages = {};
            Object.entries(pages).forEach(([url, page]) => {
                const filteredPage = { ...page };
                if (!annotations.highlights) filteredPage.highlights = [];
                if (!annotations.drawings) filteredPage.drawings = [];
                
                if (filteredPage.highlights.length > 0 || filteredPage.drawings.length > 0) {
                    filteredPages[url] = filteredPage;
                }
            });

            const pageEntries = Object.entries(filteredPages);
            if (pageEntries.length > 0) {
                await runOverlayTask({
                    title: 'Importing annotations',
                    initialText: `Applying 0 of ${pageEntries.length} pages...`,
                    total: pageEntries.length,
                    task: async ({ token, setProgress }) => pageStore.importPages(filteredPages, {
                        mode: mode,
                        cancelToken: token,
                        progress: ({ processed, total }) => {
                            setProgress(processed, `Applying ${Math.min(processed, total)} of ${total} pages...`);
                        }
                    })
                });
                importedCounts = countPageContent(filteredPages);
            }
        }

        // 2. Process Settings
        let settingsCount = 0;
        const anySettingSelected = Object.values(settings).some(v => v);
        
        if (anySettingSelected) {
            const groups = SharedUtils.getSettingsGroups();
            const current = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get(exportableSettingKeys));
            const defaults = SharedUtils.getDefaultSettings();
            const newSettings = { ...current };

            groups.forEach(g => {
                if (settings[g.id]) {
                    settingsCount++;
                    g.keys.forEach(k => {
                        if (parsed[k] !== undefined) newSettings[k] = parsed[k];
                        else newSettings[k] = defaults[k];
                    });
                }
            });

            await chrome.storage.local.set(SharedUtils.sanitizeStoredSettings(newSettings));
        }

        annotationState.page = 1;
        annotationState.expanded.clear();
        await loadData();
        
        const successMessage = buildImportSuccessMessage({ 
            counts: importedCounts, 
            settingsCount
        });
        
        setDataFeedback(successMessage);
        SharedUI.toast(successMessage);
        return true;
    };

    const loadData = async () => {
        const data = SharedUtils.sanitizeStoredSettings(await chrome.storage.local.get([
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
        ]));

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
        highlightColorInput.value = data.defaultHighlightColor || SharedUtils.getDefaultHighlightColor();
        drawColorInput.value = data.defaultDrawColor || SharedUtils.getDefaultDrawColor();
        const opacity = data.drawingOpacity !== undefined ? data.drawingOpacity : drawingDefaults.opacity;
        drawOpacityInput.value = opacity;
        drawOpacityVal.innerText = opacity;
        blendModeSelect.value = data.drawingBlendMode || drawingDefaults.blendMode;

        if (isEnabledByDefault) renderSiteList(data.disabledSites || [], false);
        else renderSiteList(data.enabledSites || [], true);

        const keys = data.hotkeys || {};
        hotkeyInputs.highlight.value = keys.highlight || 'Alt+H';
        hotkeyInputs.whiteboard.value = keys.toggleWhiteboard || 'Alt+Shift+W';
        hotkeyInputs.drawings.value = keys.toggleDrawings || 'Alt+Shift+D';
        hotkeyInputs.highlights.value = keys.toggleHighlights || 'Alt+Shift+H';
        hotkeyInputs.all.value = keys.toggleAll || 'Alt+Shift+A';

        await loadAnnotations();
    };

    globalEnableToggle.onchange = async () => {
        await chrome.storage.local.set({ extensionEnabled: globalEnableToggle.checked });
    };

    enableByDefaultToggle.onchange = async () => {
        const nextValue = enableByDefaultToggle.checked;
        await chrome.storage.local.set({ enableByDefault: nextValue });
        await loadData();
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

    drawOpacityInput.oninput = (event) => {
        drawOpacityVal.innerText = event.target.value;
    };

    drawOpacityInput.onchange = async () => {
        await chrome.storage.local.set({ drawingOpacity: parseInt(drawOpacityInput.value, 10) });
    };

    blendModeSelect.onchange = async () => {
        await chrome.storage.local.set({ drawingBlendMode: blendModeSelect.value });
    };

    const saveDisabledSite = async () => {
        const hostname = SharedUtils.normalizeHostname(disabledSiteInput?.value || '');
        if (!hostname) {
            await SharedUI.alert('Invalid Input', 'Please enter a valid hostname (e.g., example.com).');
            return;
        }
        const data = await chrome.storage.local.get(['disabledSites', 'enabledSites', 'enableByDefault']);
        const sites = (data.enableByDefault !== false) ? (data.disabledSites || []) : (data.enabledSites || []);
        
        if (sites.includes(hostname)) {
            disabledSiteInput.value = '';
            return;
        }

        const newSites = [...sites, hostname];
        if (data.enableByDefault !== false) {
            await chrome.storage.local.set({ disabledSites: newSites });
        } else {
            await chrome.storage.local.set({ enabledSites: newSites });
        }
        
        disabledSiteInput.value = '';
        renderSiteList(newSites, data.enableByDefault === false);
    };

    urlHashSiteAddButton.onclick = saveUrlHashSiteRule;
    urlHashSiteInput.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        saveUrlHashSiteRule();
    };

    disabledSiteAddButton.onclick = saveDisabledSite;
    disabledSiteInput.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        saveDisabledSite();
    };

    pageSearch.oninput = () => {
        annotationState.page = 1;
        if (annotationState.timer) clearTimeout(annotationState.timer);
        annotationState.timer = setTimeout(() => {
            loadAnnotations({ forceOverlay: !!pageSearch.value.trim() });
        }, 180);
    };

    exportBtn.onclick = async () => {
        try {
            await exportData();
        } catch (error) {
            if (error?.name !== 'AbortError') await SharedUI.alert('Export Failed', 'An error occurred during export.');
        }
    };

    importBtn.onclick = () => importFile.click();

    importFile.onchange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
            try {
                await importData(loadEvent.target.result);
            } catch (error) {
                if (error?.name !== 'AbortError') await SharedUI.alert('Import Failed', error?.message || 'Invalid file format');
            } finally {
                importFile.value = '';
            }
        };
        reader.readAsText(file);
    };

    if (clearAnnotationsBtn) {
        clearAnnotationsBtn.onclick = async () => {
            if (!await SharedUI.confirm('Clear All Annotations', 'Remove all page annotations? Settings will remain.', { isDanger: true })) return;
            const removed = await pageStore.clearPages();
            annotationState.page = 1;
            annotationState.expanded.clear();
            await loadAnnotations({ forceOverlay: removed > annotationState.pageSize });
            const message = removed > 0 ? `Removed annotations from ${formatCount(removed, 'page')}.` : 'No page annotations found.';
            setDataFeedback(message);
            SharedUI.toast(message);
        };
    }

    const resetSection = async (title, keys, message) => {
        if (!await SharedUI.confirm(`Reset ${title}`, `Reset all ${message} to default values?`, { isDanger: true })) return;
        const defaults = SharedUtils.getDefaultSettings();
        const update = {};
        keys.forEach(key => {
            update[key] = defaults[key];
        });
        await chrome.storage.local.set(update);
        await loadData();
        SharedUI.toast(`${title} reset`);
    };

    if (resetGeneralBtn) resetGeneralBtn.onclick = () => resetSection('General', ['extensionEnabled', 'enableByDefault', 'theme'], 'general settings');
    if (resetHotkeysBtn) resetHotkeysBtn.onclick = () => resetSection('Hotkeys', ['hotkeys'], 'keyboard shortcuts');
    if (resetHighlightsBtn) resetHighlightsBtn.onclick = () => resetSection('Highlights', ['defaultHighlightColor', 'highlightShadowsEnabled', 'highlightRounded', 'allowReadonlyHighlight'], 'highlighting preferences');
    if (resetDrawingsBtn) resetDrawingsBtn.onclick = () => resetSection('Drawings', ['defaultDrawColor', 'drawingOpacity', 'drawingBlendMode'], 'drawing defaults');

    if (resetBtn) {
        resetBtn.onclick = async () => {
            if (!await SharedUI.confirm('Reset Settings', 'Reset all settings to default? Highlights and drawings will remain.', { isDanger: true })) return;
            const defaults = SharedUtils.getDefaultSettings();
            await chrome.storage.local.clear();
            await chrome.storage.local.set(defaults);
            await loadData();
        };
    }

    urlHashResetButton.onclick = async () => {
        if (!await SharedUI.confirm('Reset Overrides', 'Remove all site-specific URL hash overrides?', { isDanger: true })) return;
        urlNormalizationSettings.siteHashModes = {};
        await persistUrlNormalizationSettings();
        siteRuleState.page = 1;
        renderUrlHashSiteList();
        SharedUI.toast('Site overrides reset');
    };

    siteListResetButton.onclick = async () => {
        const data = await chrome.storage.local.get(['enableByDefault']);
        const isWhitelist = data.enableByDefault === false;
        const title = isWhitelist ? 'Reset Enabled Sites' : 'Reset Disabled Sites';
        const msg = isWhitelist ? 'Remove all exceptions from the enabled sites list?' : 'Remove all sites from the disabled hostnames list?';
        
        if (!await SharedUI.confirm(title, msg, { isDanger: true })) return;
        
        const key = isWhitelist ? 'enabledSites' : 'disabledSites';
        await chrome.storage.local.set({ [key]: [] });
        siteListState.page = 1;
        renderSiteList([], isWhitelist);
        SharedUI.toast('Site list reset');
    };

    Object.keys(hotkeyInputs).forEach((key) => {
        hotkeyInputs[key].onkeydown = (event) => recordHotkey(event, key);
        hotkeyInputs[key].onfocus = () => hotkeyInputs[key].select();
    });

    await loadData();
});
