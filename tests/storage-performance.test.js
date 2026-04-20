const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Storage Performance', () => {
    const pageStoragePath = require.resolve('../utils/page-storage.js');
    let originalPageStorage;

    beforeEach(async () => {
        originalPageStorage = global.PageStorage;
        delete require.cache[pageStoragePath];
        require('../utils/page-storage.js');
        // Reset mock storage
        mockStorage.clear();
    });

    afterEach(() => {
        global.PageStorage = originalPageStorage;
        mockStorage.clear();
    });

    const generateData = (count) => {
        const pages = {};
        for (let i = 0; i < count; i++) {
            const url = `https://example.com/page-${i}`;
            pages[url] = {
                url,
                highlights: [
                    { id: `h-${i}-1`, text: `Highlight 1 on page ${i}`, color: '#ff0000' },
                    { id: `h-${i}-2`, text: `Some other text ${i}`, color: '#00ff00' }
                ],
                drawings: [
                    { id: `d-${i}-1`, type: 'pen', points: [0, 0, 10, 10] }
                ],
                lastUpdated: Date.now() - i * 1000
            };
        }
        return pages;
    };

    it('should handle large dataset search efficiently', async () => {
        const count = 1000;
        const data = generateData(count);
        await global.PageStorage.importPages(data);

        const start = performance.now();
        const result = await global.PageStorage.queryPages({ search: 'page-500', limit: 10 });
        const end = performance.now();

        assert.strictEqual(result.items.length, 1);
        assert.strictEqual(result.items[0].url, 'https://example.com/page-500');
        
        const duration = end - start;
        // We expect it to be fast in mock environment, but real IDB might be slower.
        // Still, keeping it under 100ms in mock is a good baseline.
        assert.ok(duration < 100, `Search among ${count} pages took too long: ${duration.toFixed(2)}ms`);
    });

    it('should find pages based on whiteboard text annotations', async () => {
        const url = 'https://example.com/text-drawing';
        await global.PageStorage.set(url, {
            url,
            highlights: [],
            drawings: [
                { id: 'd-1', type: 'text', text: 'Target drawing text' }
            ],
            lastUpdated: Date.now()
        });

        const result = await global.PageStorage.queryPages({ search: 'target drawing text' });
        assert.strictEqual(result.items.length, 1);
        assert.strictEqual(result.items[0].url, url);
    });

    it('should handle large export efficiently', async () => {
        const count = 500;
        const data = generateData(count);
        await global.PageStorage.importPages(data);

        const start = performance.now();
        const exported = await global.PageStorage.exportPages();
        const end = performance.now();

        assert.strictEqual(exported.total, count);
        
        const duration = end - start;
        assert.ok(duration < 200, `Export of ${count} pages took too long: ${duration.toFixed(2)}ms`);
    });

    it('should handle large bulk deletion efficiently', async () => {
        const count = 1000;
        const data = generateData(count);
        await global.PageStorage.importPages(data);

        const start = performance.now();
        await global.PageStorage.clearPages();
        const end = performance.now();

        const remaining = await global.PageStorage.count();
        assert.strictEqual(remaining, 0);
        
        const duration = end - start;
        assert.ok(duration < 100, `Deletion of ${count} pages took too long: ${duration.toFixed(2)}ms`);
    });

    it('should handle large append import efficiently', async () => {
        const initialCount = 200;
        const initialData = generateData(initialCount);
        await global.PageStorage.importPages(initialData);

        const appendCount = 300;
        const appendData = {};
        for (let i = 0; i < appendCount; i++) {
            const url = `https://example.com/new-page-${i}`;
            appendData[url] = {
                url,
                highlights: [{ id: `h-new-${i}`, text: 'new' }],
                drawings: [],
                lastUpdated: Date.now()
            };
        }

        const start = performance.now();
        await global.PageStorage.importPages(appendData, { mode: 'append' });
        const end = performance.now();

        const totalCount = await global.PageStorage.count();
        assert.strictEqual(totalCount, initialCount + appendCount);
        
        const duration = end - start;
        assert.ok(duration < 300, `Append import of ${appendCount} pages took too long: ${duration.toFixed(2)}ms`);
    });
});
