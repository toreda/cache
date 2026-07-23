/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2026 Toreda, Inc.
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a copy
 *	of this software and associated documentation files (the "Software"), to deal
 *	in the Software without restriction, including without limitation the rights
 *	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *	copies of the Software, and to permit persons to whom the Software is
 *	furnished to do so, subject to the following conditions:

 * 	The above copyright notice and this permission notice shall be included in all
 * 	copies or substantial portions of the Software.
 *
 * 	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * 	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * 	SOFTWARE.
 *
 */

import {Levels, Log} from '@toreda/log';

import {Cache} from '../src/cache';
import {CacheItem} from '../src/cache/item';
import type {Cacheable} from '../src/cacheable';
import type {CfgData} from '../src/cfg/data';
import {Defaults} from '../src/defaults';

interface SampleT extends Cacheable {
	id: string;
}

const MOCK_ITEM1: SampleT = {
	id: 'aa-14971491741947'
};

const MOCK_ITEM2: SampleT = {
	id: 'bb-972971947149714'
};

describe('Cache', () => {
	let log: Log;
	let cfg: CfgData;
	let instance: Cache<SampleT>;

	beforeAll(() => {
		log = new Log({
			consoleEnabled: false,
			globalLevel: Levels.ERROR
		});

		cfg = {
			initialSize: 10,
			pruneDelay: 0,
			slidingExpiration: false,
			capacityMax: 50,
			ttl: 818
		};

		instance = new Cache<SampleT>({
			cfg: cfg
		});
	});

	beforeEach(() => {
		instance.reset();

		cfg.initialSize = 10;
		cfg.pruneDelay = 0;
		cfg.slidingExpiration = false;
		cfg.capacityMax = 50;
		cfg.ttl = 122;
	});

	describe('Constructor', () => {});

	describe('Impl', () => {
		describe('has', () => {
			it(`should return false when items map is empty`, () => {
				expect(instance.has('aaa-1947614971947')).toBe(false);
			});

			it(`should return false when item map has no matching id`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);

				expect(instance.has('cc-1947149714')).toBe(false);
			});

			it(`should return true when a cached item matches id`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);

				expect(instance.has(MOCK_ITEM1.id)).toBe(true);
			});
		});

		describe('get', () => {
			it(`should return null when map does not contain matching item`, () => {
				instance.add(MOCK_ITEM1);

				expect(instance.get('vvv-149714971497')).toBeNull();
			});

			it(`should return matching item`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);

				const id = 'AA_19714-1497149714';
				const item3: SampleT = {
					id: id
				};

				expect(instance.add(item3)).toBe(true);

				const result = instance.get(id);

				expect(result).not.toBeNull();
				expect(result).toStrictEqual(item3);
			});

			it(`should return null when cached item is expired`, () => {
				const id = 'aa-1971-4971-197149714';
				const sample: SampleT = {
					id: id
				};

				instance.add(sample);
				const wrapper = instance.items.get(id) as CacheItem<SampleT>;
				expect(wrapper).toBeDefined();
				const spy = jest.spyOn<CacheItem<SampleT>, 'expired'>(wrapper, 'expired');
				spy.mockImplementation((): boolean => {
					return true;
				});

				expect(instance.get(id)).toBeNull();
			});

			it(`should return null when item exists but has undefined value (generally shouldn't happen)`, () => {
				const id = 'aaa-1974149714';
				instance.items.set(id, undefined as any);

				expect(instance.get(id)).toBeNull();
			});
		});

		describe('prune', () => {
			it(`should return 0 when time elapsed since last prune is less than min prune delay`, () => {
				instance.pruneDelay(3333);
				instance.lastPrune.setNow();
				const result = instance.prune();

				expect(result).toBe(0);
			});

			it(`should return 0 when cache contains multiple unexpired items`, () => {
				const item1: SampleT = {id: 'aaa1441'};
				const item2: SampleT = {id: 'bbb44141'};
				instance.add(item1);
				instance.add(item2);

				instance.items.get('aaa1441')!.ttl(9999999999);
				instance.items.get('bbb44141')!.ttl(999999999);

				const result = instance.prune();
				expect(result).toBe(0);
			});

			it(`should return expired item deletion count`, () => {
				const item1: SampleT = {id: 'aaa1441'};
				const item2: SampleT = {id: 'bbb44141'};
				const item3: SampleT = {id: 'bbb44141'};
				instance.pruneDelay(0);

				instance.add(item1);
				instance.add(item2);
				instance.add(item3);

				instance.items.get('aaa1441')!.ttl(1);
				instance.items.get('aaa1441')!.created.subDays(1);
				instance.items.get('bbb44141')!.ttl(1);
				instance.items.get('bbb44141')!.created.subDays(1);

				const result = instance.prune();
				expect(result).toBe(2);
			});

			it(`should not count an expired item when map delete does not remove it`, () => {
				instance.pruneDelay(0);
				instance.add({id: 'aaa1441'});
				instance.items.get('aaa1441')!.ttl(1);
				instance.items.get('aaa1441')!.created.subDays(1);

				const spy = jest.spyOn(instance.items, 'delete').mockReturnValue(false);
				const result = instance.prune();

				expect(spy).toHaveBeenCalledWith('aaa1441');
				spy.mockRestore();

				expect(result).toBe(0);
			});

			it(`should only count expired items whose delete succeeds`, () => {
				instance.pruneDelay(0);
				instance.add({id: 'aaa1441'});
				instance.add({id: 'bbb44141'});

				for (const id of ['aaa1441', 'bbb44141']) {
					instance.items.get(id)!.ttl(1);
					instance.items.get(id)!.created.subDays(1);
				}

				const realDelete = Map.prototype.delete.bind(instance.items);
				const spy = jest.spyOn(instance.items, 'delete').mockImplementation((key) => {
					if (key === 'aaa1441') {
						return false;
					}

					return realDelete(key);
				});

				const result = instance.prune();
				spy.mockRestore();

				expect(result).toBe(1);
				expect(instance.items.has('aaa1441')).toBe(true);
				expect(instance.items.has('bbb44141')).toBe(false);
			});
		});

		describe('add', () => {
			it(`should return false when item arg is undefined`, async () => {
				expect(instance.items.size).toBe(0);
				const result = instance.add(undefined as any);

				expect(result).toBe(false);
				expect(instance.items.size).toBe(0);
			});

			it(`should return false when item arg is undefined`, async () => {
				expect(instance.items.size).toBe(0);
				const result = instance.add(undefined as any);
				expect(result).toBe(false);
				expect(instance.items.size).toBe(0);
			});

			it(`should not add an item to items map when item arg is undefined`, async () => {
				expect(instance.items.size).toBe(0);
				const result = instance.add(undefined as any);
				expect(instance.items.size).toBe(0);
			});

			it(`should not add an item to items map when item arg is null`, async () => {
				expect(instance.items.size).toBe(0);
				const result = instance.add(null as any);
				expect(instance.items.size).toBe(0);
			});

			it(`should add item to empty map`, async () => {
				const item1: SampleT = {
					id: 'aa-19047194714'
				};
				expect(instance.size()).toBe(0);
				const result = instance.add(item1);
				expect(instance.size()).toBe(1);
			});

			it(`should add multiple unique items in successive calls`, async () => {
				const item1: SampleT = {
					id: 'aa-19047194714'
				};

				const item2: SampleT = {
					id: 'bb-19714971144'
				};

				expect(instance.size()).toBe(0);
				instance.add(item1);
				instance.add(item2);
				expect(instance.size()).toBe(2);
			});
		});

		describe('itemValidator', () => {
			it(`should be null when cfg.itemValidator is not provided`, () => {
				const custom = new Cache<SampleT>();

				expect(custom.itemValidator).toBeNull();
			});

			it(`should accept all items when cfg.itemValidator is not provided`, () => {
				const custom = new Cache<SampleT>();

				expect(custom.add(MOCK_ITEM1)).toBe(true);
				expect(custom.add(MOCK_ITEM2)).toBe(true);
				expect(custom.size()).toBe(2);
			});

			it(`should use cfg.itemValidator when provided`, () => {
				const validator = jest.fn().mockReturnValue(true);
				const custom = new Cache<SampleT>({
					itemValidator: validator
				});

				expect(custom.itemValidator).toBe(validator);
			});

			it(`should invoke validator with item arg on each add call`, () => {
				const validator = jest.fn().mockReturnValue(true);
				const custom = new Cache<SampleT>({
					itemValidator: validator
				});

				custom.add(MOCK_ITEM1);
				custom.add(MOCK_ITEM2);

				expect(validator).toHaveBeenCalledTimes(2);
				expect(validator).toHaveBeenCalledWith(MOCK_ITEM1);
				expect(validator).toHaveBeenCalledWith(MOCK_ITEM2);
			});

			it(`should add items when validator returns true`, () => {
				const custom = new Cache<SampleT>({
					itemValidator: () => true
				});

				expect(custom.add(MOCK_ITEM1)).toBe(true);
				expect(custom.size()).toBe(1);
			});

			it(`should not add items when validator returns false`, () => {
				const custom = new Cache<SampleT>({
					itemValidator: () => false
				});

				expect(custom.add(MOCK_ITEM1)).toBe(false);
				expect(custom.size()).toBe(0);
			});
		});

		describe('capacityMax', () => {
			it(`should use default capacityMax when cfg.capacityMax is not provided`, () => {
				const custom = new Cache<SampleT>();

				expect(custom.capacityMax).toBe(Defaults.Cache.CapacityMax);
			});

			it(`should use cfg.capacityMax when provided`, () => {
				cfg.capacityMax = 3;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				expect(custom.capacityMax).toBe(3);
			});

			it(`should evict oldest item when adding beyond capacity`, () => {
				cfg.capacityMax = 2;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.add({id: 'aa-111'});
				custom.add({id: 'bb-222'});

				expect(custom.add({id: 'cc-333'})).toBe(true);
				expect(custom.size()).toBe(2);
				expect(custom.has('aa-111')).toBe(false);
				expect(custom.has('bb-222')).toBe(true);
				expect(custom.has('cc-333')).toBe(true);
			});

			it(`should not evict when overwriting an existing item at capacity`, () => {
				cfg.capacityMax = 2;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.add({id: 'aa-111'});
				custom.add({id: 'bb-222'});

				expect(custom.add({id: 'bb-222'}, true)).toBe(true);
				expect(custom.size()).toBe(2);
				expect(custom.has('aa-111')).toBe(true);
			});
		});

		describe('delete', () => {
			it(`should return false when no item matches id`, () => {
				expect(instance.delete('aa-49719714')).toBe(false);
			});

			it(`should remove matching item and return true`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);

				expect(instance.delete(MOCK_ITEM1.id)).toBe(true);
				expect(instance.size()).toBe(1);
				expect(instance.has(MOCK_ITEM1.id)).toBe(false);
				expect(instance.has(MOCK_ITEM2.id)).toBe(true);
			});

			it(`should only increment stats.deletes when an item is removed`, () => {
				instance.add(MOCK_ITEM1);

				instance.delete('zz-149714971');
				expect(instance.stats.deletes).toBe(0);

				instance.delete(MOCK_ITEM1.id);
				expect(instance.stats.deletes).toBe(1);
			});
		});

		describe('ttl', () => {
			it(`should use the instance default TTL when add ttl arg are provided`, () => {
				const expectedValue = 910;
				const custom = new Cache({
					cfg: {
						ttl: expectedValue
					}
				});
				custom.add(MOCK_ITEM1);

				const wrapper = custom.items.get(MOCK_ITEM1.id)!;
				expect(wrapper.ttl()).toBe(expectedValue);
			});

			it(`should use cfg.ttl for items added without a ttl arg`, () => {
				cfg.ttl = 77;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.add(MOCK_ITEM1);

				const wrapper = custom.items.get(MOCK_ITEM1.id)!;
				expect(wrapper.ttl()).toBe(77);
			});

			it(`should use add ttl arg over cfg.ttl when both are provided`, () => {
				cfg.ttl = 77;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.add(MOCK_ITEM1, false, 55);

				const wrapper = custom.items.get(MOCK_ITEM1.id)!;
				expect(wrapper.ttl()).toBe(55);
			});

			it(`should accept 0 ttl arg for items which never expire`, () => {
				instance.add(MOCK_ITEM1, false, 0);

				const wrapper = instance.items.get(MOCK_ITEM1.id)!;
				expect(wrapper.ttl()).toBe(0);
				expect(wrapper.expired()).toBe(false);
			});
		});

		describe('getOrAdd', () => {
			it(`should return cached item without invoking factory on cache hit`, () => {
				instance.add(MOCK_ITEM1);
				const factory = jest.fn().mockReturnValue(MOCK_ITEM2);

				const result = instance.getOrAdd(MOCK_ITEM1.id, factory);

				expect(result).toStrictEqual(MOCK_ITEM1);
				expect(factory).not.toHaveBeenCalled();
			});

			it(`should invoke factory with id and cache result on cache miss`, () => {
				const id = 'aa-4741947194714';
				const item: SampleT = {id: id};
				const factory = jest.fn().mockReturnValue(item);

				const result = instance.getOrAdd(id, factory);

				expect(factory).toHaveBeenCalledTimes(1);
				expect(factory).toHaveBeenCalledWith(id);
				expect(result).toStrictEqual(item);
				expect(instance.get(id)).toStrictEqual(item);
			});

			it(`should apply ttl arg to items created by factory`, () => {
				const id = 'aa-77419741971';
				const result = instance.getOrAdd(id, () => ({id: id}), 44);

				expect(result).not.toBeNull();
				expect(instance.items.get(id)!.ttl()).toBe(44);
			});

			it(`should return null when factory item cannot be added`, () => {
				const factory = jest.fn().mockReturnValue({id: ''});

				expect(instance.getOrAdd('aa-19714971', factory)).toBeNull();
				expect(instance.size()).toBe(0);
			});
		});

		describe('touch', () => {
			it(`should return false when no item matches id`, () => {
				expect(instance.touch('aa-497149174')).toBe(false);
			});

			it(`should refresh updated timestamp and return true for unexpired items`, () => {
				instance.add(MOCK_ITEM1);
				const wrapper = instance.items.get(MOCK_ITEM1.id)!;
				expect(wrapper.updated()).toBe(0);

				expect(instance.touch(MOCK_ITEM1.id)).toBe(true);
				expect(wrapper.updated()).toBeGreaterThan(0);
			});

			it(`should return false and lazily remove expired items`, () => {
				instance.add(MOCK_ITEM1);
				instance.items.get(MOCK_ITEM1.id)!.ttl(1);
				instance.items.get(MOCK_ITEM1.id)!.created.subDays(1);

				expect(instance.touch(MOCK_ITEM1.id)).toBe(false);
				expect(instance.items.has(MOCK_ITEM1.id)).toBe(false);
			});
		});

		describe('slidingExpiration', () => {
			it(`should be false by default`, () => {
				expect(instance.slidingExpiration).toBe(false);
			});

			it(`should not refresh updated timestamp on get when disabled`, () => {
				instance.add(MOCK_ITEM1);
				instance.get(MOCK_ITEM1.id);

				expect(instance.items.get(MOCK_ITEM1.id)!.updated()).toBe(0);
			});

			it(`should refresh updated timestamp on successful get when enabled`, () => {
				cfg.slidingExpiration = true;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.add(MOCK_ITEM1);
				const wrapper = custom.items.get(MOCK_ITEM1.id)!;
				expect(wrapper.updated()).toBe(0);

				expect(custom.get(MOCK_ITEM1.id)).toStrictEqual(MOCK_ITEM1);
				expect(wrapper.updated()).toBeGreaterThan(0);
			});
		});

		describe('lazy expired item removal', () => {
			beforeEach(() => {
				instance.add(MOCK_ITEM1);
				instance.items.get(MOCK_ITEM1.id)!.ttl(1);
				instance.items.get(MOCK_ITEM1.id)!.created.subDays(1);
			});

			it(`should remove expired item from map during has lookup`, () => {
				expect(instance.has(MOCK_ITEM1.id)).toBe(false);
				expect(instance.items.has(MOCK_ITEM1.id)).toBe(false);
			});

			it(`should remove expired item from map during get lookup`, () => {
				expect(instance.get(MOCK_ITEM1.id)).toBeNull();
				expect(instance.items.has(MOCK_ITEM1.id)).toBe(false);
			});

			it(`should increment stats.expirations on lazy removal`, () => {
				instance.get(MOCK_ITEM1.id);

				expect(instance.stats.expirations).toBe(1);
			});
		});

		describe('iteration', () => {
			it(`should yield ids of unexpired items from keys()`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);
				instance.items.get(MOCK_ITEM1.id)!.ttl(1);
				instance.items.get(MOCK_ITEM1.id)!.created.subDays(1);

				expect(Array.from(instance.keys())).toStrictEqual([MOCK_ITEM2.id]);
			});

			it(`should lazily remove expired items encountered by keys()`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);
				instance.items.get(MOCK_ITEM1.id)!.ttl(1);
				instance.items.get(MOCK_ITEM1.id)!.created.subDays(1);

				Array.from(instance.keys());

				expect(instance.items.has(MOCK_ITEM1.id)).toBe(false);
				expect(instance.items.has(MOCK_ITEM2.id)).toBe(true);
				expect(instance.stats.expirations).toBe(1);
			});

			it(`should yield unexpired item data from values()`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);
				instance.items.get(MOCK_ITEM2.id)!.ttl(1);
				instance.items.get(MOCK_ITEM2.id)!.created.subDays(1);

				expect(Array.from(instance.values())).toStrictEqual([MOCK_ITEM1]);
			});

			it(`should lazily remove expired items encountered by values()`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);
				instance.items.get(MOCK_ITEM2.id)!.ttl(1);
				instance.items.get(MOCK_ITEM2.id)!.created.subDays(1);

				Array.from(instance.values());

				expect(instance.items.has(MOCK_ITEM1.id)).toBe(true);
				expect(instance.items.has(MOCK_ITEM2.id)).toBe(false);
				expect(instance.stats.expirations).toBe(1);
			});

			it(`should lazily remove expired items encountered by Symbol.iterator`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);
				instance.items.get(MOCK_ITEM1.id)!.ttl(1);
				instance.items.get(MOCK_ITEM1.id)!.created.subDays(1);

				expect([...instance]).toStrictEqual([MOCK_ITEM2]);
				expect(instance.items.has(MOCK_ITEM1.id)).toBe(false);
			});

			it(`should iterate unexpired item data with Symbol.iterator`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM2);

				expect([...instance]).toStrictEqual([MOCK_ITEM1, MOCK_ITEM2]);
			});

			it(`should yield nothing when cache is empty`, () => {
				expect([...instance]).toStrictEqual([]);
				expect(Array.from(instance.keys())).toStrictEqual([]);
				expect(Array.from(instance.values())).toStrictEqual([]);
			});
		});

		describe('stats', () => {
			it(`should start all counters at 0`, () => {
				const custom = new Cache<SampleT>({log: log});

				expect(custom.stats.hits).toBe(0);
				expect(custom.stats.misses).toBe(0);
				expect(custom.stats.adds).toBe(0);
				expect(custom.stats.deletes).toBe(0);
				expect(custom.stats.evictions).toBe(0);
				expect(custom.stats.expirations).toBe(0);
			});

			it(`should count get hits and misses`, () => {
				instance.add(MOCK_ITEM1);

				instance.get(MOCK_ITEM1.id);
				instance.get(MOCK_ITEM1.id);
				instance.get('zz-19714971497');

				expect(instance.stats.hits).toBe(2);
				expect(instance.stats.misses).toBe(1);
			});

			it(`should count successful adds only`, () => {
				instance.add(MOCK_ITEM1);
				instance.add(MOCK_ITEM1);

				expect(instance.stats.adds).toBe(1);
			});

			it(`should count capacity evictions`, () => {
				cfg.capacityMax = 1;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.add(MOCK_ITEM1);
				custom.add(MOCK_ITEM2);

				expect(custom.stats.evictions).toBe(1);
			});

			it(`should count expired items removed by prune`, () => {
				instance.pruneDelay(0);
				instance.add(MOCK_ITEM1);
				instance.items.get(MOCK_ITEM1.id)!.ttl(1);
				instance.items.get(MOCK_ITEM1.id)!.created.subDays(1);

				instance.prune();

				expect(instance.stats.expirations).toBe(1);
			});

			it(`should reset all counters to 0 when cache reset is called`, () => {
				cfg.capacityMax = 1;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.add(MOCK_ITEM1);
				custom.add(MOCK_ITEM2);
				custom.get(MOCK_ITEM2.id);
				custom.get('zz-4971497149');
				custom.delete(MOCK_ITEM2.id);

				expect(custom.stats.adds).toBeGreaterThan(0);
				expect(custom.stats.hits).toBeGreaterThan(0);
				expect(custom.stats.misses).toBeGreaterThan(0);
				expect(custom.stats.deletes).toBeGreaterThan(0);
				expect(custom.stats.evictions).toBeGreaterThan(0);

				custom.reset();

				expect(custom.stats.hits).toBe(0);
				expect(custom.stats.misses).toBe(0);
				expect(custom.stats.adds).toBe(0);
				expect(custom.stats.deletes).toBe(0);
				expect(custom.stats.evictions).toBe(0);
				expect(custom.stats.expirations).toBe(0);
			});
		});

		describe('reset', () => {
			it(`should clear item map`, () => {
				const item1: SampleT = {id: 'aa-149719174'};
				const item2: SampleT = {id: 'bb-1947194714'};
				const item3: SampleT = {id: 'cc-1971491714'};

				instance.add(item1);
				instance.add(item2);
				instance.add(item3);
				expect(instance.size()).toBe(3);
				instance.reset();
				expect(instance.size()).toBe(0);
			});

			it(`should restore capacityMax to its initial value`, () => {
				cfg.capacityMax = 5;
				const custom = new Cache<SampleT>({
					cfg: cfg
				});

				custom.capacityMax = 100;
				custom.reset();

				expect(custom.capacityMax).toBe(5);
			});

			it(`should not throw when called repeatedly`, () => {
				expect(() => {
					for (let i = 0; i < 5; i++) {
						instance.reset();
					}
				}).not.toThrow();
			});
		});
	});
});
