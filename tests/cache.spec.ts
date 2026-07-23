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
import {CfgData} from '../src/cfg/data';
import {Defaults} from '../src/defaults';
import {typeMatch} from '@toreda/strong-types';

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
	let cfg: CfgData<SampleT>;
	let instance: Cache<SampleT>;

	beforeAll(() => {
		log = new Log({
			consoleEnabled: false,
			globalLevel: Levels.ERROR
		});

		cfg = {
			initialSize: 10,
			log: log
		};

		instance = new Cache<SampleT>(cfg);
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		it(`should create a new log instance when cfg.log is undefined`, () => {
			const custom = new Cache<SampleT>({
				log: undefined
			});

			expect(custom.log).not.toBeUndefined();
			expect(typeMatch(custom.log, Log)).toBe(true);
		});
	});

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
				const custom = new Cache<SampleT>({
					capacityMax: 3
				});

				expect(custom.capacityMax).toBe(3);
			});

			it(`should evict oldest item when adding beyond capacity`, () => {
				const custom = new Cache<SampleT>({
					capacityMax: 2
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
				const custom = new Cache<SampleT>({
					capacityMax: 2
				});

				custom.add({id: 'aa-111'});
				custom.add({id: 'bb-222'});

				expect(custom.add({id: 'bb-222'}, true)).toBe(true);
				expect(custom.size()).toBe(2);
				expect(custom.has('aa-111')).toBe(true);
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
				const custom = new Cache<SampleT>({
					capacityMax: 5
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
