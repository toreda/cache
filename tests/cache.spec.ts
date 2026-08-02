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
import type {CacheEvents} from '../src/cache/events';
import {CacheItem} from '../src/cache/item';
import type {Cacheable} from '../src/cacheable';
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

/**
 * Reach into the protected `items` map for test setup that legitimately needs to mutate item
 * metadata directly (ttl/created manipulation for expiry tests).
 */
function itemsOf<T extends Cacheable>(cache: Cache<T>): Map<string, CacheItem<T>> {
	return (cache as unknown as {items: Map<string, CacheItem<T>>}).items;
}

function wrapper<T extends Cacheable>(cache: Cache<T>, id: string): CacheItem<T> {
	return itemsOf(cache).get(id)!;
}

/** Force an item to be expired by giving it a short ttl and an old creation time. */
function expire<T extends Cacheable>(cache: Cache<T>, id: string): void {
	const w = wrapper(cache, id);
	w.ttl(1);
	w.created.subDays(1);
	w.updated(0);
}

describe('Cache', () => {
	let log: Log;
	let instance: Cache<SampleT>;

	beforeAll(() => {
		log = new Log({
			consoleEnabled: false,
			globalLevel: Levels.ERROR
		});

		instance = new Cache<SampleT>({
			cfg: {
				capacityMax: 50,
				ttl: 818,
				prune: {minDelay: 0}
			}
		});
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		it(`should resolve defaults when no cfg provided`, () => {
			const custom = new Cache<SampleT>();
			expect(custom.capacityMax).toBe(Defaults.Cache.CapacityMax);
			expect(custom.cfg.evict.basis).toBe('insertion');
			expect(custom.cfg.evict.order).toBe('oldest');
		});

		it(`should store the provided log`, () => {
			const custom = new Cache<SampleT>({log: log});
			expect(custom.log).toBe(log);
		});
	});

	describe('cfg getter', () => {
		it(`should reflect resolved values`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 7, ttl: 3}});
			expect(custom.cfg.capacityMax).toBe(7);
			expect(custom.cfg.ttl).toBe(3);
		});

		it(`should default prune.interval to prune.minDelay`, () => {
			const custom = new Cache<SampleT>({cfg: {prune: {minDelay: 25}}});
			expect(custom.cfg.prune.interval).toBe(25);
		});

		it(`should default admission.sketchResetThreshold to 10x capacityMax`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 30}});
			expect(custom.cfg.admission.sketchResetThreshold).toBe(300);
		});

		it(`should return a frozen object`, () => {
			const custom = new Cache<SampleT>();
			expect(Object.isFrozen(custom.cfg)).toBe(true);
			expect(Object.isFrozen(custom.cfg.evict)).toBe(true);
		});

		it(`should not affect behavior when the getter result is mutated`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 5}});
			const snapshot = custom.cfg as {capacityMax: number};
			expect(() => {
				snapshot.capacityMax = 999;
			}).toThrow();
			expect(custom.capacityMax).toBe(5);
		});
	});

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
			const id = 'AA_19714-1497149714';
			const item3: SampleT = {id: id};

			expect(instance.add(item3)).toBe(true);

			const result = instance.get(id);
			expect(result).not.toBeNull();
			expect(result).toStrictEqual(item3);
		});

		it(`should return null when cached item is expired`, () => {
			const id = 'aa-1971-4971-197149714';
			instance.add({id: id});
			expire(instance, id);

			expect(instance.get(id)).toBeNull();
		});

		it(`should return null when item exists but has undefined value`, () => {
			const id = 'aaa-1974149714';
			itemsOf(instance).set(id, undefined as any);

			expect(instance.get(id)).toBeNull();
		});
	});

	describe('add', () => {
		it(`should return false when item arg is undefined`, () => {
			expect(instance.size).toBe(0);
			expect(instance.add(undefined as any)).toBe(false);
			expect(instance.size).toBe(0);
		});

		it(`should not add an item when item arg is null`, () => {
			expect(instance.add(null as any)).toBe(false);
			expect(instance.size).toBe(0);
		});

		it(`should add item to empty map`, () => {
			expect(instance.size).toBe(0);
			expect(instance.add({id: 'aa-19047194714'})).toBe(true);
			expect(instance.size).toBe(1);
		});

		it(`should add multiple unique items in successive calls`, () => {
			instance.add({id: 'aa-19047194714'});
			instance.add({id: 'bb-19714971144'});
			expect(instance.size).toBe(2);
		});

		it(`should reject a duplicate id without overwrite`, () => {
			instance.add(MOCK_ITEM1);
			expect(instance.add(MOCK_ITEM1)).toBe(false);
			expect(instance.size).toBe(1);
		});

		it(`should overwrite an existing id when overwrite is set`, () => {
			instance.add({id: 'dup', tag: 'a'} as any);
			expect(instance.add({id: 'dup', tag: 'b'} as any, {overwrite: true})).toBe(true);
			expect(instance.get('dup')).toStrictEqual({id: 'dup', tag: 'b'});
		});
	});

	describe('itemValidator', () => {
		it(`should be null when not provided`, () => {
			const custom = new Cache<SampleT>();
			expect((custom as any).itemValidator).toBeNull();
		});

		it(`should accept all items when not provided`, () => {
			const custom = new Cache<SampleT>();
			expect(custom.add(MOCK_ITEM1)).toBe(true);
			expect(custom.add(MOCK_ITEM2)).toBe(true);
			expect(custom.size).toBe(2);
		});

		it(`should invoke validator with item arg on each add call`, () => {
			const validator = jest.fn().mockReturnValue(true);
			const custom = new Cache<SampleT>({itemValidator: validator});

			custom.add(MOCK_ITEM1);
			custom.add(MOCK_ITEM2);

			expect(validator).toHaveBeenCalledTimes(2);
			expect(validator).toHaveBeenCalledWith(MOCK_ITEM1);
			expect(validator).toHaveBeenCalledWith(MOCK_ITEM2);
		});

		it(`should add items when validator returns true`, () => {
			const custom = new Cache<SampleT>({itemValidator: () => true});
			expect(custom.add(MOCK_ITEM1)).toBe(true);
			expect(custom.size).toBe(1);
		});

		it(`should not add items when validator returns false`, () => {
			const custom = new Cache<SampleT>({itemValidator: () => false});
			expect(custom.add(MOCK_ITEM1)).toBe(false);
			expect(custom.size).toBe(0);
		});
	});

	describe('capacityMax', () => {
		it(`should use default when cfg.capacityMax is not provided`, () => {
			const custom = new Cache<SampleT>();
			expect(custom.capacityMax).toBe(Defaults.Cache.CapacityMax);
		});

		it(`should use cfg.capacityMax when provided`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 3}});
			expect(custom.capacityMax).toBe(3);
		});

		it(`should evict oldest item when adding beyond capacity`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 2}});
			custom.add({id: 'aa-111'});
			custom.add({id: 'bb-222'});

			expect(custom.add({id: 'cc-333'})).toBe(true);
			expect(custom.size).toBe(2);
			expect(custom.has('aa-111')).toBe(false);
			expect(custom.has('bb-222')).toBe(true);
			expect(custom.has('cc-333')).toBe(true);
		});

		it(`should not evict when overwriting an existing item at capacity`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 2}});
			custom.add({id: 'aa-111'});
			custom.add({id: 'bb-222'});

			expect(custom.add({id: 'bb-222'}, {overwrite: true})).toBe(true);
			expect(custom.size).toBe(2);
			expect(custom.has('aa-111')).toBe(true);
		});
	});

	describe('setCapacity', () => {
		it(`should reject non-number values`, () => {
			expect(instance.setCapacity('5' as any)).toBe(false);
		});

		it(`should reject negative values`, () => {
			expect(instance.setCapacity(-1)).toBe(false);
		});

		it(`should reject non-finite values`, () => {
			expect(instance.setCapacity(Infinity)).toBe(false);
			expect(instance.setCapacity(NaN)).toBe(false);
		});

		it(`should fire onCapacityIncrease on increase`, () => {
			const onCapacityIncrease = jest.fn();
			const custom = new Cache<SampleT>({cfg: {capacityMax: 5}, events: {onCapacityIncrease}});
			expect(custom.setCapacity(10)).toBe(true);
			expect(custom.capacityMax).toBe(10);
			expect(onCapacityIncrease).toHaveBeenCalledWith(5, 10);
		});

		it(`should treat 0 (unbounded) as an increase`, () => {
			const onCapacityIncrease = jest.fn();
			const custom = new Cache<SampleT>({cfg: {capacityMax: 5}, events: {onCapacityIncrease}});
			expect(custom.setCapacity(0)).toBe(true);
			expect(onCapacityIncrease).toHaveBeenCalledWith(5, 0);
		});

		it(`should fire onCapacityDecrease and evict immediately on shrink`, () => {
			const onCapacityDecrease = jest.fn();
			const onItemEvict = jest.fn();
			const custom = new Cache<SampleT>({
				cfg: {capacityMax: 4},
				events: {onCapacityDecrease, onItemEvict}
			});
			custom.add({id: 'a'});
			custom.add({id: 'b'});
			custom.add({id: 'c'});
			custom.add({id: 'd'});

			expect(custom.setCapacity(2)).toBe(true);
			expect(onCapacityDecrease).toHaveBeenCalledWith(4, 2);
			expect(custom.size).toBe(2);
			// oldest evicted first (insertion basis)
			expect(custom.has('a')).toBe(false);
			expect(custom.has('b')).toBe(false);
			expect(custom.has('c')).toBe(true);
			expect(custom.has('d')).toBe(true);
			expect(onItemEvict).toHaveBeenCalledTimes(2);
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
			expect(instance.size).toBe(1);
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
		it(`should use the instance default TTL when no add ttl arg is provided`, () => {
			const custom = new Cache<SampleT>({cfg: {ttl: 910}});
			custom.add(MOCK_ITEM1);
			expect(wrapper(custom, MOCK_ITEM1.id).ttl()).toBe(910);
		});

		it(`should use add ttl arg over cfg.ttl when both are provided`, () => {
			const custom = new Cache<SampleT>({cfg: {ttl: 77}});
			custom.add(MOCK_ITEM1, {ttl: 55});
			expect(wrapper(custom, MOCK_ITEM1.id).ttl()).toBe(55);
		});

		it(`should accept 0 ttl arg for items which never expire`, () => {
			instance.add(MOCK_ITEM1, {ttl: 0});
			const w = wrapper(instance, MOCK_ITEM1.id);
			expect(w.ttl()).toBe(0);
			expect(w.expired()).toBe(false);
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

		it(`should apply ttl opt to items created by factory`, () => {
			const id = 'aa-77419741971';
			const result = instance.getOrAdd(id, () => ({id: id}), {ttl: 44});
			expect(result).not.toBeNull();
			expect(wrapper(instance, id).ttl()).toBe(44);
		});

		it(`should return null when factory item cannot be added`, () => {
			const factory = jest.fn().mockReturnValue({id: ''});
			expect(instance.getOrAdd('aa-19714971', factory)).toBeNull();
			expect(instance.size).toBe(0);
		});
	});

	describe('touch', () => {
		it(`should return false when no item matches id`, () => {
			expect(instance.touch('aa-497149174')).toBe(false);
		});

		it(`should refresh updated timestamp and return true for unexpired items`, () => {
			instance.add(MOCK_ITEM1);
			const w = wrapper(instance, MOCK_ITEM1.id);
			expect(w.updated()).toBe(0);

			expect(instance.touch(MOCK_ITEM1.id)).toBe(true);
			expect(w.updated()).toBeGreaterThan(0);
		});

		it(`should return false and lazily remove expired items`, () => {
			instance.add(MOCK_ITEM1);
			expire(instance, MOCK_ITEM1.id);

			expect(instance.touch(MOCK_ITEM1.id)).toBe(false);
			expect(itemsOf(instance).has(MOCK_ITEM1.id)).toBe(false);
		});
	});

	describe('sliding expiration (get)', () => {
		it(`should not refresh updated on get by default`, () => {
			instance.add(MOCK_ITEM1);
			instance.get(MOCK_ITEM1.id);
			expect(wrapper(instance, MOCK_ITEM1.id).updated()).toBe(0);
		});

		it(`should refresh updated on get when get.slidesExpiration is enabled`, () => {
			const custom = new Cache<SampleT>({cfg: {get: {slidesExpiration: true}}});
			custom.add(MOCK_ITEM1);
			expect(wrapper(custom, MOCK_ITEM1.id).updated()).toBe(0);
			expect(custom.get(MOCK_ITEM1.id)).toStrictEqual(MOCK_ITEM1);
			expect(wrapper(custom, MOCK_ITEM1.id).updated()).toBeGreaterThan(0);
		});
	});

	describe('access accounting', () => {
		it(`should count a get as an access by default`, () => {
			instance.add(MOCK_ITEM1);
			const before = wrapper(instance, MOCK_ITEM1.id).accessCount;
			instance.get(MOCK_ITEM1.id);
			expect(wrapper(instance, MOCK_ITEM1.id).accessCount).toBe(before + 1);
		});

		it(`should not count a has as an access by default`, () => {
			instance.add(MOCK_ITEM1);
			instance.has(MOCK_ITEM1.id);
			expect(wrapper(instance, MOCK_ITEM1.id).accessCount).toBe(0);
		});

		it(`should count a has as an access when has.countsAsAccess is enabled`, () => {
			const custom = new Cache<SampleT>({cfg: {has: {countsAsAccess: true}}});
			custom.add(MOCK_ITEM1);
			custom.has(MOCK_ITEM1.id);
			expect(wrapper(custom, MOCK_ITEM1.id).accessCount).toBe(1);
		});
	});

	describe('prune', () => {
		it(`should return 0 when called before min prune delay elapsed`, () => {
			const custom = new Cache<SampleT>({cfg: {prune: {minDelay: 3333}}});
			(custom as any).lastPrune.setNow();
			expect(custom.prune()).toBe(0);
		});

		it(`should force prune past the delay gate`, () => {
			const custom = new Cache<SampleT>({cfg: {prune: {minDelay: 3333}}});
			custom.add(MOCK_ITEM1);
			expire(custom, MOCK_ITEM1.id);
			(custom as any).lastPrune.setNow();

			expect(custom.prune({force: true})).toBe(1);
		});

		it(`should return expired item deletion count`, () => {
			instance.add({id: 'aaa1441'});
			instance.add({id: 'bbb44141'});
			expire(instance, 'aaa1441');
			expire(instance, 'bbb44141');

			expect(instance.prune()).toBe(2);
		});

		it(`should fire onPrune with the removed count`, () => {
			const onPrune = jest.fn();
			const custom = new Cache<SampleT>({cfg: {prune: {minDelay: 0}}, events: {onPrune}});
			custom.add(MOCK_ITEM1);
			expire(custom, MOCK_ITEM1.id);
			custom.prune();
			expect(onPrune).toHaveBeenCalledWith(1);
		});
	});

	describe('iteration', () => {
		it(`should yield ids of unexpired items from keys()`, () => {
			instance.add(MOCK_ITEM1);
			instance.add(MOCK_ITEM2);
			expire(instance, MOCK_ITEM1.id);

			expect(Array.from(instance.keys())).toStrictEqual([MOCK_ITEM2.id]);
		});

		it(`should yield unexpired item data from values()`, () => {
			instance.add(MOCK_ITEM1);
			instance.add(MOCK_ITEM2);
			expire(instance, MOCK_ITEM2.id);

			expect(Array.from(instance.values())).toStrictEqual([MOCK_ITEM1]);
		});

		it(`should yield [id, item] pairs from entries()`, () => {
			instance.add(MOCK_ITEM1);
			instance.add(MOCK_ITEM2);

			expect(Array.from(instance.entries())).toStrictEqual([
				[MOCK_ITEM1.id, MOCK_ITEM1],
				[MOCK_ITEM2.id, MOCK_ITEM2]
			]);
		});

		it(`should lazily remove expired items encountered by entries()`, () => {
			instance.add(MOCK_ITEM1);
			instance.add(MOCK_ITEM2);
			expire(instance, MOCK_ITEM1.id);

			Array.from(instance.entries());
			expect(itemsOf(instance).has(MOCK_ITEM1.id)).toBe(false);
			expect(instance.stats.expirations).toBe(1);
		});

		it(`should not count iteration as an access`, () => {
			instance.add(MOCK_ITEM1);
			Array.from(instance.keys());
			Array.from(instance.values());
			Array.from(instance.entries());
			expect(wrapper(instance, MOCK_ITEM1.id).accessCount).toBe(0);
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
			expect(custom.stats.rejects).toBe(0);
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
			const custom = new Cache<SampleT>({cfg: {capacityMax: 1}});
			custom.add(MOCK_ITEM1);
			custom.add(MOCK_ITEM2);
			expect(custom.stats.evictions).toBe(1);
		});

		it(`should count expired items removed by prune`, () => {
			instance.add(MOCK_ITEM1);
			expire(instance, MOCK_ITEM1.id);
			instance.prune();
			expect(instance.stats.expirations).toBe(1);
		});

		it(`should increment expirations on lazy get removal`, () => {
			instance.add(MOCK_ITEM1);
			expire(instance, MOCK_ITEM1.id);
			instance.get(MOCK_ITEM1.id);
			expect(instance.stats.expirations).toBe(1);
		});
	});

	describe('rejects', () => {
		it(`should count validator rejects with reason 'validator'`, () => {
			const onAddReject = jest.fn();
			const custom = new Cache<SampleT>({itemValidator: () => false, events: {onAddReject}});
			expect(custom.add(MOCK_ITEM1)).toBe(false);
			expect(custom.stats.rejects).toBe(1);
			expect(onAddReject).toHaveBeenCalledWith(MOCK_ITEM1, 'validator');
		});

		it(`should count bad-id rejects with reason 'bad-id'`, () => {
			const onAddReject = jest.fn();
			const custom = new Cache<SampleT>({events: {onAddReject}});
			const bad = {id: ''} as SampleT;
			expect(custom.add(bad)).toBe(false);
			expect(custom.stats.rejects).toBe(1);
			expect(onAddReject).toHaveBeenCalledWith(bad, 'bad-id');
		});

		it(`should count duplicate rejects with reason 'duplicate'`, () => {
			const onAddReject = jest.fn();
			const custom = new Cache<SampleT>({events: {onAddReject}});
			custom.add(MOCK_ITEM1);
			expect(custom.add(MOCK_ITEM1)).toBe(false);
			expect(custom.stats.rejects).toBe(1);
			expect(onAddReject).toHaveBeenCalledWith(MOCK_ITEM1, 'duplicate');
		});

		it(`should count capacity rejects with reason 'capacity' when eviction is disabled`, () => {
			const onAddReject = jest.fn();
			const custom = new Cache<SampleT>({
				cfg: {capacityMax: 1, evict: {basis: 'none'}},
				events: {onAddReject}
			});
			custom.add(MOCK_ITEM1);
			expect(custom.add(MOCK_ITEM2)).toBe(false);
			expect(custom.stats.rejects).toBe(1);
			expect(onAddReject).toHaveBeenCalledWith(MOCK_ITEM2, 'capacity');
		});
	});

	describe('events', () => {
		function withEvents(events: CacheEvents<SampleT>, cfg = {}): Cache<SampleT> {
			return new Cache<SampleT>({cfg: cfg, events: events});
		}

		it(`should fire onItemAdd with item and id`, () => {
			const onItemAdd = jest.fn();
			const custom = withEvents({onItemAdd});
			custom.add(MOCK_ITEM1);
			expect(onItemAdd).toHaveBeenCalledWith(MOCK_ITEM1, MOCK_ITEM1.id);
		});

		it(`should fire onItemHit on get hit with source 'get'`, () => {
			const onItemHit = jest.fn();
			const custom = withEvents({onItemHit});
			custom.add(MOCK_ITEM1);
			custom.get(MOCK_ITEM1.id);
			expect(onItemHit).toHaveBeenCalledWith(MOCK_ITEM1, MOCK_ITEM1.id, 'get');
		});

		it(`should fire onItemHit on touch with source 'touch'`, () => {
			const onItemHit = jest.fn();
			const custom = withEvents({onItemHit});
			custom.add(MOCK_ITEM1);
			custom.touch(MOCK_ITEM1.id);
			expect(onItemHit).toHaveBeenCalledWith(MOCK_ITEM1, MOCK_ITEM1.id, 'touch');
		});

		it(`should fire onItemMiss on get miss`, () => {
			const onItemMiss = jest.fn();
			const custom = withEvents({onItemMiss});
			custom.get('missing');
			expect(onItemMiss).toHaveBeenCalledWith('missing');
		});

		it(`should not fire hit or miss events for has`, () => {
			const onItemHit = jest.fn();
			const onItemMiss = jest.fn();
			const custom = withEvents({onItemHit, onItemMiss});
			custom.add(MOCK_ITEM1);
			custom.has(MOCK_ITEM1.id);
			custom.has('missing');
			expect(onItemHit).not.toHaveBeenCalled();
			expect(onItemMiss).not.toHaveBeenCalled();
		});

		it(`should fire onItemExpire before onItemRemove on lazy expiry`, () => {
			const calls: string[] = [];
			const custom = withEvents({
				onItemExpire: () => calls.push('expire'),
				onItemRemove: (_i, _id, reason) => calls.push(`remove:${reason}`)
			});
			custom.add(MOCK_ITEM1);
			expire(custom, MOCK_ITEM1.id);
			custom.get(MOCK_ITEM1.id);
			expect(calls).toStrictEqual(['expire', 'remove:expire']);
		});

		it(`should fire onItemEvict before onItemRemove on eviction`, () => {
			const calls: string[] = [];
			const custom = new Cache<SampleT>({
				cfg: {capacityMax: 1},
				events: {
					onItemEvict: () => calls.push('evict'),
					onItemRemove: (_i, _id, reason) => calls.push(`remove:${reason}`)
				}
			});
			custom.add(MOCK_ITEM1);
			custom.add(MOCK_ITEM2);
			expect(calls).toStrictEqual(['evict', 'remove:evict']);
		});

		it(`should fire onItemRemove with reason 'delete' on delete`, () => {
			const onItemRemove = jest.fn();
			const custom = withEvents({onItemRemove});
			custom.add(MOCK_ITEM1);
			custom.delete(MOCK_ITEM1.id);
			expect(onItemRemove).toHaveBeenCalledWith(MOCK_ITEM1, MOCK_ITEM1.id, 'delete');
		});

		it(`should fire onItemRemove with reason 'overwrite' before replacing`, () => {
			const onItemRemove = jest.fn();
			const custom = withEvents({onItemRemove});
			custom.add({id: 'dup', v: 1} as any);
			custom.add({id: 'dup', v: 2} as any, {overwrite: true});
			expect(onItemRemove).toHaveBeenCalledWith({id: 'dup', v: 1}, 'dup', 'overwrite');
		});

		it(`should not fire per-item events on clear`, () => {
			const onItemRemove = jest.fn();
			const onClear = jest.fn();
			const custom = withEvents({onItemRemove, onClear});
			custom.add(MOCK_ITEM1);
			custom.add(MOCK_ITEM2);
			custom.clear();
			expect(onItemRemove).not.toHaveBeenCalled();
			expect(onClear).toHaveBeenCalledWith(2);
		});

		it(`should not throw and should log when a callback throws`, () => {
			const errorLog = new Log({consoleEnabled: false, globalLevel: Levels.ALL});
			const errorSpy = jest.spyOn(errorLog, 'error');
			const custom = new Cache<SampleT>({
				log: errorLog,
				events: {
					onItemAdd: () => {
						throw new Error('boom');
					}
				}
			});

			expect(() => custom.add(MOCK_ITEM1)).not.toThrow();
			expect(custom.has(MOCK_ITEM1.id)).toBe(true);
			expect(errorSpy).toHaveBeenCalled();
		});
	});

	describe('clear', () => {
		it(`should remove all items and return the count`, () => {
			instance.add(MOCK_ITEM1);
			instance.add(MOCK_ITEM2);
			expect(instance.clear()).toBe(2);
			expect(instance.size).toBe(0);
		});
	});

	describe('reset', () => {
		it(`should clear item map`, () => {
			instance.add({id: 'aa-149719174'});
			instance.add({id: 'bb-1947194714'});
			expect(instance.size).toBe(2);
			instance.reset();
			expect(instance.size).toBe(0);
		});

		it(`should restore capacityMax to its initial value`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 5}});
			custom.setCapacity(100);
			custom.reset();
			expect(custom.capacityMax).toBe(5);
		});

		it(`should reset all stat counters`, () => {
			const custom = new Cache<SampleT>({cfg: {capacityMax: 1}});
			custom.add(MOCK_ITEM1);
			custom.add(MOCK_ITEM2);
			custom.get(MOCK_ITEM2.id);
			custom.get('zz-4971497149');
			custom.delete(MOCK_ITEM2.id);

			custom.reset();
			expect(custom.stats.hits).toBe(0);
			expect(custom.stats.misses).toBe(0);
			expect(custom.stats.adds).toBe(0);
			expect(custom.stats.deletes).toBe(0);
			expect(custom.stats.evictions).toBe(0);
			expect(custom.stats.expirations).toBe(0);
			expect(custom.stats.rejects).toBe(0);
		});

		it(`should fire onClear then onReset`, () => {
			const calls: string[] = [];
			const custom = new Cache<SampleT>({
				events: {
					onClear: () => calls.push('clear'),
					onReset: () => calls.push('reset')
				}
			});
			custom.add(MOCK_ITEM1);
			custom.reset();
			expect(calls).toStrictEqual(['clear', 'reset']);
		});

		it(`should not throw when called repeatedly`, () => {
			expect(() => {
				for (let i = 0; i < 5; i++) {
					instance.reset();
				}
			}).not.toThrow();
		});
	});

	describe('cfg validation', () => {
		it(`should throw when admission.policy 'frequency' with evict.basis 'none'`, () => {
			expect(() => {
				new Cache<SampleT>({cfg: {admission: {policy: 'frequency'}, evict: {basis: 'none'}}});
			}).toThrow(/admission/);
		});

		it(`should throw when adaptive without segments + ghosts + perSegment`, () => {
			expect(() => {
				new Cache<SampleT>({cfg: {adaptive: true}});
			}).toThrow(/adaptive/);
		});

		it(`should throw when ghosts.enabled with evict.basis 'none'`, () => {
			expect(() => {
				new Cache<SampleT>({cfg: {ghosts: {enabled: true}, evict: {basis: 'none'}}});
			}).toThrow(/ghosts/);
		});

		it(`should throw when secondChance with evict.basis 'random'`, () => {
			expect(() => {
				new Cache<SampleT>({cfg: {evict: {secondChance: true, basis: 'random'}}});
			}).toThrow(/secondChance/);
		});

		it(`should throw when a ratio is outside (0, 1)`, () => {
			expect(() => {
				new Cache<SampleT>({cfg: {segments: {protectedRatio: 1.5}}});
			}).toThrow(/protectedRatio/);
		});

		it(`should throw when protectedRatio + probationRatio > 1 with segments enabled`, () => {
			expect(() => {
				new Cache<SampleT>({
					cfg: {segments: {enabled: true, protectedRatio: 0.8, probationRatio: 0.5}}
				});
			}).toThrow(/probationRatio/);
		});

		it(`should warn when evict.* set with capacityMax 0`, () => {
			const warnLog = new Log({consoleEnabled: false, globalLevel: Levels.ALL});
			const warnSpy = jest.spyOn(warnLog, 'warn');
			new Cache<SampleT>({log: warnLog, cfg: {capacityMax: 0, evict: {basis: 'access'}}});
			expect(warnSpy).toHaveBeenCalled();
		});

		it(`should warn when prune.auto with no ttl`, () => {
			const warnLog = new Log({consoleEnabled: false, globalLevel: Levels.ALL});
			const warnSpy = jest.spyOn(warnLog, 'warn');
			new Cache<SampleT>({log: warnLog, cfg: {ttl: 0, prune: {auto: true}}});
			expect(warnSpy).toHaveBeenCalled();
		});
	});
});
