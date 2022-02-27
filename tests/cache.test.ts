import { Cache } from './../src/cache';

jest.retryTimes(parseInt(process.env.RETRY_TIMES || '1'));

let cache = new Cache();

let item = {
    test: 'cache'
};

describe('tests for cache object', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('item can be added to cache', done => {
        if (cache.set('test_item', item) == true) {
            done();
            return;
        }

        throw new Error('Item not set.');
    });

    test('item can be recieved from cache', done => {
        if (cache.get('test_item') !== false) {
            done();
            return;
        }

        throw new Error('Item not in cache.');
    });

    test('item doesnt change in cache', done => {
        let cacheItem = cache.get('test_item');

        if (cacheItem == item) {
            done();
            return;
        }

        throw new Error('Item changed in cache.');
    });

    test('item can be deleted from cache', done => {
        cache.delete('test_item');

        if (cache.get('test_item') === false) {
            done();
            return;
        }

        throw new Error('Item still in cache.');
    });
    
    test('item expires after ttl duration', done => {
        cache.set('test_item', item, 1000)

        if (cache.get('test_item') === false) return;

        setTimeout(() => {
            if (cache.get('test_item') === false) {
                done();
                return;
            }
            throw new Error('Item still in cache.');
        }, 1500);
    })
});
