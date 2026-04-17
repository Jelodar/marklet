const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert');
require('./test-setup.js');

describe('Storage Proxy', () => {
    const pageStoragePath = require.resolve('../utils/page-storage.js');
    let originalTinyIDB;
    let originalLocation;

    afterEach(() => {
        delete require.cache[pageStoragePath];
        if (originalTinyIDB !== undefined) global.tinyIDB = originalTinyIDB;
        if (originalLocation === undefined) delete global.location;
        else global.location = originalLocation;
    });

    it('should reject when runtime messaging fails', async () => {
        originalTinyIDB = global.tinyIDB;
        originalLocation = global.location;
        delete global.location;
        global.tinyIDB = {
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

        await assert.rejects(global.tinyIDB.get('http://example.com'), /No receiver/);
    });
});
