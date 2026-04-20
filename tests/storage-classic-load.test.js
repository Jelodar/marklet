const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

describe('Classic Script Storage Loading', () => {
    it('should load tiny-idb and page-storage in the same global scope', () => {
        const context = {
            console,
            Map,
            Set,
            Promise,
            Error,
            TypeError,
            DOMException,
            queueMicrotask
        };
        context.globalThis = context;
        vm.createContext(context);

        const tinyIdbSource = fs.readFileSync(path.join(__dirname, '../utils/tiny-idb.js'), 'utf8');
        const pageStorageSource = fs.readFileSync(path.join(__dirname, '../utils/page-storage.js'), 'utf8');

        assert.doesNotThrow(() => {
            vm.runInContext(tinyIdbSource, context, { filename: 'utils/tiny-idb.js' });
            vm.runInContext(pageStorageSource, context, { filename: 'utils/page-storage.js' });
        });

        assert.ok(context.tinyIDB);
        assert.ok(context.PageStorage);
        assert.strictEqual(typeof context.PageStorage.get, 'function');
    });
});
