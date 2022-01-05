/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2022 Toreda, Inc.
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
import {typeMatch} from '@toreda/strong-types';

const MOCK_ID = 'aaa-197414-1486141';
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
			consoleEnabled: true,
			globalLevel: Levels.ALL
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
			it(`should return 0 when time elapsed since last prune is less than min prune delay`, async () => {
				instance.pruneDelay(3333);
				instance.lastPrune.setNow();
				const result = await instance.prune();

				expect(result).toBe(0);
			});

			it(`should return 0 when cache contains multiple unexpired items`, async () => {
				const item1: SampleT = {id: 'aaa1441'};
				const item2: SampleT = {id: 'bbb44141'};
				instance.add(item1);
				instance.add(item2);

				instance.items.get('aaa1441')!.ttl(9999999999);
				instance.items.get('bbb44141')!.ttl(999999999);

				const result = await instance.prune();
				expect(result).toBe(0);
			});

			it(`should return expired item deletion count`, async () => {
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

				const result = await instance.prune();
				expect(result).toBe(2);
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

		describe('defaultItemValidator', () => {
			it(`should return false when item arg is undefined`, () => {
				expect(instance.defaultItemValidator(undefined)).toBe(false);
			});

			it(`should return false when item arg is null`, () => {
				expect(instance.defaultItemValidator(null)).toBe(false);
			});

			it(`should return true when item arg is truthy`, () => {
				const item: SampleT = {
					id: MOCK_ID
				};

				expect(instance.defaultItemValidator(item)).toBe(true);
			});
		});

		describe('onMemoryWarning', () => {
			it(`should call reset and return true`, async () => {
				const spy = jest.spyOn(instance, 'reset');
				expect(spy).not.toHaveBeenCalled();

				const result = await instance.onMemoryWarning();

				expect(spy).toHaveBeenCalledTimes(1);
				expect(result).toBe(true);
				spy.mockRestore();
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

			it(`should not throw when called repeatedly`, async () => {
				expect(async () => {
					for (let i = 0; i < 5; i++) {
						await instance.onMemoryWarning();
					}
				}).not.toThrow();
			});
		});
	});
});
