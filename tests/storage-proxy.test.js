const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Storage Proxy', () => {
    const pageStoragePath = require.resolve('../utils/page-storage.js');
    let originalTinyIDB;
    let originalLocation;
    let originalPageStorage;

    afterEach(() => {
        delete require.cache[pageStoragePath];
        if (originalTinyIDB !== undefined) {
            global.tinyIDB = originalTinyIDB;
        }
        if (originalLocation === undefined) delete global.location;
        else global.location = originalLocation;
        if (originalPageStorage === undefined) delete global.PageStorage;
        else global.PageStorage = originalPageStorage;
    });

    it('should reject when runtime messaging fails', async () => {
        originalTinyIDB = global.tinyIDB;
        originalLocation = global.location;
        originalPageStorage = global.PageStorage;
        delete global.location;
        global.tinyIDB = {
            open: mock.fn(() => global.tinyIDB),
            get: mock.fn(async () => undefined),
            set: mock.fn(async () => undefined),
            remove: mock.fn(async () => undefined),
            update: mock.fn(async () => undefined),
            clear: mock.fn(async () => undefined),
            raw: mock.fn(async () => undefined)
        };
        chrome.runtime.sendMessage = mock.fn((message, callback) => {
            chrome.runtime.lastError = { message: 'No receiver' };
            callback();
            delete chrome.runtime.lastError;
        });

        require('../utils/page-storage.js');

        await assert.rejects(global.PageStorage.get('http://example.com'), /No receiver/);
    });

    it('should fall back to entry scans when direct cursor queries fail', async () => {
        originalTinyIDB = global.tinyIDB;
        originalLocation = global.location;
        originalPageStorage = global.PageStorage;
        global.location = { protocol: 'chrome-extension:' };
        global.tinyIDB = {
            open: mock.fn(() => global.tinyIDB),
            get: mock.fn(async () => undefined),
            set: mock.fn(async () => undefined),
            remove: mock.fn(async () => undefined),
            update: mock.fn(async () => undefined),
            clear: mock.fn(async () => undefined),
            entries: mock.fn(async () => [[
                'http://example.com',
                {
                    url: 'http://example.com',
                    highlights: [{ id: 'h-1', text: 'alpha' }],
                    drawings: [],
                    lastUpdated: 1
                }
            ]]),
            raw: mock.fn(async () => {
                throw new Error('cursor failed');
            })
        };

        require('../utils/page-storage.js');

        const result = await global.PageStorage.queryPages({ limit: 5 });
        assert.strictEqual(result.total, 1);
        assert.strictEqual(result.items[0].url, 'http://example.com');
    });

    it('should use direct count when tiny-idb exposes it', async () => {
        originalTinyIDB = global.tinyIDB;
        originalLocation = global.location;
        originalPageStorage = global.PageStorage;
        global.location = { protocol: 'chrome-extension:' };

        const count = mock.fn(async () => 4);
        global.tinyIDB = {
            open: mock.fn(() => global.tinyIDB),
            count,
            entries: mock.fn(async () => {
                throw new Error('entries should not be used');
            })
        };

        require('../utils/page-storage.js');

        const total = await global.PageStorage.count();
        assert.strictEqual(total, 4);
        assert.strictEqual(count.mock.calls.length, 1);
    });

    it('should surface the newer raw helpers in direct storage mode', async () => {
        originalTinyIDB = global.tinyIDB;
        originalLocation = global.location;
        originalPageStorage = global.PageStorage;
        global.location = { protocol: 'chrome-extension:' };

        require('../utils/page-storage.js');

        await global.PageStorage.set('http://example.com/b', {
            url: 'http://example.com/b',
            highlights: [{ id: 'h-2', text: 'beta' }],
            drawings: [],
            lastUpdated: 2
        });
        await global.PageStorage.set('http://example.com/a', {
            url: 'http://example.com/a',
            highlights: [{ id: 'h-1', text: 'alpha' }],
            drawings: [],
            lastUpdated: 1
        });

        assert.strictEqual(await global.PageStorage.raw.has('http://example.com/a'), true);
        assert.strictEqual(await global.PageStorage.raw.has('http://example.com/missing'), false);

        const page = await global.PageStorage.raw.paginate(1);
        assert.deepStrictEqual(page.items.map(([key]) => key), ['http://example.com/a']);
        assert.strictEqual(page.next, 'http://example.com/b');
    });

    it('should refresh lastUpdated on destructive page mutations that keep the page', async () => {
        originalTinyIDB = global.tinyIDB;
        originalLocation = global.location;
        originalPageStorage = global.PageStorage;
        global.location = { protocol: 'chrome-extension:' };

        require('../utils/page-storage.js');

        const url = 'http://example.com';
        await global.PageStorage.set(url, {
            url,
            highlights: [{ id: 'h-1', text: 'alpha' }],
            drawings: [{ id: 'd-1' }],
            lastUpdated: 10
        });

        await global.PageStorage.update(url, 'delete_highlight', { id: 'h-1' });

        const pageAfterDelete = await global.PageStorage.get(url);
        assert.ok(pageAfterDelete.lastUpdated >= 10);
        assert.strictEqual(pageAfterDelete.highlights.length, 0);
        assert.strictEqual(pageAfterDelete.drawings.length, 1);

        const afterDeleteTimestamp = pageAfterDelete.lastUpdated;
        await global.PageStorage.update(url, 'clear_drawings');

        const pageAfterClear = await global.PageStorage.get(url);
        assert.strictEqual(pageAfterClear, undefined);
        assert.ok(afterDeleteTimestamp >= 10);
    });
});
