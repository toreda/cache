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

import {numberNullValue, numberValue} from '@toreda/strong-types';

import {CacheItem} from './cache/item';
import type {CacheItemId} from './cache/item/id';
import {CacheStats} from './cache/stats';
import type {Cacheable} from './cacheable';
import {Defaults} from './defaults';
import type {Time} from '@toreda/time';
import {cacheItemId} from './cache/item/id';
import {timeMake} from '@toreda/time';
import type {LogLike} from '@toreda/shared-types';
import type {CacheInit} from './cache/init';

/**
 * Time based object cache for TypeScript generics.
 *
 * @category Cache
 */
export class Cache<ItemT extends Cacheable> {
	/** Global log instance. */
	public readonly log?: LogLike;
	/** Map of ItemId  */
	public readonly items: Map<CacheItemId, CacheItem<ItemT>>;
	/** Optional validator invoked on each `add` call. Items are only added when the validator
	 *  returns `true`. When `null`, validation is skipped and all items are accepted. */
	public readonly itemValidator: ((item?: ItemT | null) => boolean) | null;
	/** Max number of items that can be cached at any one time. */
	public capacityMax: number;
	/** capacityMax value resolved during init. Restored by `reset()`. */
	private readonly initialCapacityMax: number;
	/** Default TTL (seconds) for items added without an explicit ttl arg. `null` falls back to
	 *  `Defaults.CacheItem.TTL`. */
	public readonly itemTtl: number | null;
	/** When `true`, each successful `get` call refreshes the item's expiration window. */
	public readonly slidingExpiration: boolean;
	/** Operation counters for this cache instance. All counters restored to 0 by `reset()`. */
	public readonly stats: CacheStats;
	/** Minimum number of seconds between prune calls. `prune()` execution aborts automatically when called
	 *  more frequently than delay allows. */
	public readonly pruneDelay: Time;
	/** Timestamp of the last successful prune operation. */
	public readonly lastPrune: Time;

	constructor(init?: CacheInit<ItemT>) {
		this.log = init?.log;
		this.items = new Map<string, CacheItem<ItemT>>();

		this.itemValidator = init?.itemValidator ? init?.itemValidator : null;
		this.capacityMax = numberValue(init?.cfg?.capacityMax, Defaults.Cache.CapacityMax);
		this.initialCapacityMax = this.capacityMax;
		this.itemTtl = numberNullValue(init?.cfg?.ttl, null);
		this.slidingExpiration = init?.cfg?.slidingExpiration === true;
		this.stats = new CacheStats();
		this.pruneDelay = timeMake(
			's',
			numberValue(init?.cfg?.pruneDelay, Defaults.Cache.PruneDelay),
			this.log
		);
		this.lastPrune = timeMake('s', 0, this.log);
	}

	/**
	 * Get wrapper for item matching `id` if one exists and is unexpired. Expired items found
	 * during lookup are lazily removed from cache.
	 * @param id		Unique ID of item in cache.
	 * @returns			CacheItem wrapper when it exists & is unexpired, otherwise `null`.
	 */
	private getItem(id: string): CacheItem<ItemT> | null {
		const item = this.items.get(id);
		if (!item || !(item instanceof CacheItem)) {
			return null;
		}

		if (item.expired()) {
			if (this.items.delete(id) === true) {
				this.stats.expirations++;
			}

			return null;
		}

		return item;
	}

	/**
	 * Get current cached item count.
	 * @returns
	 */
	public size(): number {
		return this.items.size;
	}

	/**
	 * Check unexpired item with target id exists in cache. Expired items found during lookup
	 * are lazily removed from cache.
	 * @param id		Unique ID of item in cache.
	 * @returns
	 */
	public has(id: string): boolean {
		return this.getItem(id) !== null;
	}

	/**
	 * Get item from cache matching `id` if one exists. Expired items found during lookup are
	 * lazily removed from cache. When sliding expiration is enabled, successful gets refresh
	 * the item's expiration window.
	 * @param id		Globally unique item identifier.
	 * @returns			Item of type `ItemT` if it exists, otherwise `null`.
	 */
	public get(id: string): ItemT | null {
		const item = this.getItem(id);

		if (!item || !item.data) {
			this.stats.misses++;
			return null;
		}

		this.stats.hits++;

		if (this.slidingExpiration) {
			item.update();
		}

		return item.data;
	}

	/**
	 * Get item from cache matching `id`, or create it with `factory` and add the result to
	 * cache when no unexpired item matches.
	 * @param id		Globally unique item identifier.
	 * @param factory	Invoked to create the item on cache miss. Should return an item whose
	 *					id matches the `id` arg, otherwise the item is cached under its own id.
	 * @param ttl		Optional TTL (seconds) applied when the factory item is added.
	 * @returns			Cached or newly created item, or `null` when the factory item could
	 *					not be added.
	 */
	public getOrAdd(id: string, factory: (id: string) => ItemT, ttl?: number): ItemT | null {
		const existing = this.get(id);
		if (existing !== null) {
			return existing;
		}

		const item = factory(id);
		if (this.add(item, false, ttl) !== true) {
			return null;
		}

		return item;
	}

	/**
	 * Add item to cache if it does not exist. When adding would exceed `capacityMax`, the oldest
	 * cached items are evicted to make room.
	 * @param item			Item to cache.
	 * @param overwrite		`true`	-	Overwrite existing item with same ID.
	 *						`false`	-	(default) Do not overwrite existing item. add call fails.
	 * @param ttl			Optional TTL (seconds) for this item. Falls back to the cache's
	 *						configured ttl, then `Defaults.CacheItem.TTL`. `0` never expires.
	 * @returns
	 */
	public add(item: ItemT, overwrite?: boolean, ttl?: number): boolean {
		if (this.itemValidator && this.itemValidator(item) !== true) {
			return false;
		}

		const id = cacheItemId(item);

		if (!id) {
			return false;
		}

		const has = this.has(id);

		if (has === true && overwrite !== true) {
			return false;
		}

		// Replacing an existing id doesn't grow the cache, so eviction only applies when the
		// id is not already present.
		if (!this.items.has(id) && this.capacityMax > 0) {
			while (this.items.size >= this.capacityMax) {
				const oldest = this.items.keys().next();
				if (oldest.done) {
					break;
				}

				if (this.items.delete(oldest.value) === true) {
					this.stats.evictions++;
				}
			}
		}

		let itemTtl: number | undefined;
		if (typeof ttl === 'number') {
			itemTtl = ttl;
		} else if (this.itemTtl !== null) {
			itemTtl = this.itemTtl;
		} else {
			itemTtl = Defaults.CacheItem.TTL;
		}

		const wrappedItem = new CacheItem<ItemT>(item, itemTtl);
		this.items.set(id, wrappedItem);
		this.stats.adds++;

		return true;
	}

	/**
	 * Delete item from cache matching `id` if one exists.
	 * @param id		Unique ID of item in cache.
	 * @returns			`true` when an item was removed, otherwise `false`.
	 */
	public delete(id: string): boolean {
		const result = this.items.delete(id);

		if (result === true) {
			this.stats.deletes++;
		}

		return result;
	}

	/**
	 * Refresh expiration window of unexpired item matching `id`. Expired items found during
	 * lookup are lazily removed from cache and cannot be touched.
	 * @param id		Unique ID of item in cache.
	 * @returns			`true` when the item exists & was refreshed, otherwise `false`.
	 */
	public touch(id: string): boolean {
		const item = this.getItem(id);
		if (!item) {
			return false;
		}

		item.update();
		return true;
	}

	/**
	 * Iterate ids of unexpired cached items. Expired items encountered during iteration are
	 * skipped & lazily removed from cache.
	 * @returns
	 */
	public *keys(): IterableIterator<CacheItemId> {
		for (const id of this.items.keys()) {
			if (this.getItem(id) !== null) {
				yield id;
			}
		}
	}

	/**
	 * Iterate unexpired cached items. Expired items encountered during iteration are skipped &
	 * lazily removed from cache.
	 * @returns
	 */
	public *values(): IterableIterator<ItemT> {
		for (const id of this.items.keys()) {
			const item = this.getItem(id);
			if (item !== null) {
				yield item.data;
			}
		}
	}

	/**
	 * Iterate unexpired cached items.
	 * @returns
	 */
	public [Symbol.iterator](): IterableIterator<ItemT> {
		return this.values();
	}

	/**
	 * Iterate over all items and check for expiration.
	 * @returns	Number of items pruned.
	 */
	public prune(): number {
		// Bail out if called before enough time has elapsed.
		if (!this.lastPrune.elapsed(this.pruneDelay)) {
			return 0;
		}

		let count = 0;

		for (const [key, value] of this.items) {
			if (value.expired()) {
				if (this.items.delete(key) === true) {
					count++;
					this.stats.expirations++;
				}
			}
		}

		this.lastPrune.setNow();
		return count;
	}

	/**
	 * Reset cache to inital state. Clears all cached items and restores all stat counters to 0.
	 * @returns		void
	 */
	public reset(): void {
		this.pruneDelay.reset();
		this.lastPrune.reset();
		this.capacityMax = this.initialCapacityMax;
		this.stats.reset();
		this.items.clear();
	}
}
